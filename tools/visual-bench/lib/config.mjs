/**
 * Shared constants for the visual bench. Every script imports from here so
 * "run it twice and diff" only works if every knob that could vary between
 * runs is pinned in exactly one place.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH_ROOT = path.resolve(HERE, '..');
export const DASHBOARD_REPO = path.resolve(BENCH_ROOT, '..', '..');
const FLUI_ROOT = path.resolve(DASHBOARD_REPO, '..');

export const DASHBOARD_URL = trimSlashes(
  process.env.FLUI_DASHBOARD_URL || 'http://localhost:4200',
);
export const API_URL = trimSlashes(process.env.FLUI_API_URL || 'https://api.tidy-marmot-nf.109-123-252-6.nip.io');

// Where the auth-capture script writes the reusable session, and where every
// capture run reads it back from. Gitignored (see ../../.gitignore).
export const AUTH_FILE = path.join(DASHBOARD_REPO, '.auth', 'reference-session.json');

// Images live outside this repo by design (task spec) — never in the
// dashboard's own git history.
export const DEFAULT_OUT_DIR = path.join(FLUI_ROOT, 'visual-reference', 'angular-19');
export const MANIFEST_FILENAME = 'MANIFEST.json';

// Where entity IDs discovered from the live API are recorded once the vault
// blocker (see the survey) is cleared. Committed as a template with
// UNRESOLVED markers; filled in by discover-entities.mjs.
export const ENTITY_IDS_FILE = path.join(BENCH_ROOT, 'entity-ids.json');

export const VIEWPORT = Object.freeze({ width: 1440, height: 960 });
export const DEVICE_SCALE_FACTOR = 1;

// A fixed instant, never "now". Every relative-time string on screen
// ("3 minutes ago") is computed against this constant inside the captured
// page, so two runs taken minutes apart still render identical text. It has
// no relation to wall-clock reality and must never be swapped for
// `new Date()` or a per-run timestamp.
export const FROZEN_NOW_ISO = '2026-01-15T09:30:00.000Z';

export const THEMES = Object.freeze(['dark', 'light']);

export const NAV_TIMEOUT_MS = 20_000;
export const NETWORK_IDLE_TIMEOUT_MS = 8_000;
// Base settle after network-idle: long enough to clear ngx-echarts' default
// ~1000ms entrance animation deterministically (see README "Determinism"),
// short enough to keep a full run practical.
export const DEFAULT_SETTLE_MS = 1_500;
// Extra headroom for routes that host charts (monitoring/pricing/chart-demo).
export const CHART_SETTLE_MS = 2_200;

export const localStorageThemeValue = (theme) => (theme === 'light' ? 'light' : 'dark');

function trimSlashes(value) {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end -= 1;
  return value.slice(0, end);
}
