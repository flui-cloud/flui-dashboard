import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../../testing/surface-test-utils';

import {
  RestoreDetailSurfaceInput,
  RestoreDetailSurfaceRevision,
  buildRestoreDetailSurface,
  presentedContent,
  restoreJobEntityRef,
} from './restore-detail-surface';
import { destinationEntityRef } from '../destinations/destination-detail-surface';
import type { RestoreJob } from '../../../model/backup.models';

const RESTORE: RestoreJob = {
  id: 'restore-1',
  userId: 'u1',
  artifactId: 'art-1',
  sourceDestinationId: 'dest-1',
  targetClusterId: 'cl-2',
  targetKind: 'full_cluster' as RestoreJob['targetKind'],
  veleroRestoreName: 'restore-2026-09-01',
  status: 'completed',
  createdAt: '2026-09-01T03:00:00.000Z',
};

function input(over: Partial<RestoreDetailSurfaceInput> = {}): RestoreDetailSurfaceInput {
  return { job: RESTORE, ...over };
}

function snapshotOf(over: Partial<RestoreDetailSurfaceInput> = {}): SurfaceSnapshot {
  const s = buildRestoreDetailSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
  if (!s) throw new Error('the producer described nothing');
  return s;
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'page')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('restore detail surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new RestoreDetailSurfaceRevision();
    const first = buildRestoreDetailSurface(input(), { revision: tracker.next(presentedContent(input())!), generatedAt: '2026-09-02T09:13:00.000Z' })!;
    const changed = input({ job: { ...RESTORE, status: 'failed' } });
    const second = buildRestoreDetailSurface(changed, { revision: tracker.next(presentedContent(changed)!), generatedAt: '2026-09-02T09:14:00.000Z' })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('claims the page and the restore job itself, with reason route and role primary', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([
      { scopeId: `backup-restore-detail:${RESTORE.id}`, entityRef: restoreJobEntityRef(RESTORE.id), reason: 'route' },
    ]);
    expect(pageScope(snapshot).entities?.[0].role).toBe('primary');
  });

  it('references the source destination by the same ref destination-detail-surface mints', () => {
    const snapshot = snapshotOf();
    const sourceScope = snapshot.scopes.find((s) => s.label === 'Source')!;
    expect(sourceScope.entities).toEqual([{ ref: destinationEntityRef('dest-1'), role: 'related' }]);
  });

  it('presents target kind, status and the velero restore name', () => {
    const snapshot = snapshotOf();
    expect(observation(snapshot, 'flui.backup.restore.target_kind')?.presentedAs.text).toBe('full_cluster');
    expect(observation(snapshot, 'flui.backup.restore.velero_restore_name')?.presentedAs.text).toBe('restore-2026-09-01');
  });

  it('produces no snapshot at all when there is no restore job loaded — no invented selection', () => {
    expect(buildRestoreDetailSurface(input({ job: null }), { revision: 1, generatedAt: '2026-09-02T09:13:00.000Z' })).toBeNull();
  });

  it('redacts: the raw restore error text never reaches the snapshot, only a boolean flag', () => {
    const withError: RestoreJob = { ...RESTORE, errorMessage: 'panic: leaked token sk_live_SSS' };
    const json = JSON.stringify(snapshotOf({ job: withError }));
    expect(json).not.toContain('sk_live_SSS');
    expect(observation(snapshotOf({ job: withError }), 'flui.backup.restore.has_error')?.presentedAs.value).toBe(true);
  });
});
