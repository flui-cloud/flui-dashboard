import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  buildSurfaceList,
  compositeEntityRef,
  SURFACE_APP_ID,
  SurfaceListRow,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import type { PlatformComponentResponseDto } from '../../../core/api/model/platformComponentResponseDto';

const PAGE_ID = 'platform-components';
const LIST_ID = `${PAGE_ID}:components`;

export type VisibleComponent = PlatformComponentResponseDto & { clusterId: string; clusterName: string };

export function platformComponentEntityRef(clusterId: string, key: string): string {
  return compositeEntityRef('platform-component', clusterId, key);
}

export interface PlatformComponentsListSurfaceInput {
  /** Exactly the rows the template renders — the flattened, filtered union of
   * `entryFilteredComponents(clusterId)` over `visibleEntries()`, not a re-derivation. */
  visibleComponents: VisibleComponent[];
  totalCount: number;
  isLoading: boolean;
  searchQuery: string;
  statusFilter: string;
  clusterFilter: string;
  /** `expandedKeys` in platform-components-list.component.ts — real, multi-valued
   * per-instance state (more than one detail panel can be open at once). */
  expandedKeys: ReadonlySet<string>;
  createdAtOf: (component: PlatformComponentResponseDto) => string | undefined;
}

export interface PlatformComponentsListSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function hasActiveFilters(input: PlatformComponentsListSurfaceInput): boolean {
  return !!(input.searchQuery || input.statusFilter || input.clusterFilter);
}

function filterObservations(input: PlatformComponentsListSurfaceInput): (Observation | null)[] {
  return [
    textObservation('flui.platform_components.search_query', input.searchQuery, 'ui'),
    textObservation('flui.platform_components.status_filter', input.statusFilter, 'ui'),
    textObservation('flui.platform_components.cluster_filter', input.clusterFilter, 'ui'),
  ];
}

function rowOf(
  component: VisibleComponent,
  expanded: boolean,
  createdAtOf: (c: PlatformComponentResponseDto) => string | undefined,
): SurfaceListRow {
  return {
    id: `${LIST_ID}:${component.clusterId}:${component.key}`,
    ref: platformComponentEntityRef(component.clusterId, component.key),
    label: component.name,
    role: expanded ? 'selected' : 'related',
    // `errors` (raw k8s/reconciliation text) and pod log content live in the expanded
    // detail panel (platform-component-detail-panel.component.ts) and are NEVER carried
    // here — only a count, same discipline as `flui.application.status` never repeating
    // `reconciliationError`'s raw text in the app producer. Logs specifically cannot be
    // masked at all (the panel's own mask-mode banner says so), which is one more reason
    // this producer must not reach past that count.
    observations: [
      textObservation('flui.platform_component.category', component.category, 'api'),
      textObservation('flui.platform_component.status', component.status, 'api'),
      textObservation('flui.platform_component.managed_by', component.managedBy, 'api'),
      textObservation('flui.platform_component.cluster_name', component.clusterName, 'api'),
      valueObservation('flui.platform_component.error_count', component.errorCount, 'api'),
      textObservation('flui.platform_component.created_at', createdAtOf(component), 'derived'),
    ].filter((o): o is Observation => o !== null),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything Platform Components would present, without the revision/timestamp
 * envelope. Expanding a row's detail panel is real, multi-valued per-instance state
 * (`expandedKeys` is a `Set`, more than one can be open) — every currently expanded
 * component is named in attention, `reason: 'selection'`, same shape as SSH Keys'
 * checkbox multi-select (playbook §11).
 */
export function presentedContent(input: PlatformComponentsListSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Platform Components',
  };

  const rows = input.visibleComponents.map((c) => ({
    component: c,
    expanded: input.expandedKeys.has(`${c.clusterId}:${c.key}`),
  }));

  const { scopes: listScopes } = buildSurfaceList({
    listId: LIST_ID,
    parentId: PAGE_ID,
    label: 'Components',
    totalCount: input.totalCount,
    filtered: hasActiveFilters(input),
    rows: rows.map((r) => rowOf(r.component, r.expanded, input.createdAtOf)),
    listObservations: filterObservations(input),
  });
  listScopes[0] = {
    ...listScopes[0],
    state: { loading: input.isLoading, empty: input.visibleComponents.length === 0 },
  };

  const expandedRows = rows.filter((r) => r.expanded);
  const attention: AttentionTarget[] =
    expandedRows.length > 0
      ? expandedRows.map((r) => ({
          scopeId: `${LIST_ID}:${r.component.clusterId}:${r.component.key}`,
          entityRef: platformComponentEntityRef(r.component.clusterId, r.component.key),
          reason: 'selection',
        }))
      : [{ scopeId: PAGE_ID, reason: 'route' }];

  return { scopes: [pageScope, ...listScopes], attention };
}

export function buildPlatformComponentsListSurface(
  input: PlatformComponentsListSurfaceInput,
  context: PlatformComponentsListSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'infrastructure/platform-components',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class PlatformComponentsListSurfaceRevision {
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
