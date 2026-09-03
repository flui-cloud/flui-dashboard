import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { AppGroupView, ApplicationKind } from '../../model/application.models';

// Shared with application-surface.ts (app.id + namespace conventions) — see the
// producer-playbook, §2: same app.id for every producer in this repo, not one per page.
const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

// Budget guard (§9): a page can in principle list hundreds of applications. Capping row
// scopes keeps a single snapshot bounded; `completeness.truncated` says so honestly when
// it happens. Mirrors the same idea as vops's `surfaceListOf` (SURFACE_MAX_ROWS).
const SURFACE_MAX_ROWS = 20;

/**
 * A row on this page is an `AppGroupView` — the "recap" grouping (`/apps/recap/:id`),
 * which for a composed install is a bundle of several `Application` entities, not one.
 * It therefore gets its own entity-type (`app-group`), distinct from the `application`
 * ref application-surface.ts mints for a single Application on its own detail page —
 * reusing `application` here would misname a bundle as if it were one app.
 */
export function appGroupEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://app-group/${id}`;
}

interface FilterState {
  search: string;
  category: string;
  status: string;
  cluster: string;
}

// This component (`ApplicationsListComponent`) is mounted at four different routes —
// /apps/applications, /apps/databases, /apps/tools, /apps/system — one per `kind`. `kind`
// is therefore the per-instance discriminator the page id is built from (§4.2: identity is
// per instance, not per definition) — the same file, four real distinct page instances.
function routeForKind(kind: ApplicationKind): string {
  switch (kind) {
    case 'DATABASE':
      return 'apps/databases';
    case 'TOOL':
      return 'apps/tools';
    case 'SYSTEM':
      return 'apps/system';
    default:
      return 'apps/applications';
  }
}

function pageLabelForKind(kind: ApplicationKind): string {
  switch (kind) {
    case 'DATABASE':
      return 'Databases';
    case 'TOOL':
      return 'Tools';
    case 'SYSTEM':
      return 'System Apps';
    default:
      return 'Applications';
  }
}

export interface ApplicationsListSurfaceInput {
  kind: ApplicationKind;
  /** `filteredGroups()` — what the list actually renders right now (search/category/status/cluster applied). */
  filteredGroups: AppGroupView[];
  /** `kindScopedGroups().length` — every group of this kind, before any filter. The "Total" stat card. */
  totalForKind: number;
  runningCount: number;
  failedCount: number;
  filters: FilterState;
  activeFiltersCount: number;
  isInitialLoading: boolean;
  /** `errorMessage() && !isLoading()` — the page's own error banner is showing. */
  hasLoadError: boolean;
}

export interface ApplicationsListSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(
  key: string,
  value: string | undefined | null,
  source: ObservationSource,
): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function valueObservation(key: string, value: number, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

function pageObservations(input: ApplicationsListSurfaceInput): Observation[] {
  return [
    valueObservation('flui.applications.total', input.totalForKind, 'derived'),
    valueObservation('flui.applications.running_count', input.runningCount, 'derived'),
    valueObservation('flui.applications.failed_count', input.failedCount, 'derived'),
    // Discrete filter picks (select controls), not the live-typed search box — a value the
    // user is still typing is not yet presented/committed content (playbook §5, deploy
    // wizard note). `search` is deliberately never observed here for the same reason.
    textObservation('flui.applications.filter_category', input.filters.category || null, 'ui'),
    textObservation('flui.applications.filter_status', input.filters.status || null, 'ui'),
    textObservation('flui.applications.filter_cluster', input.filters.cluster || null, 'ui'),
  ].filter((observation): observation is Observation => observation !== null);
}

function rowObservations(group: AppGroupView): Observation[] {
  return [
    textObservation('flui.application.status', group.status, 'api'),
    textObservation('flui.application.category', group.category, 'api'),
  ].filter((observation): observation is Observation => observation !== null);
}

function rowScope(listId: string, group: AppGroupView): SemanticScopeSnapshot {
  const ref = appGroupEntityRef(group.id);
  const entities: EntityReference[] = [{ ref, label: group.name, role: 'related' }];
  return {
    id: `${listId}:row:${group.id}`,
    parentId: listId,
    kind: 'region',
    entities,
    observations: rowObservations(group),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything a snapshot would express, without the revision/timestamp envelope — see
 * application-surface.ts for why this is split out (the revision counter hashes exactly
 * this, never the raw component input).
 *
 * SELECTION MODEL (see the producer report for the full reasoning): this page has been
 * read end to end — `applications-list.component.ts`, `application-group-row.component.ts`,
 * `application-row.component.ts` — and it has NO real selection. Every row is one big
 * `(click)` div that navigates to `/apps/recap/:id`; the only other controls are per-row
 * "Open" / "Delete" buttons that act immediately, not a checkbox or a bulk-action bar. This
 * is therefore the plain-list pattern from the playbook §4 / vops's `surface-fleet.js`:
 * `attention` names only the page, every row is `role: 'related'`, never `'primary'` or
 * `'selected'`. No selection state is invented to make `attention` richer than the product
 * actually is.
 */
export function presentedContent(input: ApplicationsListSurfaceInput): PresentedContent {
  const pageId = `apps-list:${input.kind}`;
  const listId = `${pageId}:list`;

  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    label: pageLabelForKind(input.kind),
    observations: pageObservations(input),
  };

  const all = input.filteredGroups;
  const rows = all.slice(0, SURFACE_MAX_ROWS);

  const listScope: SemanticScopeSnapshot = {
    id: listId,
    parentId: pageId,
    kind: 'list',
    label: 'Applications',
    state: {
      loading: input.isInitialLoading,
      ...(input.hasLoadError ? { error: true } : {}),
      empty: !input.isInitialLoading && rows.length === 0,
    },
    completeness: {
      shown: rows.length,
      total: all.length,
      ...(input.activeFiltersCount > 0 ? { filtered: true } : {}),
      ...(all.length > rows.length ? { truncated: true } : {}),
    },
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope, listScope, ...rows.map((group) => rowScope(listId, group))];

  // No entity in attention: the page itself is what's being looked at, nothing on it is
  // "selected" (see the note on presentedContent above).
  const attention: AttentionTarget[] = [{ scopeId: pageId, reason: 'route' }];

  return { scopes, attention };
}

export function buildApplicationsListSurface(
  input: ApplicationsListSurfaceInput,
  context: ApplicationsListSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  const pageId = `apps-list:${input.kind}`;

  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'apps-list',
      route: routeForKind(input.kind),
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/**
 * Revision moves only when presented content moves — see application-surface.ts's
 * `ApplicationSurfaceRevision` for the full rationale (hash the built content, never the
 * raw input).
 */
export class ApplicationsListSurfaceRevision {
  private counter = 0;
  private lastHash = '';

  next(presented: PresentedContent): number {
    const hash = JSON.stringify(presented);
    if (hash !== this.lastHash) {
      this.lastHash = hash;
      this.counter += 1;
    }
    return this.counter;
  }
}
