import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../../testing/surface-test-utils';

import {
  PoliciesListSurfaceInput,
  PoliciesListSurfaceRevision,
  PolicyRow,
  buildPoliciesListSurface,
  policyEntityRef,
  presentedContent,
} from './policies-list-surface';
import type { BackupPolicy } from '../../../model/backup.models';

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
  enabled: true,
  status: 'active',
  profile: 'single' as BackupPolicy['profile'],
  destinations: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ROW: PolicyRow = { policy: POLICY, clusterName: 'prod-eu' };

function input(over: Partial<PoliciesListSurfaceInput> = {}): PoliciesListSurfaceInput {
  return { rows: [ROW], totalPolicies: 1, clusterFilterName: null, loading: false, ...over };
}

function snapshotOf(over: Partial<PoliciesListSurfaceInput> = {}): SurfaceSnapshot {
  return buildPoliciesListSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const rowScope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === `backup-policies:list:${id}`)!;

describe('policies list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new PoliciesListSurfaceRevision();
    const first = buildPoliciesListSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-09-02T09:13:00.000Z' });
    const changed = input({ rows: [{ ...ROW, policy: { ...POLICY, status: 'paused' } }] });
    const second = buildPoliciesListSurface(changed, { revision: tracker.next(presentedContent(changed)), generatedAt: '2026-09-02T09:14:00.000Z' });
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
    expect(snapshot.attention).toEqual([{ scopeId: 'backup-policies', reason: 'route' }]);
    const row = rowScope(snapshot, 'pol-1');
    expect(row.entities).toEqual([{ ref: policyEntityRef('pol-1'), label: 'nightly', role: 'related' }]);
  });

  it('declares the cluster filter as narrowing the count, not the whole fleet', () => {
    const snapshot = snapshotOf({ clusterFilterName: 'prod-eu', totalPolicies: 5 });
    expect(listScope(snapshot).completeness).toEqual({ shown: 1, total: 5, filtered: true });
    expect(listScope(snapshot).observations).toEqual([
      { key: 'flui.backup.policies.cluster_filter', presentedAs: { text: 'prod-eu' }, source: 'ui' },
    ]);
  });

  it('presents cluster, profile, schedule and status as shown in the row', () => {
    const row = rowScope(snapshotOf(), 'pol-1');
    const obs = (key: string) => row.observations?.find((o) => o.key === key);
    expect(obs('flui.backup.policy.cluster')?.presentedAs.text).toBe('prod-eu');
    expect(obs('flui.backup.policy.profile')?.presentedAs.text).toBe('single');
    expect(obs('flui.backup.policy.schedule')?.presentedAs.text).toBe('0 2 * * *');
    expect(obs('flui.backup.policy.status')?.presentedAs.text).toBe('active');
  });

  it('produces an empty (not missing) list scope when nothing matches the filter', () => {
    const snapshot = snapshotOf({ rows: [], totalPolicies: 3, clusterFilterName: 'empty-cluster' });
    expect(listScope(snapshot).state).toEqual({ loading: false, empty: true });
  });
});
