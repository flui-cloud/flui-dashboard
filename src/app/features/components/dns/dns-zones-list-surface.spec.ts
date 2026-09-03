import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  DnsZonesListSurfaceInput,
  DnsZonesListSurfaceRevision,
  buildDnsZonesListSurface,
  dnsZoneEntityRef,
  presentedContent,
} from './dns-zones-list-surface';
import { DnsZoneResponseDto } from '../../../core/api/model/dnsZoneResponseDto';

function zone(over: Partial<DnsZoneResponseDto> = {}): DnsZoneResponseDto {
  return {
    id: 'zone-1',
    providerZoneId: 'prov-zone-1',
    zoneName: 'example.com',
    dnsProvider: DnsZoneResponseDto.DnsProviderEnum.Hetzner,
    description: 'primary zone',
    recordTtlSeconds: 60,
    replicas: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function input(over: Partial<DnsZonesListSurfaceInput> = {}): DnsZonesListSurfaceInput {
  return {
    zones: [zone()],
    isLoading: false,
    expandedZoneId: null,
    providerCountOf: () => 1,
    ttlOf: () => 60,
    assignedClusterCountOf: () => 0,
    ...over,
  };
}

function snapshotOf(over: Partial<DnsZonesListSurfaceInput> = {}): SurfaceSnapshot {
  return buildDnsZonesListSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const rowScope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === `dns-zones:zones:${id}`)!;

describe('dns zones list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('names only the page when no zone is expanded — no invented selection', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'dns-zones', reason: 'route' }]);
    expect(rowScope(snapshot, 'zone-1').entities![0].role).toBe('related');
  });

  it('names the expanded zone in attention, reason selection — a real, single-valued product state', () => {
    const snapshot = snapshotOf({ expandedZoneId: 'zone-1' });
    expect(snapshot.attention).toEqual([
      { scopeId: 'dns-zones:zones:zone-1', entityRef: dnsZoneEntityRef('zone-1'), reason: 'selection' },
    ]);
    expect(rowScope(snapshot, 'zone-1').entities![0].role).toBe('selected');
  });

  it('presents provider, description, provider count, TTL and assigned-cluster count', () => {
    const snapshot = snapshotOf({ assignedClusterCountOf: () => 2 });
    const obs = rowScope(snapshot, 'zone-1').observations!;
    expect(obs.find((o) => o.key === 'flui.dns_zone.provider')?.presentedAs.text).toBe('hetzner');
    expect(obs.find((o) => o.key === 'flui.dns_zone.description')?.presentedAs.text).toBe('primary zone');
    expect(obs.find((o) => o.key === 'flui.dns_zone.provider_count')?.presentedAs.value).toBe(1);
    expect(obs.find((o) => o.key === 'flui.dns_zone.ttl_seconds')?.presentedAs).toEqual({ value: 60, unit: 'seconds' });
    expect(obs.find((o) => o.key === 'flui.dns_zone.assigned_cluster_count')?.presentedAs.value).toBe(2);
  });

  it('omits the TTL observation when the enriched read has not resolved yet', () => {
    const snapshot = snapshotOf({ ttlOf: () => undefined });
    expect(rowScope(snapshot, 'zone-1').observations!.find((o) => o.key === 'flui.dns_zone.ttl_seconds')).toBeUndefined();
  });

  it('marks loading/empty from the real signals, never inventing rows', () => {
    const loading = snapshotOf({ zones: [], isLoading: true });
    expect(listScope(loading).state).toEqual({ loading: true, empty: true });
  });

  it('bumps the revision on real change (expanding a zone), and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new DnsZonesListSurfaceRevision();
    const first = buildDnsZonesListSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-08-20T09:13:00.000Z' });
    const expanded = input({ expandedZoneId: 'zone-1' });
    const second = buildDnsZonesListSurface(expanded, { revision: tracker.next(presentedContent(expanded)), generatedAt: '2026-08-20T09:14:00.000Z' });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  // The invalid-revision check needs a real failing case exercised, not just trusted.
  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });
});
