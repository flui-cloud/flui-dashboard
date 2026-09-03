import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  ClusterSurfaceInput,
  ClusterSurfaceRevision,
  clusterEntityRef,
  buildClusterSurface,
  presentedContent,
} from './cluster-surface';
import { ClusterInfo, ClusterStatus, ClusterType, ProviderType } from '../../model/cluster.models';

const CLUSTER: ClusterInfo = {
  id: 'c1b2c3d4-0000-4000-8000-000000000001',
  name: 'workload-cluster-1',
  status: ClusterStatus.ACTIVE,
  clusterType: ClusterType.WORKLOAD,
  provider: ProviderType.HETZNER,
  region: 'fsn1',
  nodeCount: 3,
  masterIpAddress: '10.0.0.5',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function input(over: Partial<ClusterSurfaceInput> = {}): ClusterSurfaceInput {
  return {
    cluster: CLUSTER,
    activeTab: 'overview',
    readOnly: false,
    isControlCluster: false,
    ...over,
  };
}

function snapshotOf(over: Partial<ClusterSurfaceInput> = {}): SurfaceSnapshot {
  const snapshot = buildClusterSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
  if (!snapshot) throw new Error('the producer described nothing');
  return snapshot;
}

const pageScope = (snapshot: SurfaceSnapshot) =>
  snapshot.scopes.find((s) => s.id.startsWith('cluster-detail:') && s.kind === 'page')!;
const observation = (snapshot: SurfaceSnapshot, key: string) =>
  pageScope(snapshot).observations?.find((o) => o.key === key);

describe('cluster surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new ClusterSurfaceRevision();
    const first = buildClusterSurface(input(), { revision: tracker.next(presentedContent(input())!), generatedAt: '2026-08-20T09:13:00.000Z' })!;
    const second = buildClusterSurface(
      input({ activeTab: 'monitoring' }),
      { revision: tracker.next(presentedContent(input({ activeTab: 'monitoring' }))!), generatedAt: '2026-08-20T09:14:00.000Z' },
    )!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when only an unpresented input field changes', () => {
    // `masterIpAddress` and `nodeCount` are on ClusterInfo but never read by
    // pageObservations() — this shell page does not present them (only a child tab
    // would, out of scope for this pass).
    const tracker = new ClusterSurfaceRevision();
    const a = input({ cluster: { ...CLUSTER, masterIpAddress: '10.0.0.5', nodeCount: 3 } });
    const b = input({ cluster: { ...CLUSTER, masterIpAddress: '10.0.0.9', nodeCount: 7 } });
    const r1 = tracker.next(presentedContent(a)!);
    const r2 = tracker.next(presentedContent(b)!);
    expect(r2).toBe(r1);
  });

  // The invalid-revision check needs a real failing case exercised, not just trusted.
  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });

  it('claims the page and the cluster itself, with reason route', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([
      { scopeId: `cluster-detail:${CLUSTER.id}`, entityRef: clusterEntityRef(CLUSTER.id!), reason: 'route' },
    ]);
    expect(pageScope(snapshot).entities).toEqual([
      { ref: clusterEntityRef(CLUSTER.id!), label: CLUSTER.name, role: 'primary' },
    ]);
  });

  it('adds one tab scope for the active tab, owned by the page scope', () => {
    const snapshot = snapshotOf({ activeTab: 'monitoring' });
    const tab = snapshot.scopes.find((s) => s.kind === 'region');
    expect(tab).toEqual({
      id: `cluster-detail:${CLUSTER.id}:tab:monitoring`,
      parentId: `cluster-detail:${CLUSTER.id}`,
      kind: 'region',
      label: 'Monitoring',
      observations: [
        { key: 'flui.cluster.active_tab', presentedAs: { text: 'monitoring' }, source: 'ui' },
      ],
    });
  });

  it('adds no tab scope when the router reports none', () => {
    const snapshot = snapshotOf({ activeTab: null });
    expect(snapshot.scopes.length).toBe(1);
  });

  it('says nothing about read-only/control-cluster when neither applies, and names them when they do', () => {
    expect(observation(snapshotOf({ readOnly: false, isControlCluster: false }), 'flui.cluster.read_only')).toBeUndefined();
    expect(observation(snapshotOf({ readOnly: false, isControlCluster: false }), 'flui.cluster.control_cluster')).toBeUndefined();
    expect(observation(snapshotOf({ readOnly: true }), 'flui.cluster.read_only')?.presentedAs.value).toBe(true);
    expect(observation(snapshotOf({ isControlCluster: true }), 'flui.cluster.control_cluster')?.presentedAs.value).toBe(true);
  });

  it('never presents cluster.status — this shell page renders no status text of its own (§4.3 also means: no invented observation for what is not shown)', () => {
    expect(observation(snapshotOf(), 'flui.cluster.status')).toBeUndefined();
    expect(pageScope(snapshotOf()).state).toBeUndefined();
  });

  it('produces no snapshot at all when there is no cluster loaded — no invented selection', () => {
    expect(buildClusterSurface(input({ cluster: null }), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' }))
      .toBeNull();
    expect(buildClusterSurface(input({ cluster: { ...CLUSTER, id: undefined } }), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' }))
      .toBeNull();
  });

  it('redacts: no raw master IP, no internal metadata beyond the entity ref reach the snapshot', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('10.0.0.5');
  });
});
