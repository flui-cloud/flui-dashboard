# Console guidelines

How the dashboard is built. The visual rules (frame, color, type, words, icons, actions, accessibility) live in the Flui Console kit, [`internal-docs/Flui console/README.md`](../internal-docs/Flui%20console/README.md). This file does not repeat them: it says how the kit becomes Angular code, and how that code is organised.

When the two disagree, the kit wins on how a page looks and reads; this file wins on how the code is written. If a page needs something neither covers, add it to the kit first, then build the page.

## 1. Theme

Three layers, one source: [`src/theme/tokens.json`](../src/theme/tokens.json). Never edit `src/theme/tokens.css`; run `pnpm tokens` to regenerate it.

| Layer               | Example                                                   | Who reads it                                                         |
| ------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| Primitives          | `--fl-gray-900`, `--fl-blue-600`                          | Only the semantic layer. The only place in the repo with hex values. |
| Semantic roles      | `--fl-ink`, `--fl-surface`, `--fl-accent`, `--fl-success` | Kit components, page code, Tailwind.                                 |
| Sizes, type, radius | `--fl-space-4`, `--fl-radius-lg`, `--fl-text-body-sm`     | Kit components, page code, Tailwind.                                 |

- Code speaks in roles, never in primitives or values. Changing the brand, the palette or adding a theme touches `tokens.json` only.
- Every role is defined per theme under `[data-theme="<id>"]`. Only `light` exists today.
- The legacy shadcn variables (`--primary`, `--muted`, `--border`, …) are generated from the same roles, so the spartan/helm components and not-yet-migrated pages follow the kit. They are a bridge: new code never uses them, and they go when the last page is migrated.
- Tailwind exposes the roles under the `fl` prefix: `bg-fl-surface`, `text-fl-ink-muted`, `border-fl-border`, `rounded-fl-lg`. They take no opacity modifier on purpose (`bg-fl-accent/10` does not exist): tinted states have their own role (`fl-accent-soft`, `fl-accent-row`).
- No Tailwind palette colors (`bg-purple-500`, `text-emerald-600`), no hex, no arbitrary values (`[#…]`, `[13px]`), no `style=""` in new or migrated code. `pnpm slop` checks it.

## 2. Structure

```
src/theme/                tokens.json, generated tokens.css, console/*.css (kit classes)
src/app/ui/               the kit in Angular, selector prefix `fl-`
  primitives/             icon, button, tag, status, spinner
  patterns/               panel, table, metric-strip, page-header, tabs, key-value,
                          usage-bar, alert, filter-bar, forms, wizard, chart, states
  overlays/               dialog, confirm, actions menu, toast
  frame/                  top bar, side navigation, shell (wave 1)
  kit-page/               the /kit reference route, development builds only
src/app/core/state/       remote data, polling, persisted preferences
src/app/layout/console/   the console frame wired to the app: menu structure, top bar menus
src/app/features/<domain>/
  pages/                  routed components: own the data, compose the kit
  ui/                     presentational pieces of this domain
  data/                   stores and services of this domain
```

- `fl-` components are presentational: inputs, outputs, content projection. They never inject a feature service or call the API. Their classes carry the `Fl` prefix (`FlPanel`, `FlStatus`) so they never collide with API models of the same name.
- Overlays are the exception that holds behavior: `ConfirmService.confirm()` for every destructive action (with `typeToConfirm` for anything that deletes data), `fl-actions-menu` for the `Actions` menu, fed with `MenuAction[]` and answering through `(action)`.
- Feature code keeps the `app-` prefix. The `features/<domain>/{pages,ui,data}` layout applies to pages created or migrated during the revamp; nothing is moved in bulk.
- The kit's CSS lives in `src/theme/console/*.css`, ported from the kit's `bundle.css`, one file per component, loaded globally. Kit components render that markup and add behavior and accessibility; page code adds layout with Tailwind.

## 3. Components

- **Size:** 300 lines recommended, 500 maximum, per file, inline template included. ESLint warns at 300 and fails at 500.
- **Templates:** inline up to about 100 lines, then a separate `.html` file.
- **File names:** new files follow the Angular style guide without the type suffix (`page-header.ts`, `panel.ts`, `cluster-list-page.ts`). Existing files keep their names.
- **Change detection:** OnPush is Angular 22's default. New and migrated components do not declare `changeDetection` and never use `Eager`.
- **APIs:** `input()`, `output()`, `model()`, `inject()`, `host: {}` instead of `@HostBinding`/`@HostListener`, built-in control flow. No `any`.
- **Accessibility:** real `<button>` and `<a>`, `aria-current` on the active item, `scope` on table headers, an `aria-label` on every icon-only control, the focus ring on everything interactive. Overlays use the Angular CDK (focus trap, escape, return focus).
- **Icons:** Lucide only, through `fl-icon`, sized by the kit (16 in navigation and buttons, 14 next to status text). No emoji, no other set.
- **Copy:** English, following the kit's Words section. One wording per state, everywhere.
- **Comments:** none in source. Rationale goes in commit messages and docs.

## 4. State

Signals, no state library.

- **Remote data has one shape**, `RemoteData<T>` in `core/state`: `status` is `loading`, `ready`, `empty` or `error`, with `data` and `error`. Build it from an Angular resource with `remoteData()`. Kit panels take it and draw loading, empty and error themselves, so every page shows those states the same way.
- **Reads** go through `resource`, `rxResource` or `httpResource`, not manual `subscribe()`.
- **Two kinds of store.** Root services hold data shared across pages (clusters, applications, the current scope). Page state lives in a store provided by the page component (`providers: [XStore]`) and dies with it.
- **Components never call the generated API client** (`core/api`) directly; they go through a store or a service.
- **Polling** uses `poll()` from `core/state`: one interval policy, paused while the tab is hidden. No raw `setInterval`.
- **`effect()`** only for effects outside the signal graph (DOM, storage, logging). Derived state is `computed()` or `linkedSignal()`.
- **Browser storage** only for per-user conveniences (a remembered tab, a filter), through `core/state`, never for data the API owns.
- Large services (`ApplicationService` and similar) are split when their pages are migrated, not in a separate refactor.

## 5. Tooling

| Command       | Checks                                                                                                                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`   | ESLint with angular-eslint on kit and migrated code: file size, no `Eager`, signal APIs, no generated client in components, template accessibility, no `any`.                                                                                              |
| `pnpm format` | Prettier.                                                                                                                                                                                                                                                  |
| `pnpm slop`   | Patterns the kit forbids (palette colors, gradients, large shadows, large radii, blur, hex, arbitrary values). Zero allowed in `src/app/ui` and `src/theme/console`; elsewhere the count may only go down from the baseline in `tools/slop/baseline.json`. |
| `pnpm tokens` | Regenerates `src/theme/tokens.css` from `tokens.json`.                                                                                                                                                                                                     |

`/kit` (development builds only) renders every kit component with real Angular code. It is where a kit change is reviewed before a page uses it.

## 6. Revamp waves

| Wave | Scope                                                                                   |
| ---- | --------------------------------------------------------------------------------------- |
| 0    | Theme, tokens, tooling, state primitives, the kit in Angular, `/kit`                    |
| 1    | Frame: top bar, side navigation, breadcrumb, page header; new menu structure            |
| 2    | Kit primitives replace badges, cards and pills across existing pages                    |
| 3    | Reference pages: Overview, Applications, Data stores, Cluster monitoring, Deploy wizard |
| 4    | Infrastructure pages                                                                    |
| 5    | Delivery pages                                                                          |
| 6    | Operations and Administration pages                                                     |
| 7    | Long tail, dark theme, removal of the legacy variables, slop count at zero              |

Each wave ends with before and after screenshots of the pages it touched and the slop count.

During the revamp the console is light only. The dark theme comes back in wave 7, designed as a second set of roles in `tokens.json`.
