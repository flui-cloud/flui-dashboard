import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../../testing/surface-test-utils';

import {
  JobDetailSurfaceInput,
  JobDetailSurfaceRevision,
  buildJobDetailSurface,
  jobEntityRef,
  presentedContent,
} from './job-detail-surface';
import { destinationEntityRef } from '../destinations/destination-detail-surface';
import type { BackupJob, EncryptionMode } from '../../../model/backup.models';

const JOB: BackupJob = {
  id: 'job-1',
  clusterId: 'cl-1',
  userId: 'u1',
  triggerType: 'on_demand',
  veleroBackupName: 'backup-2026-09-01',
  status: 'completed',
  startedAt: '2026-09-01T02:00:00.000Z',
  finishedAt: '2026-09-01T02:05:00.000Z',
  artifact: {
    id: 'art-1',
    backupJobId: 'job-1',
    clusterId: 'cl-1',
    veleroBackupName: 'backup-2026-09-01',
    sizeBytes: '2147483648',
    itemCount: 412,
    encryptionMode: 'sse' as EncryptionMode,
    locations: [
      {
        id: 'loc-1',
        artifactId: 'art-1',
        destinationId: 'dest-1',
        destination: { name: 'primary-eu' } as never,
        role: 'primary',
        state: 'verified',
        objectKeyPrefix: 'backups/job-1',
      },
    ],
    createdAt: '2026-09-01T02:05:00.000Z',
  },
  createdAt: '2026-09-01T02:00:00.000Z',
  updatedAt: '2026-09-01T02:05:00.000Z',
};

function input(over: Partial<JobDetailSurfaceInput> = {}): JobDetailSurfaceInput {
  return { job: JOB, ...over };
}

function snapshotOf(over: Partial<JobDetailSurfaceInput> = {}): SurfaceSnapshot {
  const s = buildJobDetailSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
  if (!s) throw new Error('the producer described nothing');
  return s;
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'page')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('job detail surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new JobDetailSurfaceRevision();
    const first = buildJobDetailSurface(input(), { revision: tracker.next(presentedContent(input())!), generatedAt: '2026-09-02T09:13:00.000Z' })!;
    const changed = input({ job: { ...JOB, status: 'failed' } });
    const second = buildJobDetailSurface(changed, { revision: tracker.next(presentedContent(changed)!), generatedAt: '2026-09-02T09:14:00.000Z' })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('claims the page and the job itself, with reason route and role primary', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([
      { scopeId: `backup-job-detail:${JOB.id}`, entityRef: jobEntityRef(JOB.id), reason: 'route' },
    ]);
    expect(pageScope(snapshot).entities?.[0].role).toBe('primary');
  });

  it('references the artifact location destination by the same ref destination-detail mints', () => {
    const snapshot = snapshotOf();
    const locRow = snapshot.scopes.find((s) => s.id.includes(':location:dest-1'))!;
    expect(locRow.entities).toEqual([{ ref: destinationEntityRef('dest-1'), label: 'primary-eu', role: 'related' }]);
  });

  it('presents trigger, status, artifact size and item count', () => {
    const snapshot = snapshotOf();
    expect(observation(snapshot, 'flui.backup.job.trigger_type')?.presentedAs.text).toBe('on_demand');
    const artifactScope = snapshot.scopes.find((s) => s.label === 'Artifact')!;
    const obs = (key: string) => artifactScope.observations?.find((o) => o.key === key);
    expect(obs('flui.backup.artifact.size')?.presentedAs.text).toBe('2.0 GB');
    expect(obs('flui.backup.artifact.item_count')?.presentedAs.value).toBe(412);
  });

  it('never invents an artifact scope when the job has none yet', () => {
    const snapshot = snapshotOf({ job: { ...JOB, artifact: undefined } });
    expect(snapshot.scopes.some((s) => s.label === 'Artifact')).toBe(false);
  });

  it('produces no snapshot at all when there is no job loaded — no invented selection', () => {
    expect(buildJobDetailSurface(input({ job: null }), { revision: 1, generatedAt: '2026-09-02T09:13:00.000Z' })).toBeNull();
  });

  it('redacts: the raw job error text never reaches the snapshot, only a boolean flag', () => {
    const withError: BackupJob = { ...JOB, errorMessage: 'panic: leaked token sk_live_QQQ' };
    const json = JSON.stringify(snapshotOf({ job: withError }));
    expect(json).not.toContain('sk_live_QQQ');
    expect(observation(snapshotOf({ job: withError }), 'flui.backup.job.has_error')?.presentedAs.value).toBe(true);
  });
});
