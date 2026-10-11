import { AppGroupView, Application, ApplicationGroupTypeEnum } from './application.models';
import { DbEngineFamily, databaseEngineOf, engineFamilyOf } from './db-engine';
import { accessOf } from './app-access';

export type WorkloadList = 'applications' | 'data' | 'system';

export const WORKLOAD_LISTS: readonly WorkloadList[] = ['applications', 'data', 'system'];

export const WORKLOAD_LIST_ROUTE: Record<WorkloadList, string> = {
  applications: '/apps/applications',
  data: '/apps/data',
  system: '/apps/system',
};

export const WORKLOAD_LIST_LABEL: Record<WorkloadList, string> = {
  applications: 'Applications',
  data: 'Data',
  system: 'System',
};

export function isWorkloadList(value: unknown): value is WorkloadList {
  return value === 'applications' || value === 'data' || value === 'system';
}

function kindOf(app: Application | null | undefined): string {
  return String(app?.kind ?? '').toUpperCase();
}

export function workloadListOf(app: Application | null | undefined): WorkloadList {
  const kind = kindOf(app);
  if (kind === 'SYSTEM') return 'system';
  if (kind === 'DATABASE' || databaseEngineOf(app)) return 'data';
  return 'applications';
}

export function primaryComponentOf(group: AppGroupView): Application | undefined {
  return group.components.find((c) => c.id === group.primaryComponentId) ?? group.components[0];
}

export function groupListOf(group: AppGroupView): WorkloadList {
  return workloadListOf(primaryComponentOf(group));
}

export function isTool(app: Application | null | undefined): boolean {
  return kindOf(app) === 'TOOL';
}

/** A row of a list: a whole group, or a bundle's data store shown on its own in Data. */
export interface WorkloadEntry {
  group: AppGroupView;
  partOf: { id: string; name: string } | null;
}

function bundledDataStores(group: AppGroupView): AppGroupView[] {
  if (group.type !== ApplicationGroupTypeEnum.Composed || groupListOf(group) === 'data') return [];
  const primary = primaryComponentOf(group);
  return group.components
    .filter((c) => c !== primary && workloadListOf(c) === 'data')
    .map((c) => ({
      id: c.id,
      type: ApplicationGroupTypeEnum.Standalone,
      name: c.name,
      status: c.status,
      category: c.category,
      clusterId: c.clusterId,
      url: c.url,
      catalogSlug: c.catalogSlug,
      catalogInstallId: c.catalogInstallId,
      primaryComponentId: c.id,
      projectId: c.projectId ?? group.projectId ?? null,
      createdAt: c.createdAt,
      components: [c],
    }));
}

export function workloadEntries(groups: AppGroupView[], list: WorkloadList): WorkloadEntry[] {
  const entries: WorkloadEntry[] = groups
    .filter((g) => groupListOf(g) === list)
    .map((group) => ({ group, partOf: null }));
  if (list !== 'data') return entries;
  for (const bundle of groups) {
    for (const group of bundledDataStores(bundle)) {
      entries.push({ group, partOf: { id: bundle.id, name: bundle.name } });
    }
  }
  return entries;
}

/** Counts of the caller's own workloads; showcase groups are left out. */
export function workloadListCounts(groups: AppGroupView[]): Record<WorkloadList, number> {
  const own = groups.filter((g) => !isShowcaseGroup(g));
  return {
    applications: workloadEntries(own, 'applications').length,
    data: workloadEntries(own, 'data').length,
    system: workloadEntries(own, 'system').length,
  };
}

function isShowcaseGroup(group: AppGroupView): boolean {
  const primary =
    group.components.find((c) => c.id === group.primaryComponentId) ?? group.components[0];
  return !!accessOf(primary)?.showcase;
}

/**
 * The list an opened recap or detail page belongs to: the recap's group, or the
 * application itself, so a bundle's data store lights Data and its bundle Applications.
 */
export function openedWorkloadList(
  id: string,
  groups: AppGroupView[],
  apps: Application[],
): WorkloadList | null {
  const group = groups.find((g) => g.id === id);
  if (group) return groupListOf(group);
  const app = apps.find((a) => a.id === id);
  return app ? workloadListOf(app) : null;
}

export interface WorkloadType {
  key: string;
  label: string;
}

const FAMILY_TYPE: Record<DbEngineFamily, WorkloadType> = {
  sql: { key: 'sql', label: 'SQL' },
  keyvalue: { key: 'keyvalue', label: 'Key-value' },
  cache: { key: 'keyvalue', label: 'Key-value' },
  document: { key: 'document', label: 'Documents' },
  messaging: { key: 'messaging', label: 'Messaging' },
  streaming: { key: 'messaging', label: 'Messaging' },
  search: { key: 'search', label: 'Search' },
  fulltext: { key: 'search', label: 'Search' },
  'object-storage': { key: 'objects', label: 'Objects' },
  secrets: { key: 'secrets', label: 'Secrets' },
};

const TYPE_ORDER = ['application', 'tool', 'sql', 'keyvalue', 'document', 'messaging', 'search', 'objects', 'secrets'];

/** The chip a row answers to: application or tool in Applications, the engine family in Data. */
export function workloadTypeOf(group: AppGroupView): WorkloadType | null {
  const primary = primaryComponentOf(group);
  switch (groupListOf(group)) {
    case 'applications':
      return isTool(primary) ? { key: 'tool', label: 'Tools' } : { key: 'application', label: 'Applications' };
    case 'data': {
      const family = engineFamilyOf(primary);
      return family ? FAMILY_TYPE[family] : null;
    }
    default:
      return null;
  }
}

/** The chips worth showing: Tools only when there are some, engine families only when there are two. */
export function workloadTypeOptions(groups: AppGroupView[], list: WorkloadList): WorkloadType[] {
  const seen = new Map<string, WorkloadType>();
  for (const g of groups) {
    const type = workloadTypeOf(g);
    if (type) seen.set(type.key, type);
  }
  const options = TYPE_ORDER.filter((k) => seen.has(k)).map((k) => seen.get(k)!);
  if (list === 'applications') return seen.has('tool') ? options : [];
  if (list === 'data') return options.length > 1 ? options : [];
  return [];
}
