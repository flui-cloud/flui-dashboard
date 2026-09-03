import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  VNetDetailSurfaceInput,
  VNetDetailSurfaceRevision,
  buildVNetDetailSurface,
  presentedContent,
} from './vnet-details-surface';
import { vnetEntityRef } from './vnet-list-surface';
import { VNetInfo, VNetStatus } from '../../model/vnet.models';
import { InstanceWithLabels } from '../../model/instance.models';

const VNET: VNetInfo = {
  id: 'vnet-1',
  providerResourceId: 'prov-vnet-1',
  name: 'prod-network',
  provider: 'hetzner' as VNetInfo['provider'],
  ipRange: '10.0.0.0/16',
  labels: [{ key: 'env', value: 'prod' }],
  status: VNetStatus.ACTIVE,
  subnets: [{ id: 's1', vnetId: 'vnet-1', ipRange: '10.0.1.0/24', networkZone: 'eu-central', gateway: '10.0.1.1', attachedServerIds: ['srv-1'], createdAt: new Date(), updatedAt: new Date() }],
  routes: [{ id: 'r1', destination: '0.0.0.0/0', gateway: '10.0.0.1' }],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
} as VNetInfo;

function server(over: Partial<InstanceWithLabels> = {}): InstanceWithLabels {
  return {
    id: 'srv-1',
    userId: 'u1',
    name: 'web-01',
    displayName: 'web-01',
    type: 'virtual' as InstanceWithLabels['type'],
    provider: 'hetzner' as InstanceWithLabels['provider'],
    providerId: 'p-srv-1',
    status: 'running' as InstanceWithLabels['status'],
    dataCenter: 'fsn1',
    region: 'eu-central',
    cpuCores: 2,
    ramMb: 4096,
    diskMb: 40960,
    osType: 'ubuntu-24.04',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function input(over: Partial<VNetDetailSurfaceInput> = {}): VNetDetailSurfaceInput {
  return {
    vnet: VNET,
    totalAttachedServers: 1,
    attachedInstances: [server()],
    ...over,
  };
}

function snapshotOf(over: Partial<VNetDetailSurfaceInput> = {}): SurfaceSnapshot {
  const snapshot = buildVNetDetailSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
  if (!snapshot) throw new Error('the producer described nothing');
  return snapshot;
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'page')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('vnet detail surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('claims the page and the vnet itself, with reason route', () => {
    const snapshot = snapshotOf();
    const ref = vnetEntityRef('vnet-1');
    expect(snapshot.attention).toEqual([{ scopeId: 'vnet-detail:vnet-1', entityRef: ref, reason: 'route' }]);
    expect(pageScope(snapshot).entities![0]).toEqual({ ref, label: 'prod-network', role: 'primary' });
  });

  it('names an attached, resolved server as a related entity using the canonical instance ref', () => {
    const snapshot = snapshotOf();
    expect(pageScope(snapshot).entities![1]).toEqual({
      ref: 'flui://instance/hetzner%3Ap-srv-1',
      label: 'web-01',
      role: 'related',
    });
  });

  it('never names an attached server whose instance has not resolved yet — no fabricated ref from a bare id', () => {
    const snapshot = snapshotOf({ attachedInstances: [] });
    expect(pageScope(snapshot).entities!.length).toBe(1);
  });

  it('dedupes an instance attached to more than one subnet to a single entity', () => {
    const snapshot = snapshotOf({ attachedInstances: [server(), server()] });
    expect(pageScope(snapshot).entities!.length).toBe(2);
  });

  it('presents status, provider, subnet/route/label counts and attached-server count', () => {
    const snapshot = snapshotOf();
    expect(observation(snapshot, 'flui.vnet.status')?.presentedAs.text).toBe('ACTIVE');
    expect(observation(snapshot, 'flui.vnet.subnet_count')?.presentedAs.value).toBe(1);
    expect(observation(snapshot, 'flui.vnet.route_count')?.presentedAs.value).toBe(1);
    expect(observation(snapshot, 'flui.vnet.label_count')?.presentedAs.value).toBe(1);
    expect(observation(snapshot, 'flui.vnet.attached_server_count')?.presentedAs.value).toBe(1);
  });

  it('redacts: VNet/subnet CIDR, gateway and route destination never reach the snapshot', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('10.0.0.0/16');
    expect(json).not.toContain('10.0.1.0/24');
    expect(json).not.toContain('10.0.1.1');
    expect(json).not.toContain('0.0.0.0/0');
  });

  it('redacts: raw label key/value content never reaches the snapshot, only a count', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('"env"');
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new VNetDetailSurfaceRevision();
    const first = buildVNetDetailSurface(input(), { revision: tracker.next(presentedContent(input())!), generatedAt: '2026-08-20T09:13:00.000Z' })!;
    const changed = input({ vnet: { ...VNET, status: VNetStatus.FAILED } });
    const second = buildVNetDetailSurface(changed, { revision: tracker.next(presentedContent(changed)!), generatedAt: '2026-08-20T09:14:00.000Z' })!;
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

  it('produces no snapshot at all when there is no vnet loaded — no invented selection', () => {
    expect(buildVNetDetailSurface(input({ vnet: null }), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' })).toBeNull();
  });
});
