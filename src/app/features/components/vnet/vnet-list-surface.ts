import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  buildSurfaceList,
  entityRef,
  SURFACE_APP_ID,
  SurfaceListRow,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import type { VNetInfo, VNetFilterState } from '../../model/vnet.models';

const PAGE_ID = 'vnet-list';
const LIST_ID = `${PAGE_ID}:vnets`;

export function vnetEntityRef(id: string): string {
  return entityRef('vnet', id);
}

export interface VNetListSurfaceInput {
  visibleVNets: VNetInfo[];
  totalCount: number;
  isLoading: boolean;
  filters: VNetFilterState;
  /** Same helper `getTotalAttachedServers` calls in the template — passed in rather than
   * imported, so the producer stays a pure function of what's already computed. */
  attachedServerCountOf: (vnet: VNetInfo) => number;
}

export interface VNetListSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function hasActiveFilters(filters: VNetFilterState): boolean {
  return !!(filters.search || filters.provider || filters.status);
}

function filterObservations(filters: VNetFilterState): (Observation | null)[] {
  return [
    textObservation('flui.vnet.search_query', filters.search, 'ui'),
    textObservation('flui.vnet.provider_filter', filters.provider, 'ui'),
    textObservation('flui.vnet.status_filter', filters.status, 'ui'),
  ];
}

// `ipRange` (the VNet CIDR) is deliberately NOT presented: unlike the instance IP
// (`instance.dto.ts`, classified `network-identifier`), `VNetResponseDto` carries no
// `@Sensitivity` decoration at all — the mask-response interceptor passes every one of
// its fields through unmasked regardless of mask mode, so this is a genuine backend gap
// rather than a "safe" classification this producer could rely on. Flagged in the
// producer report rather than decided unilaterally, per the playbook's redaction rule
// (§7, "checklist, not trust").
function rowOf(vnet: VNetInfo, attachedServerCountOf: (v: VNetInfo) => number): SurfaceListRow {
  return {
    id: `${LIST_ID}:${vnet.id}`,
    ref: vnetEntityRef(vnet.id),
    label: vnet.name,
    observations: [
      textObservation('flui.vnet.status', vnet.status, 'api'),
      textObservation('flui.vnet.provider', vnet.provider, 'api'),
      valueObservation('flui.vnet.subnet_count', vnet.subnets.length, 'api'),
      valueObservation('flui.vnet.attached_server_count', attachedServerCountOf(vnet), 'derived'),
      valueObservation('flui.vnet.label_count', vnet.labels.length, 'derived'),
    ].filter((o): o is Observation => o !== null),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything the Virtual Networks page would present, without the revision/timestamp
 * envelope. Pure list page — a row click navigates to VNet Detail (`selectVNet` in
 * vnet-list.component.ts), no in-place selection — so attention names only the page and
 * every row entity stays 'related' (playbook §4, second case).
 */
export function presentedContent(input: VNetListSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Virtual Networks',
  };

  const { scopes: listScopes } = buildSurfaceList({
    listId: LIST_ID,
    parentId: PAGE_ID,
    label: 'VNets',
    totalCount: input.totalCount,
    filtered: hasActiveFilters(input.filters),
    rows: input.visibleVNets.map((v) => rowOf(v, input.attachedServerCountOf)),
    listObservations: filterObservations(input.filters),
  });
  listScopes[0] = {
    ...listScopes[0],
    state: { loading: input.isLoading, empty: input.visibleVNets.length === 0 },
  };

  return {
    scopes: [pageScope, ...listScopes],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildVNetListSurface(
  input: VNetListSurfaceInput,
  context: VNetListSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'infrastructure/vnet',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class VNetListSurfaceRevision {
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
