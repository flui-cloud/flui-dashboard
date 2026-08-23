/**
 * The guest turns an agent on, and the agent deploys.
 *
 * Usage:
 *   node guest-agent.mjs [--headed] [--out DIR]
 *
 * Environment:
 *   FLUI_API_URL        default http://localhost:3000
 *   FLUI_DASHBOARD_URL  default http://localhost:4200
 *   FLUI_AGENT_OUT      default ./out-agent   (put it outside the repo)
 *   FLUI_SANDBOX_TOKEN / FLUI_SANDBOX_TOKEN_FILE
 *                       reuse a tenancy instead of spending a fresh one
 *   FLUI_AGENT_INSTALL  catalog slug to install (default: none — read only)
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, chmod } from 'node:fs/promises';
import path from 'node:path';

const trimSlashes = (s) => s.replace(/\/+$/, '');
const API = trimSlashes(process.env.FLUI_API_URL || 'http://localhost:3000');
const DASH = trimSlashes(process.env.FLUI_DASHBOARD_URL || 'http://localhost:4200');
const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const outFlag = args.indexOf('--out');
const OUT = path.resolve(
  outFlag >= 0 ? args[outFlag + 1] : process.env.FLUI_AGENT_OUT || 'out-agent',
);
const TOKEN_FILE = process.env.FLUI_SANDBOX_TOKEN_FILE;
const INSTALL = process.env.FLUI_AGENT_INSTALL || '';

const SETTLE_MS = 2_500;
const secrets = [];
const redact = (text) => {
  let out = String(text ?? '').replace(/([?&]token=)[^&\s]+/gi, '$1REDACTED');
  for (const s of secrets) if (s) out = out.split(s).join('REDACTED');
  return out;
};

async function claim() {
  if (process.env.FLUI_SANDBOX_TOKEN) {
    return { token: process.env.FLUI_SANDBOX_TOKEN, source: 'environment' };
  }
  if (TOKEN_FILE) {
    const saved = await readFile(TOKEN_FILE, 'utf8').catch(() => '');
    if (saved.trim()) return { token: saved.trim(), source: 'token file' };
  }
  const res = await fetch(`${API}/api/v1/sandbox/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.apiKey) {
    throw new Error(`claim failed: ${res.status} ${body.code || ''} ${body.message || ''}`);
  }
  if (TOKEN_FILE) {
    await writeFile(TOKEN_FILE, body.apiKey, { mode: 0o600 });
    await chmod(TOKEN_FILE, 0o600).catch(() => {});
  }
  return { token: body.apiKey, source: 'POST /sandbox/claim' };
}

async function mcp(key, id, method, params) {
  const res = await fetch(`${API}/api/v1/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const text = await res.text();
  const sse = text.split('\n').find((l) => l.startsWith('data: '));
  const payload = (sse ? sse.slice(6) : text).trim();
  try {
    return { status: res.status, body: JSON.parse(payload) };
  } catch {
    return { status: res.status, body: payload.slice(0, 400) };
  }
}

const toolText = (reply) => {
  const c = reply?.body?.result?.content;
  return Array.isArray(c) ? c[0]?.text : undefined;
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const report = { startedAt: new Date().toISOString(), api: API, dashboard: DASH, steps: [] };
  const step = (name, data) => {
    report.steps.push({ name, ...data });
    console.log(`${name}: ${redact(JSON.stringify(data)).slice(0, 220)}`);
  };

  const claimed = await claim();
  secrets.push(claimed.token);

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(20_000);

  await page.goto(`${API}/api/v1/sandbox/resume?token=${encodeURIComponent(claimed.token)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(SETTLE_MS);
  const cookies = await context.cookies();
  step('entered', {
    tokenSource: claimed.source,
    sessionCookieSet: cookies.some((c) => c.name === 'flui_session'),
    landedOn: redact(page.url()),
  });

  const groupsRes = await page.request.get(`${API}/api/v1/auth/api-key-groups`);
  const groups = groupsRes.ok() ? await groupsRes.json() : [];
  step('read the permission groups', {
    status: groupsRes.status(),
    grantable: groups.filter((g) => g.grantable).map((g) => g.key),
    refused: groups.filter((g) => !g.grantable).map((g) => g.key),
  });

  const wanted = ['apps:change', 'observability:look'].filter((k) =>
    groups.some((g) => g.key === k && g.grantable),
  );
  const keyRes = await page.request.post(`${API}/api/v1/auth/api-keys`, {
    data: { name: 'e2e-local agent', groups: wanted },
  });
  const minted = keyRes.ok() ? await keyRes.json() : {};
  if (minted.key) secrets.push(minted.key);
  step('minted an agent credential', {
    status: keyRes.status(),
    groups: minted.groups,
    scopes: minted.scopes,
    keyReturned: Boolean(minted.key),
  });
  if (!minted.key) throw new Error('no credential came back — nothing more to prove');

  const list = await mcp(minted.key, 1, 'tools/list', {});
  const offered = (list.body?.result?.tools ?? []).map((t) => t.name).sort();
  step('the agent asks what it may do', { status: list.status, count: offered.length, offered });

  const apps = JSON.parse(toolText(await mcp(minted.key, 2, 'tools/call', {
    name: 'app_list', arguments: {},
  })) ?? '[]');
  step('the agent lists the applications', { count: apps.length, slugs: apps.map((a) => a.slug) });

  if (INSTALL) {
    const started = JSON.parse(toolText(await mcp(minted.key, 3, 'tools/call', {
      name: 'app_install', arguments: { slug: INSTALL, displayName: `e2e ${INSTALL}` },
    })) ?? '{}');
    step('the agent installs', { slug: INSTALL, operationId: started.operationId, status: started.status });
    for (let i = 0; i < 20 && started.operationId; i++) {
      await page.waitForTimeout(6_000);
      const op = JSON.parse(toolText(await mcp(minted.key, 4, 'tools/call', {
        name: 'operation_status', arguments: { operationId: started.operationId },
      })) ?? '{}');
      if (op.done) { step('the install finished', { status: op.status, error: op.error }); break; }
    }
  }

  if (apps[0]) {
    const logs = JSON.parse(toolText(await mcp(minted.key, 5, 'tools/call', {
      name: 'app_logs', arguments: { applicationId: apps[0].id, since: '24h' },
    })) ?? '{}');
    step('the agent reads its own logs', { app: apps[0].slug, lines: logs.count });
  }

  for (const [slug, route] of [
    ['applications', '/apps/applications'],
    ['databases', '/apps/databases'],
    ['tools', '/apps/tools'],
  ]) {
    await page.goto(`${DASH}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: path.join(OUT, `${slug}.png`), fullPage: true });
  }
  step('the screen', { shot: ['applications.png', 'databases.png', 'tools.png'] });

  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(OUT, 'report.json'), redact(JSON.stringify(report, null, 2)));
  await browser.close();
  console.log(`\nreport + screenshot in ${OUT}`);
}

main().catch((err) => {
  console.error(redact(err.stack || err.message));
  process.exit(1);
});
