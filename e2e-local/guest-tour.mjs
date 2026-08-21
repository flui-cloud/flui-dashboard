/**
 * A guest's tour of the dashboard, driven from one command.
 *
 * Usage:
 *   node guest-tour.mjs [--headed] [--out DIR]
 *
 * Environment:
 *   FLUI_API_URL        default http://localhost:3000
 *   FLUI_DASHBOARD_URL  default http://localhost:4200
 *   FLUI_TOUR_OUT       default ./out   (put it outside the repo)
 *   FLUI_TOUR_ONLY      comma-separated stop ids, e.g. 00,04,20
 *   FLUI_SANDBOX_TOKEN  reuse a tenancy instead of claiming a new one
 *   FLUI_SANDBOX_TOKEN_FILE
 *                       where to keep that credential between runs, 0600.
 *                       Keep this file outside every repository.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, chmod } from 'node:fs/promises';
import path from 'node:path';

const trimSlashes = (s) => {
  let end = s.length;
  while (end > 0 && s[end - 1] === '/') end -= 1;
  return s.slice(0, end);
};
const API = trimSlashes(process.env.FLUI_API_URL || 'http://localhost:3000');
const DASH = trimSlashes(process.env.FLUI_DASHBOARD_URL || 'http://localhost:4200');
const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const outFlag = args.indexOf('--out');
const OUT = path.resolve(
  outFlag >= 0 ? args[outFlag + 1] : process.env.FLUI_TOUR_OUT || 'out',
);

const STOPS = [
  ['00-home', '/dashboard', 'full', 'Dashboard'],
  ['01-clusters', '/cluster', 'read-only', 'Clusters'],
  ['02-compute', '/infrastructure/compute', 'stand-in', 'Compute (providers)'],
  ['03-vnet', '/infrastructure/vnet', 'stand-in', 'Virtual Networks'],
  ['04-keys', '/infrastructure/keys', 'closed', 'SSH Keys'],
  ['05-domains', '/infrastructure/domains', 'stand-in', 'Domains'],
  ['06-platform', '/infrastructure/platform-components', 'read-only', 'Platform'],
  ['07-firewall', '/infrastructure/firewall/clusters', 'stand-in', 'Cluster Firewalls'],
  ['08-catalog', '/apps/catalog', 'full', 'App Catalog'],
  ['09-repositories', '/apps/repositories', 'full', 'Repositories'],
  ['10-templates', '/apps/templates', 'full', 'Templates'],
  ['11-deploy-new', '/apps/deploy/new', 'full', 'Deploy New'],
  ['12-applications', '/apps/applications', 'full', 'Applications'],
  ['13-databases', '/apps/databases', 'full', 'Databases'],
  ['14-tools', '/apps/tools', 'full', 'Tools'],
  ['15-system', '/apps/system', 'full', 'System apps'],
  ['16-providers', '/management/providers', 'stand-in', 'Providers'],
  ['17-backup', '/management/backup', 'stand-in', 'Backup'],
  ['18-migrations', '/management/migrations', 'read-only', 'Migrations'],
  ['19-mail', '/management/mail', 'stand-in', 'Mail'],
  ['20-access', '/management/access', 'stand-in', 'Access'],
  ['21-projects', '/management/projects', 'full', 'Projects'],
  ['22-settings', '/settings', 'mixed', 'Settings'],
  ['23-github-setup', '/apps/repositories/github-setup', 'closed', 'GitHub Setup'],
];

async function ownApplicationStop(page) {
  const json = async (url) => {
    const res = await page.request.get(url, { timeout: 10_000 });
    return res.ok() ? res.json() : null;
  };
  const clusters = await json(`${API}/api/v1/infrastructure/clusters`);
  const clusterId = (Array.isArray(clusters) ? clusters : clusters?.data)?.[0]?.id;
  if (!clusterId) return null;
  const apps = await json(`${API}/api/v1/clusters/${clusterId}/applications`);
  const appId = (Array.isArray(apps) ? apps : apps?.data)?.[0]?.id;
  return appId
    ? ['24-own-app', `/apps/applications/${appId}/overview`, 'full', 'The guest’s own application']
    : null;
}

const NAV_TIMEOUT = 20_000;
const SETTLE_MS = 2_500;

function redact(text, token) {
  if (!text) return text;
  const stripped = String(text).replace(/([?&]token=)[^&\s]+/gi, '$1REDACTED');
  return token ? stripped.split(token).join('REDACTED') : stripped;
}

const TOKEN_FILE = process.env.FLUI_SANDBOX_TOKEN_FILE;

async function claim() {
  const existing = process.env.FLUI_SANDBOX_TOKEN;
  if (existing) return { token: existing, resumed: true, source: 'environment' };

  if (TOKEN_FILE) {
    const saved = await readFile(TOKEN_FILE, 'utf8').catch(() => '');
    if (saved.trim()) {
      return { token: saved.trim(), resumed: true, source: 'token file' };
    }
  }

  const res = await fetch(`${API}/api/v1/sandbox/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `claim failed: ${res.status} ${body.code || ''} ${body.message || ''}`.trim(),
    );
  }
  if (!body.apiKey) {
    throw new Error(
      'the API resumed an existing tenancy and returned no credential — pass FLUI_SANDBOX_TOKEN',
    );
  }
  if (TOKEN_FILE) {
    await writeFile(TOKEN_FILE, body.apiKey, { mode: 0o600 });
    await chmod(TOKEN_FILE, 0o600).catch(() => {});
  }
  return {
    token: body.apiKey,
    resumed: Boolean(body.resumed),
    expiresAt: body.expiresAt,
    source: 'POST /sandbox/claim',
  };
}

function readPage() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const txt = (el) => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');

  const headings = [...document.querySelectorAll('h1,h2')].filter(vis).map(txt).filter(Boolean).slice(0, 12);

  const NOTICE = /(read-only in the trial|example data|not part of the trial|in the trial|sandbox|trial)/i;
  const notices = [...document.querySelectorAll('*')]
    .filter((el) => el.children.length === 0 && vis(el) && NOTICE.test(txt(el)))
    .map(txt)
    .filter((t) => t.length < 300);

  const RED = /(text-red|text-destructive|bg-red|bg-destructive|border-red|destructive)/;
  const reds = [...document.querySelectorAll('[class]')]
    .filter((el) => RED.test(el.className.baseVal || el.className || '') && vis(el))
    .map(txt)
    .filter((t) => t && t.length < 300);

  const FAIL = /(failed|error|forbidden|unauthori[sz]ed|denied|not allowed|something went wrong|403|500)/i;
  const failWords = [...document.querySelectorAll('*')]
    .filter((el) => el.children.length === 0 && vis(el) && FAIL.test(txt(el)))
    .map(txt)
    .filter((t) => t.length < 300);

  const buttons = [...document.querySelectorAll('button, a[role=button]')]
    .filter(vis)
    .map((b) => ({
      label: (
        txt(b) ||
        b.getAttribute('aria-label') ||
        b.getAttribute('title') ||
        '(icon-only)'
      ).slice(0, 60),
      disabled:
        b.matches(':disabled') ||
        b.getAttribute('aria-disabled') === 'true' ||
        getComputedStyle(b).pointerEvents === 'none',
    }));

  const nav = [...document.querySelectorAll('nav a[href], aside a[href]')]
    .filter(vis)
    .map((a) => ({ label: txt(a).slice(0, 40), href: a.getAttribute('href') }))
    .filter((a) => a.label);

  return {
    headings,
    notices: [...new Set(notices)].slice(0, 20),
    reds: [...new Set(reds)].slice(0, 20),
    failWords: [...new Set(failWords)].slice(0, 20),
    buttons: buttons.slice(0, 60),
    nav: nav.slice(0, 40),
    bodyChars: (document.body.innerText || '').trim().length,
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const claimed = await claim();
  const token = claimed.token;

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    ignoreHTTPSErrors: true,
  });
  context.setDefaultNavigationTimeout(NAV_TIMEOUT);
  context.setDefaultTimeout(NAV_TIMEOUT);

  const page = await context.newPage();

  let http = [];
  let consoleErrors = [];
  page.on('response', (res) => {
    if (res.status() >= 400) {
      const u = new URL(res.url());
      http.push({ status: res.status(), method: res.request().method(), path: u.pathname });
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(redact(msg.text(), token).slice(0, 300));
  });
  page.on('pageerror', (err) => consoleErrors.push(redact(`pageerror: ${err.message}`, token).slice(0, 300)));

  const report = {
    startedAt: new Date().toISOString(),
    api: API,
    dashboard: DASH,
    entry: { via: 'GET /api/v1/sandbox/resume', tokenSource: claimed.source, resumed: claimed.resumed },
    stops: [],
  };

  await page.goto(`${API}/api/v1/sandbox/resume?token=${encodeURIComponent(token)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(SETTLE_MS);
  report.entry.landedOn = redact(page.url(), token);
  const cookies = await context.cookies();
  report.entry.sessionCookieSet = cookies.some((c) => c.name === 'flui_session');
  await page.screenshot({ path: path.join(OUT, 'entry.png'), fullPage: true });
  http = [];
  consoleErrors = [];

  const only = (process.env.FLUI_TOUR_ONLY || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const own = await ownApplicationStop(page).catch(() => null);
  const all = own ? [...STOPS, own] : STOPS;
  const stops = only.length
    ? all.filter(([slug]) => only.some((o) => slug.startsWith(o)))
    : all;
  report.ownApplicationFound = Boolean(own);

  for (const [slug, route, expected, name] of stops) {
    const stop = { slug, route, expectedLevel: expected, name };
    try {
      await page.goto(`${DASH}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(SETTLE_MS);
      stop.url = redact(page.url(), token);
      stop.title = await page.title();
      Object.assign(stop, await page.evaluate(readPage));
      await page.screenshot({ path: path.join(OUT, `${slug}.png`), fullPage: true });
    } catch (err) {
      stop.error = redact(err.message, token).slice(0, 300);
      await page
        .screenshot({ path: path.join(OUT, `${slug}-error.png`), fullPage: true })
        .catch(() => {});
    }
    stop.http = http;
    stop.consoleErrors = consoleErrors;
    http = [];
    consoleErrors = [];
    report.stops.push(stop);
    const refusals = stop.http.filter((h) => h.status === 401 || h.status === 403).length;
    console.log(
      `${slug.padEnd(18)} ${String(stop.title || '').slice(0, 34).padEnd(36)} ` +
        `notices=${(stop.notices || []).length} red=${(stop.reds || []).length} ` +
        `4xx/5xx=${stop.http.length} (401/403=${refusals})` +
        (stop.error ? `  ERROR ${stop.error}` : ''),
    );
  }

  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(`\nreport + screenshots: ${OUT}`);
}

const watchdog = setTimeout(
  () => {
    console.error('watchdog: the tour did not finish in 10 minutes — giving up');
    process.exit(2);
  },
  10 * 60 * 1000,
);
watchdog.unref?.();

main().catch((err) => {
  console.error('tour failed:', err.message);
  process.exit(1);
});
