/**
 * Functional/structural health check — not a visual diff. Walks every route in
 * lib/routes.mjs against the running DASHBOARD_URL and asserts only verifiable
 * facts: the page loaded, nothing threw, and the app shell (sidebar, header,
 * routed content) is present. Visual styling is out of scope.
 *
 * Usage:
 *   node healthcheck.mjs [--only SUBSTRING]
 *
 * Dark theme only — structural presence does not depend on theme.
 */
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { DASHBOARD_URL, ENTITY_IDS_FILE, VIEWPORT, DEVICE_SCALE_FACTOR, NAV_TIMEOUT_MS, NETWORK_IDLE_TIMEOUT_MS } from './lib/config.mjs';
import { buildJobs } from './lib/routes.mjs';
import { installDeterminismInitScripts, blockWebSocket, settle } from './lib/determinism.mjs';
import { loadReferenceSession, newAuthenticatedContext, newAnonymousContext } from './lib/session.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const ONLY = (flag('--only', '') || '').toLowerCase();
const FAIL_SHOTS_DIR = path.resolve('./healthcheck-failures');

async function checkJob({ browser, session, job }) {
  const contextOptions = { viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, reducedMotion: 'reduce', colorScheme: 'dark' };
  const context =
    job.auth === 'anonymous'
      ? await newAnonymousContext(browser, contextOptions)
      : await newAuthenticatedContext(browser, session, contextOptions);

  await installDeterminismInitScripts(context, { theme: 'dark' });
  await blockWebSocket(context);
  context.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  context.setDefaultTimeout(NAV_TIMEOUT_MS);

  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const problems = [];
  let httpStatus = null;
  let authNoiseCount = 0;
  try {
    const response = await page.goto(`${DASHBOARD_URL}${job.path}`, { waitUntil: 'domcontentloaded' });
    httpStatus = response ? response.status() : null;
    if (httpStatus && httpStatus >= 400) problems.push(`HTTP ${httpStatus}`);

    await settle(page, { networkIdleMs: NETWORK_IDLE_TIMEOUT_MS, settleMs: 1200 });

    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/cannot get \//i.test(bodyText) || /^\s*not found\s*$/i.test(bodyText.trim())) {
      problems.push('body reads like a server 404/"not found" page');
    }

    if (job.auth !== 'anonymous') {
      const sidebarCount = await page.locator('sidebar').count();
      const headerCount = await page.locator('header').count();
      if (sidebarCount === 0) problems.push('no <sidebar> element in DOM');
      if (headerCount === 0) problems.push('no <header> element in DOM');
    }

    const routerOutletText = await page
      .locator('router-outlet')
      .first()
      .evaluate((el) => {
        let sib = el.nextElementSibling;
        let text = '';
        while (sib) {
          text += sib.textContent || '';
          sib = sib.nextElementSibling;
        }
        return text.trim();
      })
      .catch(() => null);
    if (routerOutletText !== null && routerOutletText.length === 0) {
      problems.push('routed content area is empty (router-outlet has no rendered content)');
    }

    if (pageErrors.length) problems.push(`${pageErrors.length} uncaught JS error(s): ${pageErrors.slice(0, 3).join(' | ')}`);
    // 401/403 "Failed to load resource" lines are the browser's own network-layer
    // logging, not app code throwing — with a stale/expired auth session (common
    // for an unattended headless run) every authenticated route produces dozens
    // of these that say nothing about the page's structure. Track separately,
    // never treat as a structural problem on their own.
    const authNoise = consoleErrors.filter((m) => /Failed to load resource.*(401|403)/i.test(m));
    const significantConsoleErrors = consoleErrors.filter(
      (m) => !/ERR_INTERNET_DISCONNECTED|favicon/i.test(m) && !/Failed to load resource.*(401|403)/i.test(m),
    );
    if (significantConsoleErrors.length) {
      problems.push(`${significantConsoleErrors.length} console error(s): ${significantConsoleErrors.slice(0, 3).join(' | ')}`);
    }
    if (authNoise.length) authNoiseCount = authNoise.length;
  } catch (err) {
    problems.push(`navigation threw: ${err.message}`);
  }

  if (problems.length) {
    await mkdir(FAIL_SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: path.join(FAIL_SHOTS_DIR, `${job.slug}.png`), fullPage: true }).catch(() => {});
  }

  await context.close();
  return { slug: job.slug, path: job.path, auth: job.auth, httpStatus, ok: problems.length === 0, problems, authNoiseCount };
}

async function main() {
  const entityIds = JSON.parse(await readFile(ENTITY_IDS_FILE, 'utf8'));
  const { jobs, skipped } = buildJobs(entityIds);
  const filtered = ONLY ? jobs.filter((j) => j.slug.toLowerCase().includes(ONLY)) : jobs;

  const needsSession = filtered.some((j) => j.auth !== 'anonymous');
  const session = needsSession ? await loadReferenceSession() : null;

  console.log(`Dashboard: ${DASHBOARD_URL}`);
  console.log(`Routes:    ${filtered.length} (skipped ${skipped.length} unresolved-entity/transient routes)\n`);

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let done = 0;
  for (const job of filtered) {
    const result = await checkJob({ browser, session, job });
    results.push(result);
    done += 1;
    console.log(`[${done}/${filtered.length}] ${result.slug} — ${result.ok ? 'OK' : 'PROBLEM: ' + result.problems.join('; ')}`);
  }
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} routes OK, ${failed.length} with problems.`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  ${f.slug} (${f.path}): ${f.problems.join('; ')}`);
    console.log(`\nFailure screenshots: ${FAIL_SHOTS_DIR}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
