import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../../testing/surface-test-utils';

import {
  BackupOverviewSurfaceInput,
  BackupOverviewSurfaceRevision,
  buildBackupOverviewSurface,
  presentedContent,
} from './backup-overview-surface';

function input(over: Partial<BackupOverviewSurfaceInput> = {}): BackupOverviewSurfaceInput {
  return {
    destinationsCount: 2,
    policiesCount: 3,
    degradedPoliciesCount: 0,
    restoreJobsCount: 1,
    totalUsageText: '4.2 GB',
    clustersAvailable: 2,
    hasLoadError: false,
    ...over,
  };
}

function snapshotOf(over: Partial<BackupOverviewSurfaceInput> = {}): SurfaceSnapshot {
  return buildBackupOverviewSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const pageScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.id === 'backup-overview')!;
const observation = (snapshot: SurfaceSnapshot, key: string) =>
  pageScope(snapshot).observations?.find((o) => o.key === key);

describe('backup overview surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new BackupOverviewSurfaceRevision();
    const first = buildBackupOverviewSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-09-02T09:13:00.000Z' });
    const second = buildBackupOverviewSurface(
      input({ destinationsCount: 3 }),
      { revision: tracker.next(presentedContent(input({ destinationsCount: 3 }))), generatedAt: '2026-09-02T09:14:00.000Z' },
    );
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('names only the page in attention — no invented selection on a dashboard of counts', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'backup-overview', reason: 'route' }]);
    expect(pageScope(snapshot).entities).toBeUndefined();
  });

  it('presents the counts actually shown on the cards', () => {
    const snapshot = snapshotOf({ destinationsCount: 5, policiesCount: 2, restoreJobsCount: 7 });
    expect(observation(snapshot, 'flui.backup.destinations_count')?.presentedAs).toEqual({ value: 5 });
    expect(observation(snapshot, 'flui.backup.policies_count')?.presentedAs).toEqual({ value: 2 });
    expect(observation(snapshot, 'flui.backup.restore_jobs_count')?.presentedAs).toEqual({ value: 7 });
  });

  it('says nothing about degraded policies when the count is zero, and something when it is not', () => {
    expect(observation(snapshotOf({ degradedPoliciesCount: 0 }), 'flui.backup.policies_degraded_count')).toBeUndefined();
    expect(observation(snapshotOf({ degradedPoliciesCount: 2 }), 'flui.backup.policies_degraded_count')?.presentedAs.value).toBe(2);
  });

  it('sets scope.state.error on a failed load, never on domain content', () => {
    expect(pageScope(snapshotOf({ hasLoadError: true })).state).toEqual({ error: true });
    expect(pageScope(snapshotOf({ hasLoadError: false })).state).toBeUndefined();
  });

  it('redacts: the raw backend error string is never carried, only the load-failed flag', () => {
    const json = JSON.stringify(snapshotOf({ hasLoadError: true }));
    expect(json).not.toContain('ECONNREFUSED');
    expect(json).not.toContain('stack');
  });
});
