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
import type { DnsZoneResponseDto } from '../../../core/api/model/dnsZoneResponseDto';

const PAGE_ID = 'dns-zones';
const LIST_ID = `${PAGE_ID}:zones`;

export function dnsZoneEntityRef(id: string): string {
  return entityRef('dns-zone', id);
}

export interface DnsZonesListSurfaceInput {
  zones: DnsZoneResponseDto[];
  isLoading: boolean;
  /** `expandedZoneId` in dns-zones-list.component.ts — the one real per-instance state
   * this page has: opening a zone's Redundancy panel presents more about that zone
   * specifically. Real, single-valued product state, not invented for this producer. */
  expandedZoneId: string | null;
  providerCountOf: (zoneId: string) => number;
  ttlOf: (zoneId: string) => number | undefined;
  assignedClusterCountOf: (zoneId: string) => number;
}

export interface DnsZonesListSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function rowOf(zone: DnsZoneResponseDto, input: DnsZonesListSurfaceInput): SurfaceListRow {
  const expanded = input.expandedZoneId === zone.id;
  const ttl = input.ttlOf(zone.id);
  return {
    id: `${LIST_ID}:${zone.id}`,
    ref: dnsZoneEntityRef(zone.id),
    label: zone.zoneName,
    role: expanded ? 'selected' : 'related',
    observations: [
      textObservation('flui.dns_zone.provider', zone.dnsProvider, 'api'),
      textObservation('flui.dns_zone.description', zone.description, 'api'),
      valueObservation('flui.dns_zone.provider_count', input.providerCountOf(zone.id), 'derived'),
      ttl !== undefined ? valueObservation('flui.dns_zone.ttl_seconds', ttl, 'api', 'seconds') : null,
      valueObservation('flui.dns_zone.assigned_cluster_count', input.assignedClusterCountOf(zone.id), 'api'),
      textObservation('flui.dns_zone.created_at', zone.createdAt, 'api'),
    ].filter((o): o is Observation => o !== null),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything the Registered Zones tab (behind the sidebar's "Domains" item, routed via
 * DnsShellComponent → dns-zones-list.component.ts) would present, without the
 * revision/timestamp envelope. Rows navigate nowhere on click, but opening a zone's
 * Redundancy panel (`toggleReplicas`) is real, single-valued per-instance state, so that
 * one zone — if any — is named in attention with reason 'selection'; otherwise attention
 * names only the page, same as any other list with no selection (playbook §4).
 */
export function presentedContent(input: DnsZonesListSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'DNS Zones',
  };

  const rows = input.zones.map((zone) => ({ zone, row: rowOf(zone, input) }));

  const { scopes: listScopes } = buildSurfaceList({
    listId: LIST_ID,
    parentId: PAGE_ID,
    label: 'Zones',
    totalCount: input.zones.length,
    rows: rows.map((r) => r.row),
  });
  listScopes[0] = {
    ...listScopes[0],
    state: { loading: input.isLoading, empty: input.zones.length === 0 },
  };

  const expanded = rows.find((r) => r.zone.id === input.expandedZoneId);
  const attention: AttentionTarget[] = expanded
    ? [{ scopeId: expanded.row.id, entityRef: expanded.row.ref, reason: 'selection' }]
    : [{ scopeId: PAGE_ID, reason: 'route' }];

  return { scopes: [pageScope, ...listScopes], attention };
}

export function buildDnsZonesListSurface(
  input: DnsZonesListSurfaceInput,
  context: DnsZonesListSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'infrastructure/domains/zones',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class DnsZonesListSurfaceRevision {
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
