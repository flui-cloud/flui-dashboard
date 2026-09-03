import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  ClusterListSurfaceInput,
  ClusterListSurfaceRevision,
  buildClusterListSurface,
  presentedContent,
} from './cluster-list-surface';
import { clusterEntityRef } from './cluster-surface';
import { ClusterInfo, ClusterStatus, ProviderType } from '../../model/cluster.models';

const CLUSTER_A: ClusterInfo = {
  id: 'a1000000-0000-4000-8000-000000000001',
  name: 'workload-cluster-1',
  status: ClusterStatus.ACTIVE,
  provider: ProviderType.HETZNER,
  region: 'fsn1',
  nodeCount: 3,
  autoScalingEnabled: true,
  version: '1.30',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const CLUSTER_B: ClusterInfo = {
  id: 'b2000000-0000-4000-8000-000000000002',
  name: 'control-cluster',
  status: ClusterStatus.ERROR,
  provider: ProviderType.CONTABO,
  region: 'eu-west',
  nodeCount: 1,
};

const NO_FILTERS = { search: '', provider: '', status: '', region: '' };

function input(over: Partial<ClusterListSurfaceInput> = {}): ClusterListSurfaceInput {
  return {
    allClusters: [CLUSTER_A, CLUSTER_B],
    filteredClusters: [CLUSTER_A, CLUSTER_B],
    filters: NO_FILTERS,
    loading: false,
    ...over,
  };
}

function snapshotOf(over: Partial<ClusterListSurfaceInput> = {}): SurfaceSnapshot {
  return buildClusterListSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
}

const listScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.id === 'cluster-list:rows')!;
const rowScopes = (snapshot: SurfaceSnapshot) => snapshot.scopes.filter((s) => s.parentId === 'cluster-list:rows');

describe('cluster list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new ClusterListSurfaceRevision();
    const first = buildClusterListSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-08-20T09:13:00.000Z' });
    const second = buildClusterListSurface(
      input({ filteredClusters: [CLUSTER_A] }),
      { revision: tracker.next(presentedContent(input({ filteredClusters: [CLUSTER_A] }))), generatedAt: '2026-08-20T09:14:00.000Z' },
    );
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when only an unpresented input field changes', () => {
    // `masterIpAddress` is on ClusterInfo but no row observation ever reads it.
    const tracker = new ClusterListSurfaceRevision();
    const a = input({ allClusters: [{ ...CLUSTER_A, masterIpAddress: '10.0.0.1' }, CLUSTER_B], filteredClusters: [{ ...CLUSTER_A, masterIpAddress: '10.0.0.1' }, CLUSTER_B] });
    const b = input({ allClusters: [{ ...CLUSTER_A, masterIpAddress: '10.0.0.9' }, CLUSTER_B], filteredClusters: [{ ...CLUSTER_A, masterIpAddress: '10.0.0.9' }, CLUSTER_B] });
    const r1 = tracker.next(presentedContent(a));
    const r2 = tracker.next(presentedContent(b));
    expect(r2).toBe(r1);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });

  it('claims only the page — no entity, because clicking a row navigates, it does not select', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'cluster-list', reason: 'route' }]);
  });

  it('lists every row as related, never primary', () => {
    const snapshot = snapshotOf();
    const rows = rowScopes(snapshot);
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.entities?.[0].role).toBe('related');
    }
    expect(rows.find((r) => r.entities?.[0].ref === clusterEntityRef(CLUSTER_A.id!))).toBeTruthy();
  });

  it('carries completeness — shown vs total, and filtered when a filter narrowed the rows', () => {
    const unfiltered = snapshotOf();
    expect(listScope(unfiltered).completeness).toEqual({ shown: 2, total: 2 });

    const filtered = snapshotOf({ filteredClusters: [CLUSTER_A], filters: { ...NO_FILTERS, status: 'active' } });
    expect(listScope(filtered).completeness).toEqual({ shown: 1, total: 2, filtered: true });
  });

  it('presents the active filter values actually typed into the page, and nothing when they are empty', () => {
    const none = snapshotOf();
    expect(listScope(none).observations).toEqual([]);

    const withFilter = snapshotOf({ filters: { ...NO_FILTERS, provider: 'hetzner' } });
    expect(listScope(withFilter).observations).toEqual([
      { key: 'flui.cluster_list.filter_provider', presentedAs: { text: 'hetzner' }, source: 'ui' },
    ]);
  });

  it('presents each row\'s status/provider/region/nodes/version/created facts, and skips optional ones that are absent', () => {
    const snapshot = snapshotOf();
    const rowA = rowScopes(snapshot).find((r) => r.entities?.[0].ref === clusterEntityRef(CLUSTER_A.id!))!;
    const keys = rowA.observations!.map((o) => o.key);
    expect(keys).toContain('flui.cluster.status');
    expect(keys).toContain('flui.cluster.node_count');
    expect(keys).toContain('flui.cluster.auto_scaling_enabled');
    expect(keys).toContain('flui.cluster.version');
    expect(keys).toContain('flui.cluster.created_at');

    const rowB = rowScopes(snapshot).find((r) => r.entities?.[0].ref === clusterEntityRef(CLUSTER_B.id!))!;
    const keysB = rowB.observations!.map((o) => o.key);
    expect(keysB).not.toContain('flui.cluster.auto_scaling_enabled');
    expect(keysB).not.toContain('flui.cluster.version');
    expect(keysB).not.toContain('flui.cluster.created_at');
  });

  it('never invents rows or completeness while the list is loading — the loading state is carried on scope.state, not fabricated content', () => {
    const snapshot = snapshotOf({ loading: true, filteredClusters: [], allClusters: [] });
    expect(rowScopes(snapshot).length).toBe(0);
    expect(listScope(snapshot).completeness).toEqual({ shown: 0, total: 0 });
    expect(listScope(snapshot).state).toEqual({ loading: true, empty: false });
  });

  it('marks the list empty (not an error) when loading finished with zero rows', () => {
    const snapshot = snapshotOf({ loading: false, filteredClusters: [], allClusters: [] });
    expect(listScope(snapshot).state).toEqual({ loading: false, empty: true });
  });

  it('redacts: no master IP or other internal metadata beyond entity refs and the presented fields reach the snapshot', () => {
    const json = JSON.stringify(snapshotOf({
      allClusters: [{ ...CLUSTER_A, masterIpAddress: '10.0.0.5' }, CLUSTER_B],
      filteredClusters: [{ ...CLUSTER_A, masterIpAddress: '10.0.0.5' }, CLUSTER_B],
    }));
    expect(json).not.toContain('10.0.0.5');
  });
});
