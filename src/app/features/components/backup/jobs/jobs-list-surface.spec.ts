import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../../testing/surface-test-utils';

import {
  JobsListSurfaceInput,
  JobsListSurfaceRevision,
  buildJobsListSurface,
  jobEntityRef,
  presentedContent,
} from './jobs-list-surface';
import type { BackupJob } from '../../../model/backup.models';

const JOB: BackupJob = {
  id: 'job-1',
  clusterId: 'cl-1',
  userId: 'u1',
  triggerType: 'scheduled',
  veleroBackupName: 'backup-2026-09-01',
  status: 'completed',
  startedAt: '2026-09-01T02:00:00.000Z',
  finishedAt: '2026-09-01T02:05:00.000Z',
  createdAt: '2026-09-01T02:00:00.000Z',
  updatedAt: '2026-09-01T02:05:00.000Z',
};

function input(over: Partial<JobsListSurfaceInput> = {}): JobsListSurfaceInput {
  return { jobs: [JOB], clusterFilterName: 'prod-eu', ...over };
}

function snapshotOf(over: Partial<JobsListSurfaceInput> = {}): SurfaceSnapshot {
  return buildJobsListSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const rowScope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === `backup-jobs:list:${id}`)!;

describe('jobs list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new JobsListSurfaceRevision();
    const first = buildJobsListSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-09-02T09:13:00.000Z' });
    const changed = input({ jobs: [{ ...JOB, status: 'failed' }] });
    const second = buildJobsListSurface(changed, { revision: tracker.next(presentedContent(changed)), generatedAt: '2026-09-02T09:14:00.000Z' });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('shows no rows at all until a cluster is picked — no invented "all jobs" list', () => {
    const snapshot = snapshotOf({ clusterFilterName: null });
    expect(listScope(snapshot).completeness).toEqual({ shown: 0, total: 0 });
    expect(listScope(snapshot).state).toEqual({ empty: true });
  });

  it('is a list page with no selection: every row is related, never primary', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'backup-jobs', reason: 'route' }]);
    const row = rowScope(snapshot, 'job-1');
    expect(row.entities?.[0].role).toBe('related');
  });

  it('presents trigger, status, started-at and the velero backup name', () => {
    const row = rowScope(snapshotOf(), 'job-1');
    const obs = (key: string) => row.observations?.find((o) => o.key === key);
    expect(obs('flui.backup.job.trigger_type')?.presentedAs.text).toBe('scheduled');
    expect(obs('flui.backup.job.status')?.presentedAs.text).toBe('completed');
    expect(obs('flui.backup.job.velero_backup_name')?.presentedAs.text).toBe('backup-2026-09-01');
  });

  it('redacts: no raw error text ever enters a row (jobs never present errorMessage)', () => {
    const withError: BackupJob = { ...JOB, errorMessage: 'panic: leaked token sk_live_ZZZ' };
    const json = JSON.stringify(snapshotOf({ jobs: [withError] }));
    expect(json).not.toContain('sk_live_ZZZ');
    expect(json).not.toContain('panic');
    expect(jobEntityRef('job-1')).toBe('flui://backup-job/job-1');
  });
});
