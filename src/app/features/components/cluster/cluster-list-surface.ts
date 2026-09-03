import type {
  AttentionTarget,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { ClusterInfo } from '../../model/cluster.models';
import { clusterEntityRef } from './cluster-surface';

/* Semantic Surface — the Clusters page (the fleet).
 *
 * Clicking a row's "View" button navigates to `/cluster/:id`; the row itself is not a
 * selection. So `attention` names the page and nothing else, and every row entity is
 * `related`, never `primary` — the list-page pattern the playbook documents from vops'
 * surface-fleet.js, not the entity-detail pattern application-surface.ts uses. */

const SURFACE_APP_ID = 'flui-dashboard';

const PAGE_ID = 'cluster-list';
const LIST_ID = 'cluster-list:rows';

export interface ClusterListFilters {
  search: string;
  provider: string;
  status: string;
  region: string;
}

export interface ClusterListSurfaceInput {
  // Both arrays are the exact signals cluster-list.component.ts's own template reads
  // (`allClusters()` / `filteredClusters()`) — not a second, re-derived filter model.
  allClusters: ClusterInfo[];
  filteredClusters: ClusterInfo[];
  filters: ClusterListFilters;
  loading: boolean;
}

export interface ClusterListSurfaceContext {
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

function valueObservation(
  key: string,
  value: number | boolean,
  source: ObservationSource,
): Observation {
  return { key, presentedAs: { value }, source };
}

function hasActiveFilter(filters: ClusterListFilters): boolean {
  return !!(filters.search || filters.provider || filters.status || filters.region);
}

function filterObservations(filters: ClusterListFilters): Observation[] {
  return [
    textObservation('flui.cluster_list.filter_search', filters.search, 'ui'),
    textObservation('flui.cluster_list.filter_provider', filters.provider, 'ui'),
    textObservation('flui.cluster_list.filter_status', filters.status, 'ui'),
    textObservation('flui.cluster_list.filter_region', filters.region, 'ui'),
  ].filter((observation): observation is Observation => observation !== null);
}

function rowObservations(cluster: ClusterInfo): Observation[] {
  return [
    textObservation('flui.cluster.status', cluster.status, 'api'),
    textObservation('flui.cluster.provider', cluster.provider, 'api'),
    textObservation('flui.cluster.region', cluster.region, 'api'),
    cluster.nodeCount !== undefined ? valueObservation('flui.cluster.node_count', cluster.nodeCount, 'api') : null,
    cluster.autoScalingEnabled ? valueObservation('flui.cluster.auto_scaling_enabled', true, 'api') : null,
    textObservation('flui.cluster.version', cluster.version, 'api'),
    cluster.createdAt ? textObservation('flui.cluster.created_at', new Date(cluster.createdAt).toISOString(), 'api') : null,
  ].filter((observation): observation is Observation => observation !== null);
}

function rowScope(cluster: ClusterInfo): SemanticScopeSnapshot | null {
  if (!cluster.id) return null;
  return {
    id: `${LIST_ID}:${cluster.id}`,
    parentId: LIST_ID,
    kind: 'region',
    entities: [{ ref: clusterEntityRef(cluster.id), label: cluster.name, role: 'related' }],
    observations: rowObservations(cluster),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything a snapshot would express, without the revision/timestamp envelope. Unlike
 * application-surface.ts and cluster-surface.ts, this never returns null on "nothing
 * loaded yet": a list page is always legitimately describable — even zero rows, or rows
 * still loading, is real content — so "nothing invented" here means the loading/empty
 * state is carried honestly on the list scope's own `state` (§4.3), not that the whole
 * page vanishes the way a detail page does when its one entity hasn't resolved.
 */
export function presentedContent(input: ClusterListSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Clusters',
  };

  const rows = input.loading ? [] : input.filteredClusters;
  const filtered = hasActiveFilter(input.filters);

  const listScope: SemanticScopeSnapshot = {
    id: LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    label: 'Clusters',
    observations: input.loading ? [] : filterObservations(input.filters),
    completeness: {
      shown: rows.length,
      total: input.loading ? 0 : input.allClusters.length,
      ...(filtered ? { filtered: true } : {}),
    },
    state: {
      loading: input.loading,
      empty: !input.loading && rows.length === 0,
    },
  };

  const rowScopes = rows
    .map((cluster) => rowScope(cluster))
    .filter((scope): scope is SemanticScopeSnapshot => scope !== null);

  const attention: AttentionTarget[] = [{ scopeId: PAGE_ID, reason: 'route' }];

  return { scopes: [pageScope, listScope, ...rowScopes], attention };
}

export function buildClusterListSurface(
  input: ClusterListSurfaceInput,
  context: ClusterListSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'cluster-list',
      route: 'cluster',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Same content-hash discipline as ApplicationSurfaceRevision / ClusterSurfaceRevision. */
export class ClusterListSurfaceRevision {
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
