import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  DashboardSurfaceInput,
  DashboardSurfaceRevision,
  buildDashboardSurface,
  presentedContent,
} from './dashboard-surface';

function input(over: Partial<DashboardSurfaceInput> = {}): DashboardSurfaceInput {
  return {
    loading: false,
    backendHealth: 'online',
    activeOperations: 0,
    providersConnected: 2,
    clustersTotal: 3,
    clustersActive: 2,
    clustersUnhealthy: 1,
    clusterNodesTotal: 9,
    appsTotal: 12,
    appsRunning: 10,
    appsFailed: 1,
    appsDatabases: 4,
    appsApplications: 6,
    appsTools: 2,
    ...over,
  };
}

function snapshotOf(over: Partial<DashboardSurfaceInput> = {}): SurfaceSnapshot {
  return buildDashboardSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
}

const pageScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.id === 'dashboard')!;
const observation = (snapshot: SurfaceSnapshot, key: string) =>
  pageScope(snapshot).observations?.find((o) => o.key === key);

describe('dashboard surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new DashboardSurfaceRevision();
    const first = buildDashboardSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-08-20T09:13:00.000Z' });
    const second = buildDashboardSurface(
      input({ clustersTotal: 4 }),
      { revision: tracker.next(presentedContent(input({ clustersTotal: 4 }))), generatedAt: '2026-08-20T09:14:00.000Z' },
    );
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when nothing presented actually changed', () => {
    const tracker = new DashboardSurfaceRevision();
    const r1 = tracker.next(presentedContent(input()));
    const r2 = tracker.next(presentedContent(input()));
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

  it('claims only the page, with reason route — a cross-cutting summary has no single entity to focus on', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'dashboard', reason: 'route' }]);
    expect(pageScope(snapshot).entities).toBeUndefined();
  });

  it('presents the counts actually shown across the page\'s own cards', () => {
    const snapshot = snapshotOf();
    expect(observation(snapshot, 'flui.dashboard.backend_health')?.presentedAs.text).toBe('online');
    expect(observation(snapshot, 'flui.dashboard.clusters_total')?.presentedAs.value).toBe(3);
    expect(observation(snapshot, 'flui.dashboard.clusters_active')?.presentedAs.value).toBe(2);
    expect(observation(snapshot, 'flui.dashboard.clusters_unhealthy')?.presentedAs.value).toBe(1);
    expect(observation(snapshot, 'flui.dashboard.apps_running')?.presentedAs.value).toBe(10);
    expect(observation(snapshot, 'flui.dashboard.apps_failed')?.presentedAs.value).toBe(1);
  });

  it('omits a zero-valued count, mirroring the app producer\'s own diagnoses-badge pattern', () => {
    const snapshot = snapshotOf({ activeOperations: 0, clusterNodesTotal: 0 });
    expect(observation(snapshot, 'flui.dashboard.active_operations')).toBeUndefined();
    expect(observation(snapshot, 'flui.dashboard.cluster_nodes_total')).toBeUndefined();
  });

  it('omits backend health while it is still "checking" — that state never survives past the skeleton', () => {
    const snapshot = snapshotOf({ backendHealth: 'checking' });
    expect(observation(snapshot, 'flui.dashboard.backend_health')).toBeUndefined();
  });

  it('invents no counts while the skeleton is showing — state.loading carries that, not fabricated zeros', () => {
    const snapshot = snapshotOf({ loading: true });
    expect(pageScope(snapshot).observations).toEqual([]);
    expect(pageScope(snapshot).state).toEqual({ loading: true });
  });

  it('never sets state.error/empty on this page — those describe a failed/absent view, and this page never fails to load, only its underlying services can be individually unreachable', () => {
    expect(pageScope(snapshotOf()).state).toEqual({ loading: false });
  });

  it('redacts: every input field is a count or a closed enum, so only the allowlisted flui.dashboard.* keys ever reach the snapshot — nothing free-text, nothing from raw API payloads', () => {
    const snapshot = snapshotOf();
    const keys = (pageScope(snapshot).observations ?? []).map((o) => o.key);
    expect(keys.every((k) => k.startsWith('flui.dashboard.'))).toBe(true);
    expect(pageScope(snapshot).observations?.every((o) => o.presentedAs.text === undefined || o.source === 'api')).toBe(true);
  });
});
