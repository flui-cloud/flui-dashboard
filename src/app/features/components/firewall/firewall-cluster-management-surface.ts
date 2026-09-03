import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  boolObservation,
  buildSurfaceList,
  entityRef,
  SURFACE_APP_ID,
  SurfaceListRow,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import type { FirewallExtended } from '../../model/firewall-v2.models';

const PAGE_ID = 'cluster-firewalls';
const LIST_ID = `${PAGE_ID}:firewalls`;

export function firewallEntityRef(id: string): string {
  return entityRef('firewall', id);
}

export interface FirewallClusterManagementSurfaceInput {
  /** Already the filtered, visible set — `FirewallV2Service.extendedFirewalls`. */
  firewalls: FirewallExtended[];
  /** The unfiltered count — `FirewallV2Service.firewalls().length` — for `completeness.total`. */
  totalCount: number;
  isLoading: boolean;
  searchQuery: string;
  statusFilter: string | undefined;
  coverageFilter: string | undefined;
}

export interface FirewallClusterManagementSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function hasActiveFilters(input: FirewallClusterManagementSurfaceInput): boolean {
  return !!(input.searchQuery || input.statusFilter || input.coverageFilter);
}

function filterObservations(input: FirewallClusterManagementSurfaceInput): (Observation | null)[] {
  return [
    textObservation('flui.cluster_firewalls.search_query', input.searchQuery, 'ui'),
    textObservation('flui.cluster_firewalls.status_filter', input.statusFilter, 'ui'),
    textObservation('flui.cluster_firewalls.coverage_filter', input.coverageFilter, 'ui'),
  ];
}

// `errorMessage` (raw reconciliation error text from the provider/controller) is
// deliberately NOT presented — same discipline as the application producer's
// `reconciliationError` exclusion (playbook §6 item 2): the reconciliation status badge
// already carries the "this failed" fact as a namespaced value.
function rowOf(firewall: FirewallExtended): SurfaceListRow {
  const cluster = firewall.clusterInfo;
  return {
    id: `${LIST_ID}:${firewall.id}`,
    ref: firewallEntityRef(firewall.id),
    label: cluster?.clusterName ?? firewall.clusterId,
    observations: [
      textObservation('flui.firewall.reconciliation_status', firewall.reconciliationStatus, 'api'),
      textObservation('flui.firewall.coverage_status', firewall.coverageStatus, 'api'),
      boolObservation('flui.firewall.has_drift', firewall.hasDrift, 'api'),
      valueObservation('flui.firewall.rule_count', firewall.desiredRules.length, 'api'),
      textObservation('flui.firewall.provider_firewall_id', firewall.providerFirewallId, 'api'),
      textObservation('flui.firewall.last_reconciliation_at', firewall.lastReconciliationAt, 'api'),
      cluster ? valueObservation('flui.firewall.ready_nodes', cluster.readyNodes, 'api') : null,
      cluster ? valueObservation('flui.firewall.total_nodes', cluster.totalNodes, 'api') : null,
      cluster ? textObservation('flui.firewall.cluster_status', cluster.clusterStatus, 'api') : null,
    ].filter((o): o is Observation => o !== null),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything Cluster Firewalls would present, without the revision/timestamp envelope.
 * Pure list page — the whole card is a link to Firewall Detail (an absolutely
 * positioned `<a>` over each row in firewall-cluster-management.component.html), no
 * in-place selection — so attention names only the page and every row entity stays
 * 'related' (playbook §4, second case).
 */
export function presentedContent(input: FirewallClusterManagementSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Cluster Firewalls',
  };

  const { scopes: listScopes } = buildSurfaceList({
    listId: LIST_ID,
    parentId: PAGE_ID,
    label: 'Firewalls',
    totalCount: input.totalCount,
    filtered: hasActiveFilters(input),
    rows: input.firewalls.map(rowOf),
    listObservations: filterObservations(input),
  });
  listScopes[0] = {
    ...listScopes[0],
    state: { loading: input.isLoading, empty: input.firewalls.length === 0 },
  };

  return {
    scopes: [pageScope, ...listScopes],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildFirewallClusterManagementSurface(
  input: FirewallClusterManagementSurfaceInput,
  context: FirewallClusterManagementSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'infrastructure/firewall/clusters',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class FirewallClusterManagementSurfaceRevision {
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
