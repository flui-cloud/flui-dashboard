/**
 * Neutralises every determinism hazard the survey found, in one place, so
 * capture.mjs stays a plain loop over routes. See
 * tools/visual-bench/README.md#determinism for the mapping back to the
 * survey's numbered hazard list.
 */
import { FROZEN_NOW_ISO } from './config.mjs';

// Hazard #1 (relative-time text) — override Date/Date.now to a fixed instant
// before any app script runs. This is a plain Date patch, not
// page.clock.install(): the clock API also fakes setTimeout/setInterval/
// requestAnimationFrame, which would freeze ngx-echarts' rAF-driven entrance
// animation mid-frame instead of letting it finish. Real timers keep
// running; only "what time is it" is pinned.
function installFrozenDate(isoString) {
  const fixed = new Date(isoString).getTime();
  const RealDate = Date;
  class FrozenDate extends RealDate {
    constructor(...args) {
      super(...(args.length === 0 ? [fixed] : args));
    }
    static now() {
      return fixed;
    }
  }
  window.Date = FrozenDate;
}

export async function installDeterminismInitScripts(context, { theme }) {
  await context.addInitScript(installFrozenDate, FROZEN_NOW_ISO);

  // Hazard #4 (theme defaults from localStorage) — seed the exact key
  // theme.service.ts reads, before its constructor runs, every single time.
  await context.addInitScript((themeValue) => {
    try {
      window.localStorage.setItem('flui-theme', themeValue);
    } catch {
      // localStorage can throw in a locked-down context; nothing to seed then.
    }
  }, theme === 'light' ? 'light' : 'dark');

  // Belt-and-suspenders on top of the `reducedMotion: 'reduce'` context
  // option: force every CSS transition/animation to complete instantly, for
  // the DOM elements prefers-reduced-motion media queries don't reach.
  await context.addInitScript(() => {
    const style = document.createElement('style');
    style.dataset.visualBench = 'kill-animations';
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-delay: -0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        transition-delay: 0ms !important;
        scroll-behavior: auto !important;
        caret-color: transparent !important;
      }
    `;
    const attach = () => document.head?.appendChild(style);
    if (document.head) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
  });
}

// Hazard #3 (WebSocket push) — abort socket.io's handshake outright so no
// stray toast or badge-count update can land mid-capture. socket.io always
// starts with an HTTP request to /socket.io/... (polling probe) even when it
// upgrades to a websocket next, so aborting that path is enough.
export async function blockWebSocket(context) {
  await context.route('**/socket.io/**', (route) => route.abort());
}

// Hazard #6 (webfont swap race) — wait for the actual font files to be
// loaded and applied, not just for the stylesheet request to resolve.
export async function waitForFonts(page) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
}

// Generic settle: network-idle (bounded, since some routes poll forever)
// plus a fixed real-time wait. Never a bare `waitForTimeout` alone — that
// hides real navigation failures — and never a bare network-idle alone,
// since ngx-echarts' entrance animation and Angular's own change-detection
// settle after the network already looks idle.
export async function settle(page, { networkIdleMs, settleMs }) {
  await page.waitForLoadState('networkidle', { timeout: networkIdleMs }).catch(() => {});
  await waitForFonts(page);
  await page.waitForTimeout(settleMs);
}
