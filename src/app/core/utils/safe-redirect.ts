import { environment } from '../../../environments/environment';

export const REDIRECT_KEY = 'flui_login_redirect';
export const LOOP_GUARD_PREFIX = 'flui_loop_guard:';
export const LOOP_GUARD_WINDOW_MS = 30_000;
export const LOOP_GUARD_MAX_ATTEMPTS = 3;

export interface LoopGuardState {
  count: number;
  firstAt: number;
}

export function bumpLoopGuard(redirect: string): LoopGuardState {
  const key = LOOP_GUARD_PREFIX + redirect;
  const now = Date.now();
  const raw = sessionStorage.getItem(key);
  let state: LoopGuardState | null = null;
  if (raw) {
    try { state = JSON.parse(raw) as LoopGuardState; } catch { state = null; }
  }
  if (!state || now - state.firstAt > LOOP_GUARD_WINDOW_MS) {
    state = { count: 1, firstAt: now };
  } else {
    state.count += 1;
  }
  sessionStorage.setItem(key, JSON.stringify(state));
  return state;
}

export function clearLoopGuard(redirect: string): void {
  sessionStorage.removeItem(LOOP_GUARD_PREFIX + redirect);
}

export function isSafeRedirect(url: string): boolean {
  // Same-origin relative path (e.g. `/apps/repositories/github-setup?x=1`).
  // Reject protocol-relative (`//host`) and backslash tricks to avoid open redirects.
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) {
    return true;
  }
  try {
    const { hostname } = new URL(url);
    if (hostname.endsWith('.flui.cloud') || hostname === 'flui.cloud') return true;
    if (!environment.production && (hostname === 'localhost' || hostname === '127.0.0.1')) return true;
    return false;
  } catch {
    return false;
  }
}

export function consumeLoginRedirect(): string | null {
  const redirect = sessionStorage.getItem(REDIRECT_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);
  return redirect && isSafeRedirect(redirect) ? redirect : null;
}
