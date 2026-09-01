/**
 * One-off, headed capture of a real login. Run by hand, once (and again
 * whenever the saved session stops working — see README > Session expiry).
 *
 * Why this exists at all: angular-oauth2-oidc keeps its tokens in
 * sessionStorage by default (no OAuthStorage provider is configured — see
 * app.config.ts / oidc-auth.service.ts), and Playwright's
 * context.storageState() only serializes cookies + localStorage, never
 * sessionStorage (confirmed by reading
 * node_modules/playwright-core/lib/coreBundle.js's StorageScript.collect() —
 * it reads window.localStorage only). So this script captures BOTH: the
 * native storageState (cookies + localStorage, e.g. the sandbox/flui_session
 * cookie and the flui-theme key) AND the dashboard origin's sessionStorage
 * (the actual OIDC tokens), side by side in one JSON file. capture.mjs
 * re-injects the sessionStorage half via context.addInitScript() on every
 * new context, since that's the only thing storageState can't do natively.
 *
 * Usage:
 *   node auth-capture.mjs
 *
 * Environment:
 *   FLUI_DASHBOARD_URL   default http://localhost:4200
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DASHBOARD_URL, AUTH_FILE, VIEWPORT } from './lib/config.mjs';

async function main() {
  await mkdir(path.dirname(AUTH_FILE), { recursive: true });

  console.log(`Opening ${DASHBOARD_URL}/login ...`);
  console.log('Log in by hand in the browser window. When the dashboard shell has');
  console.log('loaded (you are past /login and /auth/callback), come back to this');
  console.log('terminal and press the Playwright Inspector "Resume" button (▶) —');
  console.log('or just close the Inspector window — to let the script continue.\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await page.goto(`${DASHBOARD_URL}/login`, { waitUntil: 'domcontentloaded' });

  // Pauses the script and opens the Playwright Inspector. The human drives
  // the real OIDC redirect to Zitadel and back by hand; nothing here
  // automates the login form itself, on purpose — this bench never touches
  // credentials.
  await page.pause();

  // Give the post-login redirect (auth/callback -> the guarded shell) a
  // moment to actually land before reading storage.
  await page.waitForTimeout(1_000);

  const url = page.url();
  const onDashboard = !url.includes('/login') && !url.includes('/auth/callback');
  if (!onDashboard) {
    console.warn(`\nWarning: current URL is ${url} — this doesn't look like a completed login.`);
    console.warn('Saving anyway; check the output before trusting it.\n');
  }

  const storageState = await context.storageState();
  const sessionStorageEntries = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      out[key] = window.sessionStorage.getItem(key);
    }
    return out;
  });

  const origin = new URL(DASHBOARD_URL).origin;
  const hasAccessToken = Boolean(sessionStorageEntries.access_token);
  const hasRefreshToken = Boolean(sessionStorageEntries.refresh_token);

  const payload = {
    capturedAt: new Date().toISOString(),
    dashboardUrl: DASHBOARD_URL,
    landedOn: url,
    // Native Playwright storageState — cookies + localStorage only.
    storageState,
    // The half storageState can't carry: angular-oauth2-oidc's sessionStorage
    // keys, scoped to the dashboard's own origin.
    sessionStorage: { [origin]: sessionStorageEntries },
    diagnostics: {
      hasAccessToken,
      hasRefreshToken,
      expiresAt: sessionStorageEntries.expires_at
        ? new Date(Number(sessionStorageEntries.expires_at)).toISOString()
        : null,
    },
  };

  await writeFile(AUTH_FILE, JSON.stringify(payload, null, 2), { mode: 0o600 });
  await browser.close();

  console.log(`Saved to ${AUTH_FILE}`);
  console.log(`  access_token present:  ${hasAccessToken}`);
  console.log(`  refresh_token present: ${hasRefreshToken}${hasRefreshToken ? '' : '  (no silent renewal — the captured session expires with the access token, not the refresh window)'}`);
  if (payload.diagnostics.expiresAt) {
    console.log(`  access_token expires:  ${payload.diagnostics.expiresAt}`);
  }
  if (!hasAccessToken) {
    console.error('\nNo access_token found in sessionStorage — the capture below is not usable for auth reuse.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
