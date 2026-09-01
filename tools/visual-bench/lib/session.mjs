/**
 * Turns the file auth-capture.mjs wrote into a real, authenticated browser
 * context. See auth-capture.mjs's header comment for why this is two halves
 * (native storageState + a manually re-injected sessionStorage) instead of
 * one.
 */
import { readFile } from 'node:fs/promises';
import { AUTH_FILE } from './config.mjs';

export async function loadReferenceSession() {
  let raw;
  try {
    raw = await readFile(AUTH_FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `No captured session at ${AUTH_FILE}. Run "npm run auth" first (see tools/visual-bench/README.md).`,
      );
    }
    throw err;
  }
  return JSON.parse(raw);
}

/**
 * Creates an authenticated context: native storageState restores cookies +
 * localStorage, then one addInitScript replays the captured sessionStorage
 * into every new document this context opens (sessionStorage is reset on
 * each fresh document, so this has to be an init script, not a one-time
 * write).
 */
export async function newAuthenticatedContext(browser, session, contextOptions) {
  const context = await browser.newContext({
    ...contextOptions,
    storageState: session.storageState,
  });

  for (const [origin, entries] of Object.entries(session.sessionStorage ?? {})) {
    await context.addInitScript(
      ({ origin: targetOrigin, entries: kv }) => {
        if (window.location.origin !== targetOrigin) return;
        try {
          for (const [key, value] of Object.entries(kv)) {
            window.sessionStorage.setItem(key, value);
          }
        } catch {
          // sessionStorage can throw in a locked-down context; nothing to do.
        }
      },
      { origin, entries },
    );
  }

  return context;
}

export async function newAnonymousContext(browser, contextOptions) {
  return browser.newContext(contextOptions);
}
