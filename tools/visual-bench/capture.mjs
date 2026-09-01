/**
 * Captures one screenshot per route+state job from lib/routes.mjs, reusing
 * the session auth-capture.mjs saved — never re-authenticating per shot.
 *
 * Usage:
 *   node capture.mjs [--out DIR] [--only SUBSTRING] [--themes dark,light]
 *
 * --out defaults to lib/config.mjs's DEFAULT_OUT_DIR
 *   (/Users/dawit/Project/flui/visual-reference/angular-19).
 * --only filters jobs whose slug contains SUBSTRING (case-insensitive) —
 *   handy while iterating on one route without redoing a full run.
 * --themes restricts which theme variants run (default: both from config).
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DASHBOARD_URL,
  DASHBOARD_REPO,
  DEFAULT_OUT_DIR,
  MANIFEST_FILENAME,
  ENTITY_IDS_FILE,
  VIEWPORT,
  DEVICE_SCALE_FACTOR,
  THEMES,
  NAV_TIMEOUT_MS,
  NETWORK_IDLE_TIMEOUT_MS,
  DEFAULT_SETTLE_MS,
  CHART_SETTLE_MS,
} from './lib/config.mjs';
import { buildJobs } from './lib/routes.mjs';
import { installDeterminismInitScripts, blockWebSocket, settle } from './lib/determinism.mjs';
import { loadReferenceSession, newAuthenticatedContext, newAnonymousContext } from './lib/session.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT_DIR = path.resolve(flag('--out', DEFAULT_OUT_DIR));
const ONLY = (flag('--only', '') || '').toLowerCase();
const themesArg = flag('--themes', '');
const RUN_THEMES = themesArg ? themesArg.split(',').map((s) => s.trim()) : THEMES;

function dashboardGitInfo() {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: DASHBOARD_REPO }).toString().trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: DASHBOARD_REPO }).toString().trim().length > 0;
    return { commit, dirty };
  } catch {
    return { commit: 'unknown', dirty: null };
  }
}

async function shootJob({ browser, session, job, theme }) {
  const contextOptions = {
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    reducedMotion: 'reduce',
    colorScheme: theme === 'light' ? 'light' : 'dark',
  };
  const context =
    job.auth === 'anonymous'
      ? await newAnonymousContext(browser, contextOptions)
      : await newAuthenticatedContext(browser, session, contextOptions);

  await installDeterminismInitScripts(context, { theme });
  await blockWebSocket(context);
  context.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  context.setDefaultTimeout(NAV_TIMEOUT_MS);

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  const fileName = `${job.slug}--${theme}.png`;
  const filePath = path.join(OUT_DIR, fileName);
  let error = null;
  try {
    await page.goto(`${DASHBOARD_URL}${job.path}`, { waitUntil: 'domcontentloaded' });
    await settle(page, {
      networkIdleMs: NETWORK_IDLE_TIMEOUT_MS,
      settleMs: job.chartHeavy ? CHART_SETTLE_MS : DEFAULT_SETTLE_MS,
    });
    await page.screenshot({ path: filePath, fullPage: true });
  } catch (err) {
    error = err.message;
  } finally {
    await context.close();
  }

  return {
    slug: job.slug,
    path: job.path,
    theme,
    auth: job.auth,
    chartHeavy: Boolean(job.chartHeavy),
    file: error ? null : fileName,
    note: job.note,
    error,
    consoleErrors: consoleErrors.length ? consoleErrors.slice(0, 10) : undefined,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const entityIds = JSON.parse(await readFile(ENTITY_IDS_FILE, 'utf8'));
  const { jobs, skipped } = buildJobs(entityIds);
  const filtered = ONLY ? jobs.filter((j) => j.slug.toLowerCase().includes(ONLY)) : jobs;

  const needsSession = filtered.some((j) => j.auth !== 'anonymous');
  const session = needsSession ? await loadReferenceSession() : null;

  console.log(`Dashboard: ${DASHBOARD_URL}`);
  console.log(`Out dir:   ${OUT_DIR}`);
  console.log(`Jobs:      ${filtered.length} routes × ${RUN_THEMES.length} theme(s) = ${filtered.length * RUN_THEMES.length} shots`);
  console.log(`Skipped:   ${skipped.length} (unresolved entity ids / transient routes — see manifest)\n`);

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let done = 0;
  const total = filtered.length * RUN_THEMES.length;

  for (const theme of RUN_THEMES) {
    for (const job of filtered) {
      const result = await shootJob({ browser, session, job, theme });
      results.push(result);
      done += 1;
      const status = result.error ? `ERROR: ${result.error}` : 'ok';
      console.log(`[${done}/${total}] ${result.slug} (${theme}) — ${status}`);
    }
  }

  await browser.close();

  const { commit, dirty } = dashboardGitInfo();
  const manifest = {
    dashboardGitCommit: commit,
    dashboardGitDirty: dirty,
    dashboardUrl: DASHBOARD_URL,
    themes: RUN_THEMES,
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    entityIds,
    routes: results.toSorted((a, b) => (a.slug + a.theme).localeCompare(b.slug + b.theme)),
    skipped: skipped.toSorted((a, b) => a.slug.localeCompare(b.slug)),
    // Real wall-clock time this run happened. Deliberately NOT used anywhere
    // that affects a screenshot (see FROZEN_NOW_ISO in lib/config.mjs) — the
    // verify script excludes this one field when diffing two manifests.
    generatedAt: new Date().toISOString(),
  };
  await writeFile(path.join(OUT_DIR, MANIFEST_FILENAME), JSON.stringify(manifest, null, 2));

  const errors = results.filter((r) => r.error);
  console.log(`\nDone. ${results.length - errors.length}/${results.length} shots ok, ${errors.length} errored, ${skipped.length} skipped.`);
  console.log(`Manifest: ${path.join(OUT_DIR, MANIFEST_FILENAME)}`);
  if (errors.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
