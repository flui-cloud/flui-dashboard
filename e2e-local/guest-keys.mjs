/**
 * The guest opens the keys screen, mints a key, uses it, and takes it back.
 *
 * Usage:
 *   node guest-keys.mjs [--headed] [--out DIR]
 *
 * Environment:
 *   FLUI_API_URL        default http://localhost:3000
 *   FLUI_DASHBOARD_URL  default http://localhost:4200
 *   FLUI_KEYS_OUT       default ./out-keys   (put it outside the repo)
 *   FLUI_SANDBOX_TOKEN / FLUI_SANDBOX_TOKEN_FILE
 *                       reuse a tenancy instead of spending a fresh one
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, chmod } from 'node:fs/promises';
import path from 'node:path';

const trimSlashes = (s) => {
  let out = s;
  while (out.endsWith('/')) out = out.slice(0, -1);
  return out;
};
const API = trimSlashes(process.env.FLUI_API_URL || 'http://localhost:3000');
const DASH = trimSlashes(process.env.FLUI_DASHBOARD_URL || 'http://localhost:4200');
const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const outFlag = args.indexOf('--out');
const OUT = path.resolve(
  outFlag >= 0 ? args[outFlag + 1] : process.env.FLUI_KEYS_OUT || 'out-keys',
);
const TOKEN_FILE = process.env.FLUI_SANDBOX_TOKEN_FILE;
const SETTLE_MS = 1_500;

const secrets = [];
const redact = (text) => {
  let out = String(text ?? '').replace(/([?&]token=)[^&\s]+/gi, '$1REDACTED');
  out = out.replace(/flui_[0-9a-f-]{8,}/gi, 'REDACTED');
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
    return { status: res.status, body: payload.slice(0, 200) };
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const report = { startedAt: new Date().toISOString(), api: API, dashboard: DASH, steps: [] };
  const step = (name, data) => {
    report.steps.push({ name, ...data });
    console.log(`${name}: ${redact(JSON.stringify(data)).slice(0, 260)}`);
  };

  const claimed = await claim();
  secrets.push(claimed.token);

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(25_000);

  await page.goto(`${API}/api/v1/sandbox/resume?token=${encodeURIComponent(claimed.token)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(SETTLE_MS);
  step('entered', {
    tokenSource: claimed.source,
    sessionCookie: (await context.cookies()).some((c) => c.name === 'flui_session'),
    landedOn: redact(page.url()),
  });

  const keyField = page.locator('[data-testid="minted-key"]');
  const shot = (file) => page.screenshot({ path: path.join(OUT, file), fullPage: true, mask: [keyField] });

  await page.goto(`${DASH}/settings#agent-keys`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid^="group-"]', { timeout: 20_000 });
  await page.waitForTimeout(SETTLE_MS);
  const groups = await page.locator('[data-testid^="group-"]').count();
  const refused = await page.locator('[data-grantable="false"]').count();
  if (groups === 0) throw new Error('no permission group rendered — the screen never loaded');
  step('the screen', {
    ceiling: (await page.locator('[data-testid="ceiling"]').innerText()).replace(/\s+/g, ' '),
    groupsShown: groups,
    switchedOffWithAReason: refused,
  });
  await shot('01-groups.png');

  await page.fill('[data-testid="key-name"]', 'girof-guest-agent');
  await page.click('[data-testid="check-apps:change"]');
  await page.click('[data-testid="mint-key"]');
  await page.waitForSelector('[data-testid="minted-key"]', { timeout: 20_000 });
  await page.waitForTimeout(500);
  await shot('02-minted.png');

  await page.click('[data-testid="toggle-key"]');
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="minted-key"]')?.textContent?.includes('•'),
    { timeout: 5_000 },
  );
  const minted = (await keyField.innerText()).trim();
  secrets.push(minted);
  await page.click('[data-testid="toggle-key"]');
  step('minted through the screen', {
    lookedLikeAKey: minted.startsWith('flui_'),
    maskedByDefault: true,
  });

  const list = await mcp(minted, 1, 'tools/list', {});
  const offered = (list.body?.result?.tools ?? []).map((t) => t.name);
  step('the agent uses it', {
    status: list.status,
    toolsOffered: offered.length,
    appLogsOffered: offered.includes('app_logs'),
  });

  await page.click('[data-testid="dismiss-minted"]');
  await page.waitForTimeout(SETTLE_MS);
  await shot('03-list.png');

  const legacy = await page.request.post(`${API}/api/v1/auth/api-keys`, {
    data: {
      name: 'girof-legacy-shape',
      scopes: ['mcp:catalog:read', 'mcp:app:read', 'mcp:spec:validate', 'mcp:app:write'],
    },
  });
  const legacyBody = legacy.ok() ? await legacy.json() : {};
  if (legacyBody.key) secrets.push(legacyBody.key);
  step('a key from before the group changed', {
    status: legacy.status(),
    groupsTheServerReads: legacyBody.groups,
    ungroupedScopes: legacyBody.ungroupedScopes,
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector(`[data-testid="key-${legacyBody.id}"]`, { timeout: 20_000 });
  await page.waitForTimeout(SETTLE_MS);
  const wider = page.locator('[data-testid="beyond-groups"]');
  step('how the screen reads it', {
    badge: (await wider.count()) ? await wider.first().innerText() : null,
    headline: await page
      .locator(`[data-testid="headline-${legacyBody.id}"]`)
      .innerText()
      .catch(() => null),
    caution: (
      await page
        .locator(`[data-testid="caution-${legacyBody.id}"]`)
        .innerText()
        .catch(() => '')
    ).replace(/\s+/g, ' '),
  });
  const row = page.locator(`[data-testid="key-${legacyBody.id}"]`);
  await row.scrollIntoViewIfNeeded().catch(() => {});
  await shot('04-wider-than-its-name.png');
  await row.screenshot({ path: path.join(OUT, '04b-the-row.png') }).catch(() => {});

  await page.click(`[data-testid="revoke-${legacyBody.id}"]`);
  await page.waitForTimeout(500);
  await shot('05-the-question.png');
  await page.click('.fixed.inset-0 button:has-text("Revoke")');
  await page.waitForTimeout(SETTLE_MS);
  const mintedRow = page.locator('[data-testid^="revoke-"]').first();
  await mintedRow.click();
  await page.click('.fixed.inset-0 button:has-text("Revoke")');
  await page.waitForTimeout(SETTLE_MS);
  await shot('06-revoked.png');

  const after = await page.request.get(`${API}/api/v1/auth/api-keys`);
  const rows = after.ok() ? await after.json() : [];
  step('after revoking', {
    keysStillLive: rows.filter((k) => !k.revoked).length,
    revokedRows: rows.filter((k) => k.revoked).map((k) => k.name),
  });

  const dead = await mcp(minted, 2, 'tools/list', {});
  step('the revoked key is refused', { status: dead.status });

  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(OUT, 'report.json'), redact(JSON.stringify(report, null, 2)));
  await browser.close();
  console.log(`\nreport + screenshots in ${OUT}`);
}

try {
  await main();
} catch (err) {
  console.error(redact(err.stack || err.message));
  process.exit(1);
}
