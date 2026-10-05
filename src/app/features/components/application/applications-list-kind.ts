import { AppGroupView } from '../../model/application.models';
import { WorkloadList } from '../../model/workload-list';
import { ListFilters } from './applications-list-rows';

export interface ListCopy {
  title: string;
  emptyTitle: string;
  emptySubtitle: string;
  one: string;
  many: string;
}

const LIST_COPY: Record<WorkloadList, ListCopy> = {
  applications: {
    title: 'Applications',
    emptyTitle: 'No applications yet',
    emptySubtitle: 'Deploy one from a repository or install one from the catalog',
    one: 'application',
    many: 'applications',
  },
  data: {
    title: 'Data',
    emptyTitle: 'No data stores yet',
    emptySubtitle: 'Databases, caches, queues and object stores you add appear here',
    one: 'data store',
    many: 'data stores',
  },
  system: {
    title: 'System',
    emptyTitle: 'No system applications found',
    emptySubtitle: 'No system applications are currently deployed',
    one: 'system application',
    many: 'system applications',
  },
};

export function listCopy(list: WorkloadList): ListCopy {
  return LIST_COPY[list];
}

export const EMPTY_FILTERS: ListFilters = { search: '', view: 'all', type: '', cluster: '', project: '' };

const PROVIDER_NAMES: Record<string, string> = {
  hetzner: 'Hetzner',
  contabo: 'Contabo',
  scaleway: 'Scaleway',
  ovh: 'OVH',
  byos: 'Your server',
};

export function providerName(provider: string | undefined, displayNameOf: (id: string) => string | undefined): string {
  if (!provider) return '';
  return displayNameOf(provider) || PROVIDER_NAMES[provider] || provider;
}

export function listSummary(groups: AppGroupView[], list: WorkloadList): string {
  const copy = LIST_COPY[list];
  const clusters = new Set(groups.map((g) => g.clusterId)).size;
  if (groups.length === 0) return `No ${copy.many} yet`;
  const noun = groups.length === 1 ? copy.one : copy.many;
  return `${groups.length} ${noun} on ${clusters} cluster${clusters === 1 ? '' : 's'}`;
}

export function activeFilterCount(f: ListFilters): number {
  return (f.search ? 1 : 0) + (f.view === 'all' ? 0 : 1) + (f.type ? 1 : 0) + (f.cluster ? 1 : 0) + (f.project ? 1 : 0);
}
