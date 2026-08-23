/**
 * The guest reads the ceiling, the session row and the last-seen trace on screen.
 *
 * Usage:
 *   node guest-ceiling.mjs [--headed] [--out DIR]
 *
 * Environment: as guest-keys.mjs.
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
  outFlag >= 0 ? args[outFlag + 1] : process.env.FLUI_KEYS_OUT || 'out-ceiling',
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

async function main() {
  await mkdir(OUT, { recursive: true });
  const report = { startedAt: new Date().toISOString(), api: API, dashboard: DASH, steps: [] };
  const step = (name, data) => {
    report.steps.push({ name, ...data });
    console.log(`${name}: ${redact(JSON.stringify(data)).slice(0, 320)}`);
  };

  const claimed = await claim();
  secrets.push(claimed.token);

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(25_000);

  await page.goto(`${API}/api/v1/sandbox/resume?token=${encodeURIComponent(claimed.token)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(SETTLE_MS);

  const keyField = page.locator('[data-testid="minted-key"]');
  const shot = (file) =>
    page.screenshot({ path: path.join(OUT, file), fullPage: true, mask: [keyField] });

  await page.goto(`${DASH}/settings#agent-keys`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid^="group-"]', { timeout: 20_000 });
  await page.waitForTimeout(SETTLE_MS);

  const blockedNodes = page.locator('[data-testid^="blocked-"]');
  const blockedCount = await blockedNodes.count();
  const sample = blockedCount
    ? (await blockedNodes.first().innerText()).replace(/\s+/g, ' ')
    : null;
  step('why a switch is off', {
    switchesWithAReason: blockedCount,
    switchesShownOff: await page.locator('[data-grantable="false"]').count(),
    firstReason: sample,
    namesAScope: /mcp:[a-z:]+/.test(sample ?? ''),
  });
  await shot('01-why-off.png');
  await blockedNodes
    .first()
    .locator('xpath=ancestor::label[1]')
    .screenshot({ path: path.join(OUT, '01b-the-reason.png') })
    .catch(() => {});

  await page.fill('[data-testid="key-name"]', 'giroh-guest-agent');
  await page.click('[data-testid="check-apps:change"]');
  await page.click('[data-testid="mint-key"]');
  await page.waitForSelector('[data-testid="minted-key"]', { timeout: 20_000 });
  await page.click('[data-testid="toggle-key"]');
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="minted-key"]')?.textContent?.includes('•'),
    { timeout: 5_000 },
  );
  const minted = (await keyField.innerText()).trim();
  secrets.push(minted);
  await page.click('[data-testid="toggle-key"]');
  await page.click('[data-testid="dismiss-minted"]');
  await page.waitForTimeout(SETTLE_MS);

  const invented = crypto.randomUUID();
  const call = async (method, url) => {
    const res = await fetch(`${API}/api/v1${url}`, {
      method,
      headers: { Authorization: `Bearer ${minted}`, 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, code: body.code ?? null, message: redact(body.message ?? '') };
  };
  step('the key deploys', await call('POST', `/applications/${invented}/rollback`));
  step('the key does not delete', await call('DELETE', `/applications/${invented}`));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid^="key-"]', { timeout: 20_000 });
  await page.waitForTimeout(SETTLE_MS);
  const marked = page.locator('[data-testid="current-key"]');
  const whens = await page.locator('[data-testid^="when-"]').allInnerTexts();
  step('which row is the session', {
    rowsMarkedCurrent: await marked.count(),
    lastSeenPhrases: whens.map((w) => w.replace(/\s+/g, ' ').split('·').pop().trim()),
  });
  await shot('02-the-rows.png');
  const list = page.locator('ul.divide-y').first();
  await list.scrollIntoViewIfNeeded().catch(() => {});
  await list.screenshot({ path: path.join(OUT, '02b-the-list.png') }).catch(() => {});

  const agentRow = page
    .locator('li[data-testid^="key-"]')
    .filter({ hasText: 'giroh-guest-agent' })
    .first();
  await agentRow.locator('[data-testid^="revoke-"]').click();
  await page.waitForTimeout(500);
  const dialog = page.locator('.fixed.inset-0').first();
  step('the question about a key that is not the session', {
    text: (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 400),
  });
  await shot('03-question-agent.png');
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('.fixed.inset-0 button:has-text("Cancel")').click().catch(() => {});
  await page.waitForTimeout(500);

  const sessionRow = page
    .locator('li[data-testid^="key-"]')
    .filter({ has: page.locator('[data-testid="current-key"]') })
    .first();
  await sessionRow.locator('[data-testid^="revoke-"]').click();
  await page.waitForTimeout(500);
  step('the question about the session itself', {
    text: (await page.locator('.fixed.inset-0').first().innerText())
      .replace(/\s+/g, ' ')
      .slice(0, 400),
  });
  await shot('04-question-session.png');
  await page.locator('.fixed.inset-0 button:has-text("Cancel")').click().catch(() => {});

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
