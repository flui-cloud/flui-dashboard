/**
 * A guest removing one of its own applications, on screen.
 *
 * Usage:
 *   FLUI_SANDBOX_TOKEN=… FLUI_APP_NAME=<substring> node guest-delete.mjs [--headed] [--out DIR]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const trim = (s) => s.replace(/\/+$/, '');
const API = trim(process.env.FLUI_API_URL || 'http://localhost:3000');
const DASH = trim(process.env.FLUI_DASHBOARD_URL || 'http://localhost:4200');
const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const outFlag = args.indexOf('--out');
const OUT = path.resolve(
  outFlag >= 0 ? args[outFlag + 1] : process.env.FLUI_TOUR_OUT || 'out-delete',
);
const WANTED = process.env.FLUI_APP_NAME || '';
const TOKEN = process.env.FLUI_SANDBOX_TOKEN;
if (!TOKEN) throw new Error('FLUI_SANDBOX_TOKEN is required — this never claims');

const SETTLE = 2_500;
const shot = (page, name) =>
  page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  context.setDefaultTimeout(20_000);
  const page = await context.newPage();

  const http = [];
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/v1/applications'))
      http.push(`${r.status()} ${r.request().method()} ${u.pathname}`);
  });

  await page.goto(`${API}/api/v1/sandbox/resume?token=${encodeURIComponent(TOKEN)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(SETTLE);

  const json = async (url) => {
    const res = await page.request.get(url);
    return res.ok() ? res.json() : null;
  };
  const clusters = await json(`${API}/api/v1/infrastructure/clusters`);
  const clusterId = (Array.isArray(clusters) ? clusters : clusters?.data)?.[0]?.id;
  const apps = await json(`${API}/api/v1/clusters/${clusterId}/applications`);
  const list = Array.isArray(apps) ? apps : apps?.data ?? [];
  const target = list.find((a) => a.name.includes(WANTED)) ?? list[0];
  if (!target) throw new Error('this guest owns no application');

  const report = { application: { id: target.id, name: target.name }, steps: [] };

  await page.goto(`${DASH}/apps/applications/${target.id}/overview`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(SETTLE);
  await shot(page, '01-before');

  const danger = page.locator('button', { hasText: /^\s*Delete\s*$/ }).last();
  await danger.scrollIntoViewIfNeeded();
  report.steps.push({ step: 'delete control', visible: await danger.isVisible(), enabled: await danger.isEnabled() });
  await shot(page, '02-danger-zone');

  await danger.click();
  await page.waitForTimeout(1_200);
  const body = (await page.evaluate(() => document.body.innerText)) || '';
  report.steps.push({
    step: 'after pressing delete',
    askedToConfirm: /cannot be undone|are you sure|confirm/i.test(body),
  });
  await shot(page, '03-confirmation');

  const confirm = page
    .locator('button', { hasText: /^\s*(Delete|Confirm|Yes, delete)\s*$/ })
    .last();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
    await page.waitForTimeout(4_000);
  }
  await shot(page, '04-after');
  report.steps.push({ step: 'after confirming', url: page.url() });
  report.http = http;

  await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nscreenshots: ${OUT}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
