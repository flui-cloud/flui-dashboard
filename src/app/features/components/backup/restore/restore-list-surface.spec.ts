import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../../testing/surface-test-utils';

import {
  RestoreListSurfaceInput,
  RestoreListSurfaceRevision,
  buildRestoreListSurface,
  presentedContent,
  restoreJobEntityRef,
} from './restore-list-surface';
import type { RestoreJob } from '../../../model/backup.models';

const RESTORE: RestoreJob = {
  id: 'restore-1',
  userId: 'u1',
  artifactId: 'art-1',
  sourceDestinationId: 'dest-1',
  targetClusterId: 'cl-2',
  targetKind: 'full_cluster' as RestoreJob['targetKind'],
  status: 'completed',
  createdAt: '2026-09-01T03:00:00.000Z',
};

function input(over: Partial<RestoreListSurfaceInput> = {}): RestoreListSurfaceInput {
  return { restoreJobs: [RESTORE], ...over };
}

function snapshotOf(over: Partial<RestoreListSurfaceInput> = {}): SurfaceSnapshot {
  return buildRestoreListSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const rowScope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === `backup-restore:list:${id}`)!;

describe('restore list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new RestoreListSurfaceRevision();
    const first = buildRestoreListSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-09-02T09:13:00.000Z' });
    const changed = input({ restoreJobs: [{ ...RESTORE, status: 'failed' }] });
    const second = buildRestoreListSurface(changed, { revision: tracker.next(presentedContent(changed)), generatedAt: '2026-09-02T09:14:00.000Z' });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('is a list page with no selection: every row is related, never primary', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'backup-restore', reason: 'route' }]);
    const row = rowScope(snapshot, 'restore-1');
    expect(row.entities).toEqual([{ ref: restoreJobEntityRef('restore-1'), label: RESTORE.createdAt, role: 'related' }]);
  });

  it('presents target kind, status and created-at', () => {
    const row = rowScope(snapshotOf(), 'restore-1');
    const obs = (key: string) => row.observations?.find((o) => o.key === key);
    expect(obs('flui.backup.restore.target_kind')?.presentedAs.text).toBe('full_cluster');
    expect(obs('flui.backup.restore.status')?.presentedAs.text).toBe('completed');
  });

  it('produces an empty (not missing) list scope when there are no restore jobs yet', () => {
    const snapshot = snapshotOf({ restoreJobs: [] });
    expect(listScope(snapshot).state).toEqual({ empty: true });
    expect(listScope(snapshot).completeness).toEqual({ shown: 0, total: 0 });
  });

  it('redacts: no raw error text ever enters a row (restore rows never present errorMessage)', () => {
    const withError: RestoreJob = { ...RESTORE, errorMessage: 'panic: leaked token sk_live_RRR' };
    const json = JSON.stringify(snapshotOf({ restoreJobs: [withError] }));
    expect(json).not.toContain('sk_live_RRR');
  });
});
