import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  ScalingSurfaceInput,
  ScalingSurfaceRevision,
  buildScalingSurface,
  presentedContent,
} from './scaling-surface';
import { clusterEntityRef } from '../cluster/cluster-surface';
import { ClusterScalingRow } from '../../model/scaling-section.models';

const ROW_A: ClusterScalingRow = {
  clusterId: 'a1000000-0000-4000-8000-000000000001',
  clusterName: 'workload-cluster-1',
  capability: { provider: 'hetzner', canProvision: true, hasCatalogue: true, billing: 'hourly' },
  groupId: 'grp-1',
  groupCount: 1,
  bounds: { min: 2, desired: 4, max: 8 },
  nodes: 4,
  monthlyEur: 120.5,
  unpricedNodes: 0,
  monthlyCap: null,
  pendingPods: null,
  acts: true,
  openOrders: 0,
  blockedOrders: 0,
  openAlarm: null,
  lastDecisionAt: null,
  needsPerson: null,
};

const ROW_B: ClusterScalingRow = {
  clusterId: 'b2000000-0000-4000-8000-000000000002',
  clusterName: 'control-cluster',
  capability: { provider: 'byos', canProvision: false, hasCatalogue: false, billing: 'none' },
  groupId: null,
  groupCount: 0,
  bounds: null,
  nodes: 1,
  monthlyEur: null,
  unpricedNodes: 0,
  monthlyCap: null,
  pendingPods: null,
  acts: false,
  openOrders: 0,
  blockedOrders: 0,
  openAlarm: { since: '2026-08-19T12:00:00.000Z', asks: 'attach a 4 vCPU / 8GB machine' },
  lastDecisionAt: null,
  needsPerson: 'Attach a machine that meets the stated shape.',
};

function input(over: Partial<ScalingSurfaceInput> = {}): ScalingSurfaceInput {
  return {
    rows: [ROW_A, ROW_B],
    loading: false,
    absent: false,
    failed: false,
    ...over,
  };
}

function snapshotOf(over: Partial<ScalingSurfaceInput> = {}): SurfaceSnapshot {
  return buildScalingSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
}

const listScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.id === 'scaling-overview:rows')!;
const rowScopes = (snapshot: SurfaceSnapshot) => snapshot.scopes.filter((s) => s.parentId === 'scaling-overview:rows');
const rowFor = (snapshot: SurfaceSnapshot, clusterId: string) =>
  rowScopes(snapshot).find((r) => r.entities?.[0].ref === clusterEntityRef(clusterId))!;

describe('scaling surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new ScalingSurfaceRevision();
    const first = buildScalingSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-08-20T09:13:00.000Z' });
    const second = buildScalingSurface(
      input({ rows: [ROW_A] }),
      { revision: tracker.next(presentedContent(input({ rows: [ROW_A] }))), generatedAt: '2026-08-20T09:14:00.000Z' },
    );
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });

  it('claims only the page — no entity, because "Manage"/"Set up scaling" on a row navigates or expands, it does not select', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'scaling-overview', reason: 'route' }]);
  });

  it('lists every row as related, referencing the same cluster ref cluster-list/cluster-detail use', () => {
    const snapshot = snapshotOf();
    const rows = rowScopes(snapshot);
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.entities?.[0].role).toBe('related');
    }
    expect(rowFor(snapshot, ROW_A.clusterId)).toBeTruthy();
  });

  it('presents the situation tiles (needing/alarms/spend) computed from the same rows the row scopes are built from', () => {
    const snapshot = snapshotOf();
    const observations = listScope(snapshot).observations!;
    expect(observations.find((o) => o.key === 'flui.scaling.needs_person_count')?.presentedAs.value).toBe(1);
    expect(observations.find((o) => o.key === 'flui.scaling.open_alarms_count')?.presentedAs.value).toBe(1);
    expect(observations.find((o) => o.key === 'flui.scaling.billed_monthly')?.presentedAs).toEqual({ value: 120.5, unit: 'EUR' });
  });

  it('presents "no bill" as text when nothing is priced across any row', () => {
    const unpriced = { ...ROW_A, monthlyEur: null };
    const snapshot = snapshotOf({ rows: [unpriced] });
    expect(listScope(snapshot).observations!.find((o) => o.key === 'flui.scaling.billed_monthly')?.presentedAs.text).toBe('no bill');
  });

  it("presents each row's mode/nodes/bounds/spend/has_group facts", () => {
    const snapshot = snapshotOf();
    const rowA = rowFor(snapshot, ROW_A.clusterId);
    expect(rowA.observations!.find((o) => o.key === 'flui.scaling.mode')?.presentedAs.text).toBe('Flui buys');
    expect(rowA.observations!.find((o) => o.key === 'flui.scaling.nodes')?.presentedAs.value).toBe(4);
    expect(rowA.observations!.find((o) => o.key === 'flui.scaling.bounds')?.presentedAs.text).toBe('2·4·8');
    expect(rowA.observations!.find((o) => o.key === 'flui.scaling.monthly_eur')?.presentedAs).toEqual({ value: 120.5, unit: 'EUR' });
    expect(rowA.observations!.find((o) => o.key === 'flui.scaling.has_group')?.presentedAs.value).toBe(true);
  });

  it('presents an open alarm as a boolean with its since-timestamp, and the fact a person is needed — never the raw backend prose behind either', () => {
    const snapshot = snapshotOf();
    const rowB = rowFor(snapshot, ROW_B.clusterId);
    const alarm = rowB.observations!.find((o) => o.key === 'flui.scaling.alarm_open')!;
    expect(alarm.presentedAs.value).toBe(true);
    expect(alarm.observedAt).toBe('2026-08-19T12:00:00.000Z');
    expect(rowB.observations!.find((o) => o.key === 'flui.scaling.needs_person')?.presentedAs.value).toBe(true);
    expect(rowB.observations!.find((o) => o.key === 'flui.scaling.has_group')?.presentedAs.value).toBe(false);

    const json = JSON.stringify(snapshot);
    expect(json).not.toContain('Attach a machine that meets the stated shape');
    expect(json).not.toContain('attach a 4 vCPU / 8GB machine');
  });

  it('never invents rows while loading, absent, or failed — the view state is carried on scope.state, not fabricated content', () => {
    const loading = snapshotOf({ loading: true });
    expect(rowScopes(loading).length).toBe(0);
    expect(listScope(loading).state).toEqual({ loading: true, empty: false });

    const absent = snapshotOf({ absent: true });
    expect(rowScopes(absent).length).toBe(0);
    expect(listScope(absent).state).toEqual({ loading: false, error: true, errorCode: 'flui.scaling.unserved', empty: true });

    const failed = snapshotOf({ failed: true });
    expect(rowScopes(failed).length).toBe(0);
    expect(listScope(failed).state).toEqual({ loading: false, error: true, empty: true });
  });

  it('marks the list empty (not an error) when loading finished with zero rows', () => {
    const snapshot = snapshotOf({ rows: [] });
    expect(listScope(snapshot).state).toEqual({ loading: false, empty: true });
  });

  it('redacts: no raw alarm/needs-person prose, no internal metadata beyond entity refs and the presented fields, reach the snapshot', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('asks');
    expect(json).not.toContain('vCPU');
  });
});
