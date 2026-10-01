import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../../testing/surface-test-utils';

import {
  PolicyDetailSurfaceInput,
  PolicyDetailSurfaceRevision,
  buildPolicyDetailSurface,
  policyEntityRef,
  presentedContent,
} from './policy-detail-surface';
import { destinationEntityRef } from '../destinations/destination-detail-surface';
import type { BackupPolicy } from '../../../model/backup.models';
import type { BackupPolicyActivity } from '../../../model/backup-run.models';
import { jobEntityRef } from '../jobs/job-detail-surface';

const POLICY: BackupPolicy = {
  id: 'pol-1',
  userId: 'u1',
  clusterId: 'cl-1',
  name: 'nightly',
  scope: 'full_cluster' as BackupPolicy['scope'],
  includePvcs: true,
  includeEtcdL1: false,
  cronSchedule: '0 2 * * *',
  retentionDays: 14,
  retentionMaxCopies: 5,
  enabled: true,
  status: 'active',
  profile: 'mirrored' as BackupPolicy['profile'],
  destinations: [
    {
      id: 'pd-1',
      destinationId: 'dest-1',
      destination: { name: 'primary-eu' } as BackupPolicy['destinations'][number]['destination'],
      role: 'primary',
      priority: 0,
      enabled: true,
      lastReplicationStatus: 'ok',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ACTIVITY: BackupPolicyActivity = {
  policyId: 'pol-1',
  policyName: 'nightly',
  engineClass: 'volume_copy',
  status: 'active',
  schedule: {
    cron: '0 2 * * *',
    description: 'Every day at 02:00 UTC',
    timezone: 'UTC',
    nextRunAt: '2026-10-01T02:00:00.000Z',
    previousDueAt: '2026-09-30T02:00:00.000Z',
  },
  health: { state: 'missed', detail: 'The 02:00 run did not happen', lastSuccessAt: '2026-09-29T02:03:00.000Z' },
  lastRun: null,
  runs: [
    {
      jobId: 'job-1',
      trigger: 'scheduled',
      status: 'completed',
      startedAt: '2026-09-29T02:00:00.000Z',
      finishedAt: '2026-09-29T02:03:00.000Z',
      durationSeconds: 180,
      sizeBytes: 1024,
      encrypted: true,
      expiresAt: null,
      stored: 'present',
      errorMessage: null,
    },
  ],
};

function input(over: Partial<PolicyDetailSurfaceInput> = {}): PolicyDetailSurfaceInput {
  return { policy: POLICY, ...over };
}

function snapshotOf(over: Partial<PolicyDetailSurfaceInput> = {}): SurfaceSnapshot {
  const s = buildPolicyDetailSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
  if (!s) throw new Error('the producer described nothing');
  return s;
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'page')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('policy detail surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new PolicyDetailSurfaceRevision();
    const first = buildPolicyDetailSurface(input(), { revision: tracker.next(presentedContent(input())!), generatedAt: '2026-09-02T09:13:00.000Z' })!;
    const changed = input({ policy: { ...POLICY, status: 'paused' } });
    const second = buildPolicyDetailSurface(changed, { revision: tracker.next(presentedContent(changed)!), generatedAt: '2026-09-02T09:14:00.000Z' })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('claims the page and the policy itself, with reason route and role primary', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([
      { scopeId: `backup-policy-detail:${POLICY.id}`, entityRef: policyEntityRef(POLICY.id), reason: 'route' },
    ]);
    expect(pageScope(snapshot).entities).toEqual([{ ref: policyEntityRef(POLICY.id), label: POLICY.name, role: 'primary' }]);
  });

  it('references its destinations as related entities, using the same ref the destination-detail producer mints', () => {
    const snapshot = snapshotOf();
    const destRow = snapshot.scopes.find((s) => s.id.endsWith(':destinations:dest-1'))!;
    expect(destRow.entities).toEqual([{ ref: destinationEntityRef('dest-1'), label: 'primary-eu', role: 'related' }]);
  });

  it('presents status, profile, scope, schedule and retention', () => {
    const snapshot = snapshotOf();
    expect(observation(snapshot, 'flui.backup.policy.status')?.presentedAs.text).toBe('active');
    expect(observation(snapshot, 'flui.backup.policy.profile')?.presentedAs.text).toBe('mirrored');
    expect(observation(snapshot, 'flui.backup.policy.retention_days')?.presentedAs.value).toBe(14);
  });

  it('produces no snapshot at all when there is no policy loaded — no invented selection', () => {
    expect(buildPolicyDetailSurface(input({ policy: null }), { revision: 1, generatedAt: '2026-09-02T09:13:00.000Z' })).toBeNull();
  });

  it('never invents a destinations list scope when the policy has none', () => {
    const snapshot = snapshotOf({ policy: { ...POLICY, destinations: [] } });
    expect(snapshot.scopes.some((s) => s.kind === 'list')).toBe(false);
  });

  it('presents the schedule in words, the health and the next run once activity is loaded', () => {
    const snapshot = snapshotOf({ activity: ACTIVITY });
    expectValidSurface(snapshot);
    expect(observation(snapshot, 'flui.backup.policy.health')?.presentedAs.text).toBe('missed');
    expect(observation(snapshot, 'flui.backup.policy.schedule_description')?.presentedAs.text).toBe('Every day at 02:00 UTC');
    expect(observation(snapshot, 'flui.backup.policy.next_run_at')?.presentedAs.text).toBe('2026-10-01T02:00:00.000Z');
  });

  it('lists the runs as related backup jobs', () => {
    const snapshot = snapshotOf({ activity: ACTIVITY });
    const runs = snapshot.scopes.find((s) => s.id === `backup-policy-detail:${POLICY.id}:runs`)!;
    expect(runs.completeness).toEqual({ shown: 1, total: 1 });
    const row = snapshot.scopes.find((s) => s.parentId === runs.id)!;
    expect(row.entities).toEqual([{ ref: jobEntityRef('job-1'), role: 'related' }]);
    expect(row.observations?.find((o) => o.key === 'flui.backup.run.encrypted')?.presentedAs.value).toBe(true);
  });

  it('adds no runs list before activity has loaded', () => {
    expect(snapshotOf().scopes.some((s) => s.id.endsWith(':runs'))).toBe(false);
  });
});
