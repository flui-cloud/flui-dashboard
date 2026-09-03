import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  buildSurfaceList,
  instanceEntityRef,
  SURFACE_APP_ID,
  SurfaceListRow,
  textObservation,
} from '../../../shared/utils/surface-kit';
import type { InstanceWithLabels } from '../../model/instance.models';

const PAGE_ID = 'compute-list';
const LIST_ID = `${PAGE_ID}:instances`;

export interface ComputeInstancesFilters {
  search: string;
  provider: string;
  status: string;
  region: string;
}

export interface ComputeInstancesSurfaceInput {
  /** The already-filtered rows the table actually renders. */
  visibleInstances: InstanceWithLabels[];
  /** The unfiltered set, for `completeness.total`. */
  totalCount: number;
  isLoading: boolean;
  filters: ComputeInstancesFilters;
}

export interface ComputeInstancesSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function filterObservations(filters: ComputeInstancesFilters): (Observation | null)[] {
  return [
    textObservation('flui.compute.search_query', filters.search, 'ui'),
    textObservation('flui.compute.provider_filter', filters.provider, 'ui'),
    textObservation('flui.compute.status_filter', filters.status, 'ui'),
    textObservation('flui.compute.region_filter', filters.region, 'ui'),
  ];
}

function hasActiveFilters(filters: ComputeInstancesFilters): boolean {
  return !!(filters.search || filters.provider || filters.status || filters.region);
}

function rowOf(instance: InstanceWithLabels): SurfaceListRow {
  const region = instance.regionName || instance.region;
  return {
    id: `${LIST_ID}:${instance.provider}:${instance.providerId}`,
    ref: instanceEntityRef(instance.provider, instance.providerId),
    label: instance.displayName || instance.name,
    observations: [
      textObservation('flui.instance.status', instance.status, 'api'),
      textObservation('flui.instance.provider', instance.provider, 'api'),
      textObservation('flui.instance.region', region, 'api'),
      // `ipConfig.v4.ip` is classified `network-identifier` server-side
      // (instance.dto.ts) — mask mode already substitutes it in the API
      // response this row reads, before this producer ever sees it. Reading
      // the same post-mask `instance` value the row renders (never a second
      // fetch) is what keeps this from bypassing that coverage.
      textObservation('flui.instance.ip_v4', instance.ipConfig?.v4?.ip, 'api'),
    ].filter((o): o is Observation => o !== null),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything the Compute Instances page would present, without the revision/timestamp
 * envelope — split out so the revision counter hashes exactly this. A pure list page:
 * a row click navigates to Instance Detail rather than selecting in place (verified in
 * instance-actions.component.ts's onViewDetails), so `attention` names only the page and
 * every row entity stays 'related' — playbook §4, second case, same as vops's fleet page.
 */
export function presentedContent(input: ComputeInstancesSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Compute Instances',
  };

  const { scopes: listScopes } = buildSurfaceList({
    listId: LIST_ID,
    parentId: PAGE_ID,
    label: 'Instances',
    totalCount: input.totalCount,
    filtered: hasActiveFilters(input.filters),
    rows: input.visibleInstances.map(rowOf),
    listObservations: filterObservations(input.filters),
  });
  // `state` describes this list's own load outcome, not any instance's domain health
  // (playbook §6 item 2) — each row already carries its own status observation.
  listScopes[0] = {
    ...listScopes[0],
    state: { loading: input.isLoading, empty: input.visibleInstances.length === 0 },
  };

  return {
    scopes: [pageScope, ...listScopes],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildComputeInstancesSurface(
  input: ComputeInstancesSurfaceInput,
  context: ComputeInstancesSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'infrastructure/compute',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Same content-hash approach as {@link ApplicationSurfaceRevision} — hashes what
 * {@link presentedContent} actually produced, never the raw component input. */
export class ComputeInstancesSurfaceRevision {
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
