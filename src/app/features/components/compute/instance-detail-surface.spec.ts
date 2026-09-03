import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  InstanceDetailSurfaceInput,
  InstanceDetailSurfaceRevision,
  buildInstanceDetailSurface,
  presentedContent,
} from './instance-detail-surface';
import { InstanceWithLabels } from '../../model/instance.models';

const INSTANCE: InstanceWithLabels = {
  id: 'inst-1',
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
  ipConfig: { v4: { ip: '203.0.113.10', gateway: '203.0.113.1', netmaskCidr: 24 }, v6: { ip: '2001:db8::10', gateway: '2001:db8::1', netmaskCidr: 64 } },
  macAddress: '02:00:00:00:00:01',
  productType: 'cx22',
  productName: 'CX22',
  defaultUser: 'root',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
  ownership: 'self' as InstanceWithLabels['ownership'],
};

function input(over: Partial<InstanceDetailSurfaceInput> = {}): InstanceDetailSurfaceInput {
  return {
    instance: INSTANCE,
    ownership: 'self',
    clusterInfo: null,
    ...over,
  };
}

function snapshotOf(over: Partial<InstanceDetailSurfaceInput> = {}): SurfaceSnapshot {
  const snapshot = buildInstanceDetailSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
  if (!snapshot) throw new Error('the producer described nothing');
  return snapshot;
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'page')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('instance detail surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('claims the page and the instance itself, with reason route', () => {
    const snapshot = snapshotOf();
    const ref = 'flui://instance/hetzner%3Asrv-100';
    expect(snapshot.attention).toEqual([
      { scopeId: `instance-detail:hetzner:srv-100`, entityRef: ref, reason: 'route' },
    ]);
    expect(pageScope(snapshot).entities![0]).toEqual({ ref, label: 'web-01', role: 'primary' });
  });

  it('adds the owning cluster as a related entity when the instance belongs to one', () => {
    const snapshot = snapshotOf({ clusterInfo: { clusterId: 'cl-1', clusterName: 'prod', nodeType: 'worker' } });
    expect(pageScope(snapshot).entities).toEqual([
      { ref: 'flui://instance/hetzner%3Asrv-100', label: 'web-01', role: 'primary' },
      { ref: 'flui://cluster/cl-1', label: 'prod', role: 'related' },
    ]);
  });

  it('adds no cluster entity when the instance is not part of one', () => {
    const snapshot = snapshotOf({ clusterInfo: null });
    expect(pageScope(snapshot).entities!.length).toBe(1);
  });

  it('presents the resource specs, network addresses and identity fields actually shown on screen', () => {
    const snapshot = snapshotOf();
    expect(observation(snapshot, 'flui.instance.cpu_cores')?.presentedAs).toEqual({ value: 2 });
    expect(observation(snapshot, 'flui.instance.ram_mb')?.presentedAs).toEqual({ value: 4096 });
    expect(observation(snapshot, 'flui.instance.ip_v4')?.presentedAs.text).toBe('203.0.113.10');
    expect(observation(snapshot, 'flui.instance.ip_v6')?.presentedAs.text).toBe('2001:db8::10');
    expect(observation(snapshot, 'flui.instance.mac_address')?.presentedAs.text).toBe('02:00:00:00:00:01');
    expect(observation(snapshot, 'flui.instance.os_type')?.presentedAs.text).toBe('ubuntu-24.04');
    expect(observation(snapshot, 'flui.instance.ownership')?.presentedAs.text).toBe('self');
  });

  it(
    'presents the IPv4/IPv6 address as shown on screen: `ip` is classified network-identifier ' +
      'server-side and mask mode already substitutes it before this producer reads the same ' +
      '`instance` value the page renders — this does not duplicate a real address mask mode covers',
    () => {
      const json = JSON.stringify(snapshotOf());
      expect(json).toContain('203.0.113.10');
    },
  );

  it('never presents the gateway address — the page does not render it, mask-mode question aside', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('203.0.113.1"');
    expect(json).not.toContain('2001:db8::1"');
  });

  it('never sets scope.state from the instance status — it is presented as an observation instead', () => {
    expect(pageScope(snapshotOf()).state).toBeUndefined();
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new InstanceDetailSurfaceRevision();
    const first = buildInstanceDetailSurface(input(), { revision: tracker.next(presentedContent(input())!), generatedAt: '2026-08-20T09:13:00.000Z' })!;
    const changed = input({ instance: { ...INSTANCE, status: 'stopped' as InstanceWithLabels['status'] } });
    const second = buildInstanceDetailSurface(changed, { revision: tracker.next(presentedContent(changed)!), generatedAt: '2026-08-20T09:14:00.000Z' })!;
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

  it('produces no snapshot at all when there is no instance loaded — no invented selection', () => {
    expect(buildInstanceDetailSurface(input({ instance: null }), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' })).toBeNull();
  });

  it('redacts: additionalIps and arbitrary metadata never reach the snapshot even if present on the DTO', () => {
    const withExtra = { ...INSTANCE, additionalIps: ['198.51.100.9'], metadata: { labels: { 'managed-by': 'flui-cloud' }, secret: 'hunter2' } } as InstanceWithLabels;
    const json = JSON.stringify(snapshotOf({ instance: withExtra }));
    expect(json).not.toContain('198.51.100.9');
    expect(json).not.toContain('hunter2');
  });
});
