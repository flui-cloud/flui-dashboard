import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import { AppGroupView, Application } from '../../model/application.models';
import type { AppCoverageRow } from '../../service/fleet.service';
import {
  ListRowContext,
  buildListRow,
  failureReason,
  matchesView,
  originOf,
  sortRows,
  viewCounts,
} from './applications-list-rows';

const NOW = Date.parse('2026-09-27T12:00:00Z');

function app(over: Partial<Application> = {}): Application {
  return {
    id: 'a1',
    name: 'whoami',
    slug: 'whoami-4wn132',
    kind: 'APPLICATION',
    category: 'user',
    sourceType: 'docker_image',
    clusterId: 'c1',
    k8sNamespace: 'user-x',
    status: 'running',
    reconciliationStatus: 'IN_SYNC',
    sourceConfig: {},
    env: [],
    resources: {},
    scaling: {},
    replicas: 1,
    systemProtected: false,
    autoDeploy: false,
    deployOnPush: false,
    exposure: 'public',
    workloadKind: 'Deployment',
    persistenceScope: 'shared',
    allowMasterPlacement: false,
    labels: {},
    metadata: {},
    createdAt: '2026-09-26T10:00:00Z',
    updatedAt: '2026-09-26T10:00:00Z',
    ...over,
  } as Application;
}

function group(over: Partial<AppGroupView> = {}, components = [app()]): AppGroupView {
  return {
    id: 'g1',
    type: 'standalone' as AppGroupView['type'],
    name: 'whoami',
    status: 'running' as AppGroupView['status'],
    category: 'user' as AppGroupView['category'],
    clusterId: 'c1',
    createdAt: '2026-09-26T10:00:00Z',
    components,
    ...over,
  };
}

function metrics(appId: string, ready: number, desired: number, cpu: number | null, mem: number | null): AppMetricsDto {
  return {
    app_id: appId,
    app_name: appId,
    namespace: 'user-x',
    cpu: { usage_cores: null, requests_cores: null, limits_cores: null, utilization_percent: cpu },
    memory: { usage_bytes: null, requests_bytes: null, limits_bytes: null, utilization_percent: mem },
    network: {} as AppMetricsDto['network'],
    status: {
      replicas_desired: desired,
      replicas_ready: ready,
      replicas_unavailable: null,
      ready_ratio: null,
      up: 1,
      restart_total: 0,
      restart_rate_1h: 0,
    },
    pods: [],
    replicas: [],
  };
}

function coverage(appId: string, over: Partial<AppCoverageRow> = {}): AppCoverageRow {
  return {
    applicationId: appId,
    name: appId,
    slug: appId,
    kind: 'APPLICATION',
    category: 'user',
    clusterId: 'c1',
    clusterName: 'wc-1',
    holdsData: true,
    dataReasons: ['volume'],
    coverage: 'protected',
    reason: 'recent_backup',
    alarm: false,
    policy: null,
    coveringPolicies: 1,
    lastSuccessAt: '2026-09-27T03:00:00Z',
    protectedUntil: null,
    protectPath: null,
    ...over,
  };
}

function ctx(over: Partial<ListRowContext> = {}): ListRowContext {
  return {
    clusterName: 'wc-1',
    providerName: 'Hetzner',
    project: null,
    usage: new Map(),
    coverage: new Map(),
    now: NOW,
    ...over,
  };
}

describe('applications list rows', () => {
  it('shows the endpoint as the subtitle of a healthy app, and ready replicas and usage against the limit', () => {
    const row = buildListRow(
      group({ url: 'https://whoami.example.com/' }),
      ctx({ usage: new Map([['a1', metrics('a1', 1, 1, 6, 22)]]) }),
    );
    expect(row.subtitle).toEqual({ text: 'whoami.example.com', tone: 'info', href: 'https://whoami.example.com/' });
    expect(row.ready).toEqual(jasmine.objectContaining({ text: '1 / 1', tone: 'ok' }));
    expect(row.cpu).toBe(6);
    expect(row.memory).toBe(22);
    expect(row.attention).toBeFalse();
    expect(row.cluster).toEqual({ name: 'wc-1', provider: 'Hetzner', chip: 'HE' });
  });

  it('puts the recorded failure reason in the subtitle of a failed app and marks it for attention', () => {
    const failed = app({ status: 'failed', reconciliationError: 'ImagePullBackOff: not found\nmore detail' });
    const row = buildListRow(group({ status: 'failed' as AppGroupView['status'] }, [failed]), ctx());
    expect(row.subtitle.text).toBe('Failed · ImagePullBackOff: not found');
    expect(row.subtitle.tone).toBe('danger');
    expect(row.attention).toBeTrue();
    expect(row.tone).toBe('danger');
  });

  it('says a dash rather than a number when there are no readings', () => {
    const row = buildListRow(group(), ctx());
    expect(row.ready.text).toBe('—');
    expect(row.cpu).toBeNull();
    expect(row.memory).toBeNull();
  });

  it('asks for attention when a running app is short of replicas', () => {
    const row = buildListRow(group(), ctx({ usage: new Map([['a1', metrics('a1', 1, 2, 1, 1)]]) }));
    expect(row.attention).toBeTrue();
    expect(row.subtitle.text).toBe('1 of 2 replicas ready');
    expect(row.ready.tone).toBe('warn');
  });

  it('adds up a bundle: replicas summed, usage from the component closest to its limit', () => {
    const web = app({ id: 'w', slug: 'umami-web' });
    const db = app({ id: 'd', slug: 'umami-db', kind: 'DATABASE', catalogVersion: '2.1' });
    const bundle = group(
      { type: 'composed' as AppGroupView['type'], name: 'Umami', catalogSlug: 'umami', primaryComponentId: 'd' },
      [web, db],
    );
    const row = buildListRow(
      bundle,
      ctx({ usage: new Map([['w', metrics('w', 1, 1, 10, 40)], ['d', metrics('d', 1, 1, 30, 20)]]) }),
    );
    expect(row.ready.text).toBe('2 / 2');
    expect(row.cpu).toBe(30);
    expect(row.memory).toBe(40);
    expect(row.bundle).toBe('Bundle · v2.1');
    expect(row.origin).toBe('Catalog');
  });

  it('reads the backup column from the fleet coverage, and only an alarm counts as no backup', () => {
    const cov = (c: AppCoverageRow) => ctx({ coverage: new Map([['a1', c]]) });
    expect(buildListRow(group(), cov(coverage('a1'))).backup.label).toBe('Backed up');
    const alarm = buildListRow(group(), cov(coverage('a1', { coverage: 'unprotected', alarm: true })));
    expect(alarm.backup).toEqual(jasmine.objectContaining({ label: 'No backup', tone: 'warn' }));
    expect(alarm.noBackup).toBeTrue();
    expect(buildListRow(group(), cov(coverage('a1', { holdsData: false }))).backup.label).toBe('No data');
    expect(buildListRow(group(), cov(coverage('a1', { coverage: 'pending' }))).backup.label).toBe('First backup due');
    expect(buildListRow(group(), ctx({ coverage: null })).backup.label).toBe('—');
  });

  it('names the origin instead of internal abbreviations', () => {
    expect(originOf(app())).toBe('Image');
    expect(originOf(app({ sourceType: 'git_build', sourceConfig: { repositoryId: 'r1' } }))).toBe('GitHub');
    expect(originOf(app({ sourceType: 'git_build', sourceConfig: { gitUrl: 'https://gitlab.com/x/y' } }))).toBe('Git');
    expect(originOf(app({ catalogSlug: 'umami' }))).toBe('Catalog');
  });

  it('falls back to the last operation error for the reason', () => {
    expect(
      failureReason(app({ lastOperation: { errorMessage: 'Build failed' } as Application['lastOperation'] })),
    ).toBe('Build failed');
    expect(failureReason(app())).toBeNull();
  });

  it('lists problems first, then apps without backup, keeping the API order otherwise', () => {
    const ok = buildListRow(group({ id: 'ok', name: 'ok' }), ctx());
    const bad = buildListRow(
      group({ id: 'bad', status: 'failed' as AppGroupView['status'] }, [app({ status: 'failed' })]),
      ctx(),
    );
    const noBackup = buildListRow(
      group({ id: 'nb' }),
      ctx({ coverage: new Map([['a1', coverage('a1', { coverage: 'unprotected', alarm: true })]]) }),
    );
    expect(sortRows([ok, noBackup, bad]).map((r) => r.id)).toEqual(['bad', 'nb', 'ok']);
    const counts = viewCounts([ok, noBackup, bad]);
    expect(counts).toEqual({ all: 3, running: 2, attention: 1, no_backup: 1 });
    expect(matchesView(bad, 'attention')).toBeTrue();
    expect(matchesView(ok, 'no_backup')).toBeFalse();
  });
});
