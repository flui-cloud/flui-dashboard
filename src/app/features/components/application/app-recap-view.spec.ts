import type { AppProtection } from '../../service/fleet.service';
import type { Application } from '../../model/application.models';
import {
  backupBand,
  barWidth,
  componentBackupDetail,
  endpointHealth,
  imageTag,
  releaseFact,
  replicasFact,
  resourcesFact,
  routeOf,
  runBusy,
  runLabel,
  scheduleText,
  untilTime,
} from './app-recap-view';

const NOW = Date.parse('2026-09-27T12:00:00Z');

const protection = (over: Partial<NonNullable<AppProtection['coverage']>> = {}, size: number | null = null): AppProtection => ({
  applicationId: 'a1',
  protectedOffCluster: true,
  policies: [],
  lastBackupSizeBytes: size,
  coverage: {
    applicationId: 'a1',
    name: 'a1',
    slug: 'a1',
    kind: 'APPLICATION',
    category: 'user',
    clusterId: 'c1',
    clusterName: 'wc-1',
    holdsData: true,
    dataReasons: ['volume'],
    coverage: 'protected',
    reason: 'recent_backup',
    alarm: false,
    policy: {
      id: 'p1',
      name: 'nightly',
      scope: 'applications',
      engineClass: 'volume_copy',
      schedule: '0 3 * * *',
      retentionDays: 30,
      nextRunAt: '2026-09-28T03:00:00Z',
    },
    coveringPolicies: 1,
    lastSuccessAt: '2026-09-27T03:00:00Z',
    protectedUntil: null,
    protectPath: null,
    ...over,
  },
});

describe('app recap view', () => {
  it('writes the schedules the policy form produces in words, anything else as written', () => {
    expect(scheduleText('0 3 * * *')).toBe('daily 03:00 UTC');
    expect(scheduleText('15 * * * *')).toBe('hourly');
    expect(scheduleText('0 2 * * 1')).toBe('Mondays 02:00 UTC');
    expect(scheduleText('*/5 1-3 * * *')).toBe('*/5 1-3 * * *');
    expect(scheduleText(null)).toBe('no schedule');
  });

  it('builds the backup band from the covering policy: policy, last with size, next and retention', () => {
    const band = backupBand(protection({}, 5 * 1024 ** 2), NOW)!;
    expect(band.label).toBe('Backed up');
    expect(band.tone).toBe('ok');
    expect(band.policy).toBe('nightly · daily 03:00 UTC');
    expect(band.last).toBe('9h ago · 5 MB');
    expect(band.next).toBe('in 15h');
    expect(band.kept).toBe('30 days');
    expect(band.runPolicyId).toBe('p1');
    expect(band.protectPath).toBeNull();
  });

  it('says not backed up with the reason and offers Protect when nothing covers the data', () => {
    const band = backupBand(
      protection({ coverage: 'unprotected', reason: 'no_policy', alarm: true, policy: null, lastSuccessAt: null, protectPath: '/x?y=1' }),
      NOW,
    )!;
    expect(band).toEqual(
      jasmine.objectContaining({ label: 'Not backed up', tone: 'warn', detail: 'No policy covers it.', protectPath: '/x?y=1', last: null }),
    );
  });

  it('says an app a person decided not to back up is so by choice, with the note and no Protect', () => {
    const band = backupBand(
      protection({
        coverage: 'not_backed_up_by_choice',
        reason: 'not_backed_up_by_choice',
        protectPath: null,
        decision: { notBackedUp: true, note: 'scratch copy', decidedBy: 'u1', decidedAt: '2026-10-01T09:00:00Z' },
      }),
      NOW,
    )!;
    expect(band).toEqual(
      jasmine.objectContaining({ label: 'Not backed up by choice', tone: 'muted', detail: 'scratch copy', protectPath: null }),
    );
  });

  it('says there is nothing to back up for an app that keeps no data, and nothing when the rule did not answer', () => {
    expect(backupBand(protection({ holdsData: false, coverage: 'unprotected' }), NOW)!.label).toBe('Nothing to back up');
    expect(backupBand(null)).toBeNull();
  });

  it('reads the endpoint health from the recorded states', () => {
    const app = (over: Partial<Application>) => ({ ...over }) as Application;
    expect(endpointHealth(app({ endpointStatus: 'IN_SYNC', endpointCertificateStatus: 'valid' }), true).label).toBe('DNS and certificate ok');
    expect(endpointHealth(app({ endpointStatus: 'ERROR' }), true).tone).toBe('danger');
    expect(endpointHealth(app({ endpointStatus: 'IN_SYNC', endpointCertificateStatus: 'issuing' }), true).label).toContain('being issued');
    expect(endpointHealth(app({ endpointStatus: 'IN_SYNC' }), false).label).toBe('DNS ok · no TLS');
  });

  it('shows dashes, never zeros, when there are no readings', () => {
    expect(replicasFact(null).value).toBe('—');
    expect(resourcesFact(null).value).toBe('—');
    expect(releaseFact(null).sub).toBe('No release recorded');
  });

  it('writes the release outcome with its tag', () => {
    const fact = releaseFact({
      applicationId: 'a1',
      operationId: 'o1',
      status: 'SUCCEEDED',
      imageRef: 'traefik/whoami:v1.10',
      startedAt: '2026-09-26T16:47:00',
      completedAt: '2026-09-26T16:47:00',
    });
    expect(fact.value).toBe('Succeeded');
    expect(fact.sub).toBe('26/09 16:47 · v1.10');
    expect(imageTag('registry:5000/app@sha256:abc')).toBe('');
  });

  it('counts time forward for the next run, and splits a returned path into route and query', () => {
    expect(untilTime('2026-09-27T12:30:00Z', NOW)).toBe('in 30m');
    expect(untilTime('2026-09-27T11:00:00Z', NOW)).toBe('due now');
    expect(routeOf('/management/backup/policies/new?clusterId=c1&applicationId=a1')).toEqual({
      path: '/management/backup/policies/new',
      query: { clusterId: 'c1', applicationId: 'a1' },
    });
  });

  it('words the on-demand backup state and blocks a second start', () => {
    expect(runLabel(undefined)).toBe('Back up now');
    expect(runLabel('failed')).toBe('Could not start · retry');
    expect(runBusy('running')).toBeTrue();
    expect(runBusy('failed')).toBeFalse();
  });

  it('keeps a reading bar visible but within the track', () => {
    expect(barWidth(null)).toBe(0);
    expect(barWidth(0.5)).toBe(2);
    expect(barWidth(140)).toBe(100);
  });

  it('shortens the backup detail on a component card to last and next', () => {
    const band = backupBand(protection({}, null), NOW)!;
    expect(componentBackupDetail(band)).toBe('last 9h ago · next in 15h');
    expect(componentBackupDetail({ ...band, protectPath: '/x', detail: 'No policy covers it.' })).toBe('No policy covers it.');
  });
});
