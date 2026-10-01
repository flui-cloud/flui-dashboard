import { decidedByLine, decisionPanel } from './app-backup-decision';
import type { AppCoverageRow } from '../../service/fleet.service';

const coverage = (over: Partial<AppCoverageRow> = {}): AppCoverageRow => ({
  applicationId: 'a-1',
  name: 'pg-bgs-pitr',
  slug: 'postgresql-c653b7-qsx6du',
  kind: 'DATABASE',
  category: 'user',
  clusterId: 'c-1',
  clusterName: 'wc-2',
  holdsData: true,
  dataReasons: ['database'],
  coverage: 'unprotected',
  reason: 'no_policy',
  alarm: true,
  policy: null,
  coveringPolicies: 0,
  lastSuccessAt: null,
  protectedUntil: null,
  protectPath: '/management/backup/policies/new?applicationId=a-1',
  pending: null,
  decision: null,
  ...over,
});

const decision = {
  notBackedUp: true as const,
  note: 'scratch copy of a restore',
  decidedBy: 'u-1',
  decidedByName: 'Dawit',
  decidedAt: '2026-10-01T09:12:00.000Z',
};

describe('decisionPanel', () => {
  it('says why an app holding data is not protected and offers to protect it', () => {
    expect(decisionPanel({ coverage: coverage(), policies: [] })).toEqual({
      state: 'unprotected',
      why: 'No policy covers it.',
      protectPath: '/management/backup/policies/new?applicationId=a-1',
    });
  });

  it('uses what protecting the cluster ran into, and offers no policy that would not help', () => {
    const panel = decisionPanel({
      coverage: coverage({
        protectPath: null,
        pending: { outcome: 'waiting', reason: 'the database is not running yet', at: '', protectHelps: false },
      }),
      policies: [],
    });
    expect(panel).toEqual({ state: 'unprotected', why: 'The database is not running yet.', protectPath: null });
  });

  it('shows the decision with its note, who and when, and the policies still running', () => {
    const panel = decisionPanel({
      coverage: coverage({ coverage: 'not_backed_up_by_choice', reason: 'not_backed_up_by_choice', decision }),
      policies: [
        { policyId: 'p-1', name: 'pg-continuous', enabled: true },
        { policyId: 'p-2', name: 'old', enabled: false },
      ],
    });
    expect(panel).toEqual({
      state: 'decided',
      note: 'scratch copy of a restore',
      by: 'Dawit · 1 Oct 2026',
      running: [{ name: 'pg-continuous', path: '/management/backup/policies/p-1' }],
    });
  });

  it('shows nothing for a protected app, one that keeps no data, or a part of Flui', () => {
    expect(decisionPanel({ coverage: coverage({ coverage: 'protected' }), policies: [] })).toBeNull();
    expect(decisionPanel({ coverage: coverage({ coverage: 'pending' }), policies: [] })).toBeNull();
    expect(decisionPanel({ coverage: coverage({ holdsData: false }), policies: [] })).toBeNull();
    expect(decisionPanel({ coverage: coverage({ category: 'system' }), policies: [] })).toBeNull();
    expect(decisionPanel(null)).toBeNull();
  });
});

describe('decidedByLine', () => {
  it('leaves the name out when none was recorded', () => {
    expect(decidedByLine({ ...decision, decidedByName: undefined })).toBe('1 Oct 2026');
  });
});
