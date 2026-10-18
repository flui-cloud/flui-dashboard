import type { AppGroupView, Application } from './application.models';
import {
  groupListOf,
  openedWorkloadList,
  workloadEntries,
  workloadListCounts,
  workloadListOf,
  workloadTypeOptions,
} from './workload-list';

const app = (id: string, over: Partial<Application> = {}): Application =>
  ({
    id,
    name: id,
    kind: 'APPLICATION',
    category: 'user',
    clusterId: 'c1',
    status: 'running',
    labels: {},
    createdAt: '2026-09-20T10:00:00Z',
    ...over,
  }) as Application;

const composedLabels = { 'flui.cloud/composed-component': 'db' };

const umami = app('umami-app');
const umamiDb = app('umami-308040-db', {
  imageRef: 'docker.io/library/postgres:16',
  labels: composedLabels,
});

const bundle: AppGroupView = {
  id: 'install-umami',
  type: 'composed' as AppGroupView['type'],
  name: 'umami',
  status: 'running' as AppGroupView['status'],
  category: 'user' as AppGroupView['category'],
  clusterId: 'c1',
  primaryComponentId: umami.id,
  createdAt: '2026-09-20T10:00:00Z',
  components: [umami, umamiDb],
};

const standalone = (a: Application): AppGroupView => ({
  id: a.id,
  type: 'standalone' as AppGroupView['type'],
  name: a.name,
  status: a.status,
  category: a.category,
  clusterId: a.clusterId,
  createdAt: a.createdAt,
  components: [a],
});

describe('workload list', () => {
  it('puts a Postgres component of an application bundle in Data', () => {
    expect(umamiDb.kind).toBe('APPLICATION' as Application['kind']);
    expect(workloadListOf(umamiDb)).toBe('data');
  });

  it('keeps a tool among the applications', () => {
    expect(workloadListOf(app('kuma', { kind: 'TOOL' as Application['kind'] }))).toBe('applications');
  });

  it('keeps a system database in System', () => {
    expect(
      workloadListOf(app('platform-db', { kind: 'SYSTEM' as Application['kind'], imageRef: 'postgres:16', labels: composedLabels })),
    ).toBe('system');
  });

  it('puts a declared database, and a building block with a declared engine, in Data', () => {
    expect(workloadListOf(app('pg', { kind: 'DATABASE' as Application['kind'] }))).toBe('data');
    const queue = app('nats', { labels: { 'flui.cloud/app-type': 'building-block', 'flui.cloud/db-engine': 'nats' } });
    expect(workloadListOf(queue)).toBe('data');
  });

  it('does not take an application image tagged with a database name for a database', () => {
    expect(workloadListOf(app('web', { imageRef: 'umami-software/umami:postgresql-v2' }))).toBe('applications');
  });

  it('leaves the bundle in Applications and shows its data store in Data with a note', () => {
    expect(groupListOf(bundle)).toBe('applications');
    expect(workloadEntries([bundle], 'applications').map((e) => e.group.id)).toEqual(['install-umami']);
    const data = workloadEntries([bundle], 'data');
    expect(data.map((e) => e.group.id)).toEqual(['umami-308040-db']);
    expect(data[0].partOf).toEqual({ id: 'install-umami', name: 'umami' });
    expect(workloadListCounts([bundle])).toEqual({ applications: 1, data: 1, system: 0 });
  });

  it('does not count the showcase among the caller\u2019s own', () => {
    const shown = (a: Application) => ({ ...a, access: { tabs: [], readOnly: true, showcase: true, dataAccess: false } }) as Application;
    const showcase = { ...bundle, id: 'install-live', components: bundle.components.map(shown) };
    expect(workloadListCounts([bundle, showcase])).toEqual({ applications: 1, data: 1, system: 0 });
  });

  it('never lists a data bundle twice', () => {
    const ferret = app('ferret', { kind: 'DATABASE' as Application['kind'] });
    const store = app('ferret-pg', { imageRef: 'postgres:16', labels: composedLabels });
    const dataBundle = { ...bundle, id: 'install-ferret', primaryComponentId: ferret.id, components: [ferret, store] };
    expect(workloadEntries([dataBundle], 'data').map((e) => e.group.id)).toEqual(['install-ferret']);
  });

  it('lights the list of the opened recap or application', () => {
    const groups = [bundle];
    const apps = [umami, umamiDb];
    expect(openedWorkloadList('install-umami', groups, apps)).toBe('applications');
    expect(openedWorkloadList('umami-308040-db', groups, apps)).toBe('data');
    expect(openedWorkloadList('umami-app', groups, apps)).toBe('applications');
    expect(openedWorkloadList('unknown', groups, apps)).toBeNull();
  });

  it('offers the Tools chip only when there are tools, and engine families only when there are two', () => {
    const web = standalone(app('web'));
    const kuma = standalone(app('kuma', { kind: 'TOOL' as Application['kind'] }));
    expect(workloadTypeOptions([web], 'applications')).toEqual([]);
    expect(workloadTypeOptions([web, kuma], 'applications').map((t) => t.key)).toEqual(['application', 'tool']);

    const pg = standalone(app('pg', { kind: 'DATABASE' as Application['kind'], imageRef: 'postgres:16', labels: composedLabels }));
    const redis = standalone(app('redis', { kind: 'DATABASE' as Application['kind'], imageRef: 'redis:7', labels: composedLabels }));
    expect(workloadTypeOptions([pg], 'data')).toEqual([]);
    expect(workloadTypeOptions([pg, redis], 'data').map((t) => t.label)).toEqual(['SQL', 'Key-value']);
  });
});
