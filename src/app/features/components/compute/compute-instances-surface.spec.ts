import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  ComputeInstancesSurfaceInput,
  ComputeInstancesSurfaceRevision,
  buildComputeInstancesSurface,
  presentedContent,
} from './compute-instances-surface';
import { InstanceWithLabels } from '../../model/instance.models';

function instance(over: Partial<InstanceWithLabels> = {}): InstanceWithLabels {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    userId: 'user-1',
    name: 'web-01',
    displayName: 'web-01',
    type: 'virtual' as InstanceWithLabels['type'],
    provider: 'hetzner' as InstanceWithLabels['provider'],
    providerId: 'srv-100',
    status: 'running' as InstanceWithLabels['status'],
    dataCenter: 'fsn1',
    region: 'eu-central',
    regionName: 'Falkenstein',
    cpuCores: 2,
    ramMb: 4096,
    diskMb: 40960,
    osType: 'ubuntu-24.04',
    ipConfig: { v4: { ip: '203.0.113.10', gateway: '203.0.113.1', netmaskCidr: 24 } },
    macAddress: '02:00:00:00:00:01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ownership: 'self' as InstanceWithLabels['ownership'],
    ...over,
  };
}

function input(over: Partial<ComputeInstancesSurfaceInput> = {}): ComputeInstancesSurfaceInput {
  const list = over.visibleInstances ?? [instance()];
  return {
    visibleInstances: list,
    totalCount: list.length,
    isLoading: false,
    filters: { search: '', provider: '', status: '', region: '' },
    ...over,
  };
}

function snapshotOf(over: Partial<ComputeInstancesSurfaceInput> = {}): SurfaceSnapshot {
  return buildComputeInstancesSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const rowScopes = (s: SurfaceSnapshot) => s.scopes.filter((x) => x.kind === 'region');

describe('compute instances surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('names only the page in attention — no invented selection on a list with no real selection', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'compute-list', reason: 'route' }]);
  });

  it('lists every visible instance as a related entity, never primary', () => {
    const snapshot = snapshotOf({
      visibleInstances: [instance(), instance({ providerId: 'srv-200', name: 'web-02', displayName: 'web-02' })],
      totalCount: 2,
    });
    const roles = rowScopes(snapshot).map((r) => r.entities![0].role);
    expect(roles).toEqual(['related', 'related']);
  });

  it('gives each instance a stable ref composed of provider and providerId', () => {
    const snapshot = snapshotOf();
    expect(rowScopes(snapshot)[0].entities![0].ref).toBe('flui://instance/hetzner%3Asrv-100');
  });

  it('declares filtered + truncation on the list scope when filters narrow the visible set', () => {
    const snapshot = snapshotOf({
      visibleInstances: [instance()],
      totalCount: 5,
      filters: { search: '', provider: 'hetzner', status: '', region: '' },
    });
    expect(listScope(snapshot).completeness).toEqual({ shown: 1, total: 5, filtered: true });
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new ComputeInstancesSurfaceRevision();
    const first = buildComputeInstancesSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-08-20T09:13:00.000Z' });
    const two = [instance(), instance({ providerId: 'srv-200' })];
    const second = buildComputeInstancesSurface(
      input({ visibleInstances: two, totalCount: 2 }),
      { revision: tracker.next(presentedContent(input({ visibleInstances: two, totalCount: 2 }))), generatedAt: '2026-08-20T09:14:00.000Z' },
    );
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when nothing presented actually changed', () => {
    const tracker = new ComputeInstancesSurfaceRevision();
    const r1 = tracker.next(presentedContent(input()));
    const r2 = tracker.next(presentedContent(input()));
    expect(r2).toBe(r1);
  });

  // The invalid-revision check needs a real failing case exercised, not just trusted.
  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('marks the list loading/empty from the real signals, never inventing rows', () => {
    const loading = snapshotOf({ visibleInstances: [], totalCount: 0, isLoading: true });
    expect(listScope(loading).state).toEqual({ loading: true, empty: true });
    expect(listScope(loading).completeness).toEqual({ shown: 0, total: 0 });
  });

  it('presents active filters as UI observations, and nothing for a cleared filter', () => {
    const snapshot = snapshotOf({ filters: { search: 'web', provider: '', status: 'running', region: '' } });
    const obs = listScope(snapshot).observations ?? [];
    expect(obs.find((o) => o.key === 'flui.compute.search_query')?.presentedAs.text).toBe('web');
    expect(obs.find((o) => o.key === 'flui.compute.status_filter')?.presentedAs.text).toBe('running');
    expect(obs.find((o) => o.key === 'flui.compute.provider_filter')).toBeUndefined();
  });

  it('presents the IPv4 address the row itself renders — mirrors mask mode, does not bypass it', () => {
    // instance-row.component.ts renders `instance.ipConfig.v4.ip` directly, and that
    // field is classified `network-identifier` server-side (instance.dto.ts): mask mode
    // has already substituted it in the API response by the time this producer reads
    // the same `instance` value the row does, on or off.
    const json = JSON.stringify(snapshotOf());
    expect(json).toContain('203.0.113.10');
  });

  it('redacts: MAC address and gateway never reach the snapshot — the row never presents them', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('02:00:00:00:00:01');
    expect(json).not.toContain('203.0.113.1"');
  });
});
