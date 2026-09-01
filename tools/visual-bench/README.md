# Visual bench

A Playwright bench that captures a deterministic reference screenshot of
every dashboard route, for diffing against a future Angular migration. This
directory builds and runs the bench; it does not capture the Angular-19
reference set by itself — see "Running it" below.

Deliberately **not** part of the dashboard's pnpm project: its own
`package.json`, its own `node_modules`, own `package-lock.json` (both
gitignored). It never touches `pnpm-lock.yaml` and never reaches the Docker
build. This mirrors the existing `e2e-local/` convention in this repo — same
idea, same reasoning, different job (browser tour vs. reference capture).

Images are written **outside this repo**, at
`/Users/dawit/Project/flui/visual-reference/angular-19/`, one PNG per
route+theme plus a `MANIFEST.json` describing the run.

## Setup

```bash
cd tools/visual-bench
npm install         # already done once when this bench was built
```

Playwright's Chromium build is a shared, version-keyed cache at
`~/Library/Caches/ms-playwright` — if it's ever missing, `npx playwright
install chromium` fetches it.

## Running it

Three steps, in order:

### 1. Capture a real login session (once)

```bash
npm run auth
```

Opens a **headed** browser at `/login` and pauses (Playwright Inspector).
Log in by hand — real OIDC redirect to Zitadel and back, no credentials ever
touch this script. Once you're back on the dashboard shell, resume the
Inspector (▶) or close its window. The script then saves both halves of the
session to `../../.auth/reference-session.json` (gitignored):

- the native Playwright `storageState()` (cookies + `localStorage`)
- the dashboard origin's `sessionStorage`, captured by hand

**Why both, and why this is the crux of the whole bench:** `angular-oauth2-oidc`
is configured with no custom `OAuthStorage` provider (see
`oidc-auth.service.ts` / `app.config.ts`), so it falls back to
`sessionStorage` for `access_token`, `refresh_token`, `id_token`,
`expires_at`, etc. — confirmed by reading the library's default in
`node_modules/angular-oauth2-oidc/fesm2022/angular-oauth2-oidc.mjs`.
Playwright's `context.storageState()` only ever serializes cookies and
`localStorage` — confirmed directly from this bench's own installed
`@playwright/test@1.62.1` by reading
`node_modules/playwright-core/lib/coreBundle.js`'s `StorageScript.collect()`,
which reads `window.localStorage` and (optionally) `indexedDB`, and never
touches `sessionStorage`. A storageState captured the "normal" way carries
none of the actual auth tokens. `capture.mjs` works around this by
re-injecting the saved `sessionStorage` entries via `context.addInitScript()`
on every context it opens (see `lib/session.mjs`) — that's the only thing
`storageState` can't do natively, so it's the one thing done by hand.

Re-run `npm run auth` whenever the saved session stops working. Session
lifetime is bounded by the **refresh token's** TTL (silent renewal keeps the
access token fresh automatically as long as the refresh token is still valid
and Zitadel is reachable) — that TTL is a server-side Zitadel setting this
bench could not read from the dashboard's client code; check it directly in
Zitadel, or just notice when `npm run capture` starts landing on `/login`.

### 2. (optional) Resolve real entity IDs

```bash
FLUI_API_KEY=... npm run discover-entities
```

Fills in `entity-ids.json` — the real cluster/application/firewall/etc. IDs
the parametric routes (`/apps/applications/:id`, `/cluster/:id`, ...) bind
to. Ships as a template with every field set to the literal string
`"UNRESOLVED"`; `capture.mjs` **skips** (never guesses) any parametric route
whose id is still unresolved, and records the skip + reason in
`MANIFEST.json`.

This bench was built from a subagent whose CLI vault agent socket was
unreachable (`~/.flui`'s `flui-vault-*/agent.sock` directory existed but was
empty — a different process tree had it unlocked), so every field in
`entity-ids.json` is still `UNRESOLVED` as shipped. `discover-entities.mjs`
deliberately doesn't go through the CLI vault at all — pass a real API key
via `FLUI_API_KEY` and it talks to the API directly, sidestepping that
process-boundary problem entirely. See `entity-ids.json`'s own `_source`
fields for the exact endpoint each id comes from.

A few ids have no discovery endpoint at all (`/apps/catalog/installs/:id` —
no list endpoint exists in `catalog.controller.ts`) or aren't stable entities
to begin with (`/cluster/create/:operationId`, the `/apps/deploy/*` build/
operation progress routes) — those stay permanently skipped; see
`lib/routes.mjs`'s `TRANSIENT_ROUTES`.

### 3. Capture, and prove it's deterministic

```bash
npm run verify
```

This is the real gate (see below) — it runs `capture.mjs` twice into
throwaway directories, diffs them byte-for-byte, and only then copies the
result into `/Users/dawit/Project/flui/visual-reference/angular-19/`. If the
two runs differ, **nothing is promoted** and the two raw runs are left on
disk for inspection.

For a single run without the double-check (fast iteration while developing a
new hazard fix):

```bash
npm run capture -- --out /tmp/one-run          # or omit --out for the real location
npm run capture -- --only application-detail   # filter by slug substring
npm run capture -- --themes dark               # skip the light-theme pass
```

To diff two arbitrary output directories by hand:

```bash
npm run diff -- /tmp/run-a /tmp/run-b
```

## The gate

> "If anything differs between two immediate runs, the bench is not done;
> fix the hazard before reporting success."

`npm run verify` **is** that check, automated: two back-to-back `capture.mjs`
runs, diffed image-by-image (SHA-256) and manifest-by-manifest (structural,
ignoring only the one real-wall-clock field — `generatedAt` — that's
supposed to differ between runs; see `diff-runs.mjs`). A clean `npm run
verify` is the actual definition of "the bench works," not a screenshot that
merely looks right once.

## Determinism

Every hazard the survey found, and where it's neutralized:

| # | Hazard | Neutralized in |
|---|---|---|
| 1 | Relative-time text ("3 minutes ago"), computed per-component, no shared pipe | `lib/determinism.mjs` — `Date`/`Date.now()` patched to a fixed constant (`FROZEN_NOW_ISO` in `lib/config.mjs`) via `context.addInitScript()`, before any app script runs |
| 2 | Live `setInterval` redraws / 1s elapsed-time counters (build progress, GitHub Actions monitor, ...) | Real timers are left running (see why below), so these still fire — but they now fire against the frozen `Date`, and the fixed settle wait (`DEFAULT_SETTLE_MS`/`CHART_SETTLE_MS`) is long enough that whatever they render has stabilized by shot time |
| 3 | WebSocket push (stray toast / badge count) | `lib/determinism.mjs`'s `blockWebSocket()` — aborts `**/socket.io/**` at the context level, so `NotificationService.bootstrapWebSocketListeners()` never gets a connection |
| 4 | Theme defaults from `localStorage['flui-theme']`, not OS, not seeded | `installDeterminismInitScripts()` seeds that exact key before `ThemeService`'s constructor runs, for every job, both `dark` and `light` |
| 5 | echarts entrance animation (no `animation:false` anywhere) | Not disabled in the app (out of scope for a capture-only bench) — absorbed by `reducedMotion: 'reduce'` (native Playwright context option) plus the CSS animation/transition kill plus a generous fixed settle (`CHART_SETTLE_MS`, longer than ngx-echarts' default ~1000ms entrance) on every chart-bearing route (`chartHeavy: true` in `lib/routes.mjs`) |
| 6 | Remote Google Fonts, `display=swap` (FOIT/FOUT race) | `lib/determinism.mjs`'s `waitForFonts()` awaits `document.fonts.ready` before every screenshot |
| 7 | `Math.random()` in `chart-demo.component.ts` | **Not neutralized** — this one route is flagged `note: '...NOT expected to diff-clean...'` in `lib/routes.mjs` and will legitimately fail `npm run verify`'s diff for that one file. Everything else does not use `Math.random()` in a way that reaches the DOM (`cluster.service.ts`'s random metrics generator has zero call sites — dead code, not wired to any route) |
| 8 | Non-fixed viewport / DPR / OS font rendering | `lib/config.mjs`'s `VIEWPORT` + `DEVICE_SCALE_FACTOR`, applied to every context |

Two hazards the survey flagged that this app turns out **not** to have:
no Angular `withViewTransitions()`, and no global route-transition loading
bar. One less thing to neutralize.

**Why `Date` is patched but real timers are not, unlike Playwright's own
`page.clock.install()`:** `clock.install()` fakes `Date` *and*
`setTimeout`/`setInterval`/`requestAnimationFrame` together, with no way to
take only `Date`. ngx-echarts' entrance animation runs on
`requestAnimationFrame` — freezing that would leave charts stuck mid-animation
instead of finished, unless the clock is then explicitly advanced (`clock.
runFor()`), which is a second moving part this first pass chose not to take
on without being able to test a live capture in the same session it was
built in (see "Not yet verified live" below). Revisiting this is a
reasonable follow-up once the bench has an actual live run under it.

**Loading / empty / error states** (per the task's states list): there's no
force-loading debug flag anywhere in the app, so these are XHR-interception
territory (`context.route()` with a delayed `fulfill()`, or one that returns
`[]`/a 4xx), not something a shared init script can do generically across
every list/detail page. This bench doesn't attempt all of them — that's a
per-page authoring job, not infrastructure — but `lib/determinism.mjs` +
`lib/session.mjs` give you everything needed to write one:

```js
const context = await newAuthenticatedContext(browser, session, contextOptions);
await context.route('**/api/v1/clusters/*/applications', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
);
```

## Output layout

```
visual-reference/angular-19/
  MANIFEST.json
  login--dark.png
  login--light.png
  dashboard--dark.png
  ...
  application-detail--overview--dark.png
  ...
```

Filenames are `${slug}--${theme}.png`; `slug` comes straight from
`lib/routes.mjs` (a tab group like `application-detail` expands to
`application-detail--overview`, `application-detail--clients`, ...).

`MANIFEST.json` records: the dashboard's git commit (+ dirty flag) at
capture time, the dashboard URL, the theme(s) run, viewport/DPR, the
`entity-ids.json` snapshot actually used, every captured route (slug, path,
theme, output file, any per-route note, any console error seen), and every
**skipped** route with its reason (unresolved id, or permanently transient).

## Known limitations / not yet verified live

Carried over from the survey, unresolved by this build phase on purpose (the
task was to build the bench, not to run it):

- **Every parametric entity ID is still `UNRESOLVED`.** The vault-agent
  socket problem is a process-boundary issue, not a credentials one — see
  "Resolve real entity IDs" above and `entity-ids.json`'s `_source` fields.
- **The saved session's actual usable lifetime is unmeasured.** Needs either
  a Zitadel admin check of the refresh-token TTL, or empirically watching
  how long a captured `reference-session.json` keeps working across days.
- **`Date`-patch-not-`clock.install()` is a design choice made without a
  live test run to validate it against** (see the box above). If a captured
  chart still shows a visible mid-animation frame, this is the first place
  to look.
- **Loading/empty/error/toast-panel states** have the building blocks
  (`context.route()` interception, `blockWebSocket()`) but no per-page
  authored jobs yet — `lib/routes.mjs` only covers the "happy path" render
  of each route today.
- **`npm run verify` itself has never been run.** Everything here was
  syntax-checked (`node --check`) and the pure data/logic modules
  (`lib/routes.mjs`, `lib/config.mjs`) were smoke-tested by importing and
  calling them directly — but no script here has actually launched a browser
  yet, per the task's explicit "do not capture yet." The first real run is
  the next phase, and it is expected to surface at least small fixes.
