import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  VNetListSurfaceInput,
  VNetListSurfaceRevision,
  buildVNetListSurface,
  presentedContent,
  vnetEntityRef,
} from './vnet-list-surface';
import { VNetInfo, VNetStatus } from '../../model/vnet.models';

function vnet(over: Partial<VNetInfo> = {}): VNetInfo {
  return {
    id: 'vnet-1',
    providerResourceId: 'prov-vnet-1',
    name: 'prod-network',
    provider: 'hetzner' as VNetInfo['provider'],
    ipRange: '10.0.0.0/16',
    labels: [{ key: 'env', value: 'prod' }],
    status: VNetStatus.ACTIVE,
    subnets: [{ id: 's1', vnetId: 'vnet-1', ipRange: '10.0.1.0/24', networkZone: 'eu-central', gateway: '10.0.1.1', attachedServerIds: ['srv-1'], createdAt: new Date(), updatedAt: new Date() }],
    routes: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  } as VNetInfo;
}

function input(over: Partial<VNetListSurfaceInput> = {}): VNetListSurfaceInput {
  const list = over.visibleVNets ?? [vnet()];
  return {
    visibleVNets: list,
    totalCount: list.length,
    isLoading: false,
    filters: { search: '', provider: '', status: '', clusterId: '' },
    attachedServerCountOf: (v) => v.subnets.reduce((n, s) => n + s.attachedServerIds.length, 0),
    ...over,
  };
}

function snapshotOf(over: Partial<VNetListSurfaceInput> = {}): SurfaceSnapshot {
  return buildVNetListSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const rowScopes = (s: SurfaceSnapshot) => s.scopes.filter((x) => x.kind === 'region');

describe('vnet list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('names only the page in attention — a row click navigates, there is no in-place selection', () => {
    expect(snapshotOf().attention).toEqual([{ scopeId: 'vnet-list', reason: 'route' }]);
    const roles = rowScopes(snapshotOf()).map((r) => r.entities![0].role);
    expect(roles).toEqual(['related']);
  });

  it('uses the namespaced vnet ref for the row entity', () => {
    expect(rowScopes(snapshotOf())[0].entities![0].ref).toBe(vnetEntityRef('vnet-1'));
  });

  it('presents status, provider, subnet count, attached-server count and label count', () => {
    const obs = rowScopes(snapshotOf())[0].observations!;
    expect(obs.find((o) => o.key === 'flui.vnet.status')?.presentedAs.text).toBe('ACTIVE');
    expect(obs.find((o) => o.key === 'flui.vnet.subnet_count')?.presentedAs.value).toBe(1);
    expect(obs.find((o) => o.key === 'flui.vnet.attached_server_count')?.presentedAs.value).toBe(1);
    expect(obs.find((o) => o.key === 'flui.vnet.label_count')?.presentedAs.value).toBe(1);
  });

  it('redacts: the VNet CIDR, subnet CIDR and gateway never reach the snapshot (unclassified backend field — see producer comment)', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('10.0.0.0/16');
    expect(json).not.toContain('10.0.1.0/24');
    expect(json).not.toContain('10.0.1.1');
  });

  it('redacts: raw label key/value content never reaches the snapshot, only a count', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('"env"');
    expect(json).not.toContain('"prod"');
  });

  it('declares filtered when a filter narrows the visible set', () => {
    const snapshot = snapshotOf({ totalCount: 5, filters: { search: '', provider: 'hetzner', status: '', clusterId: '' } });
    expect(listScope(snapshot).completeness).toEqual({ shown: 1, total: 5, filtered: true });
  });

  it('marks loading/empty from the real signals, never inventing rows', () => {
    const loading = snapshotOf({ visibleVNets: [], totalCount: 0, isLoading: true });
    expect(listScope(loading).state).toEqual({ loading: true, empty: true });
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new VNetListSurfaceRevision();
    const first = buildVNetListSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-08-20T09:13:00.000Z' });
    const changed = input({ visibleVNets: [vnet({ status: VNetStatus.FAILED })] });
    const second = buildVNetListSurface(changed, { revision: tracker.next(presentedContent(changed)), generatedAt: '2026-08-20T09:14:00.000Z' });
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
