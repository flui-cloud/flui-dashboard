import { AppGroupView, ApplicationKind, ApplicationKindEnum } from '../../model/application.models';
import { ListFilters } from './applications-list-rows';

export interface KindCopy {
  cta: string;
  emptyTitle: string;
  emptySubtitle: string;
  listName: string;
}

const KIND_COPY: Partial<Record<ApplicationKind, KindCopy>> = {
  [ApplicationKindEnum.Database]: {
    cta: 'Add Database',
    emptyTitle: 'No databases found',
    emptySubtitle: 'Deploy your first database to get started',
    listName: 'databases',
  },
  [ApplicationKindEnum.Tool]: {
    cta: 'Add Tool',
    emptyTitle: 'No tools found',
    emptySubtitle: 'Deploy your first tool to get started',
    listName: 'tools',
  },
  [ApplicationKindEnum.System]: {
    cta: 'Add System App',
    emptyTitle: 'No system applications found',
    emptySubtitle: 'No system applications are currently deployed',
    listName: 'system',
  },
};

const APPLICATION_COPY: KindCopy = {
  cta: 'Add Application',
  emptyTitle: 'No applications found',
  emptySubtitle: 'Deploy your first application to get started',
  listName: 'applications',
};

export function kindCopy(kind: ApplicationKind): KindCopy {
  return KIND_COPY[kind] ?? APPLICATION_COPY;
}

export const EMPTY_FILTERS: ListFilters = { search: '', view: 'all', cluster: '', project: '' };

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

export function listSummary(groups: AppGroupView[], title: string): string {
  const clusters = new Set(groups.map((g) => g.clusterId)).size;
  const noun = title.toLowerCase();
  if (groups.length === 0) return `No ${noun} yet`;
  const label = groups.length === 1 ? noun.replace(/s$/, '') : noun;
  return `${groups.length} ${label} on ${clusters} cluster${clusters === 1 ? '' : 's'}`;
}

export function activeFilterCount(f: ListFilters): number {
  return (f.search ? 1 : 0) + (f.view === 'all' ? 0 : 1) + (f.cluster ? 1 : 0) + (f.project ? 1 : 0);
}

export function deployTarget(kind: ApplicationKind): string {
  return kind === ApplicationKindEnum.Database || kind === ApplicationKindEnum.Tool ? '/apps/catalog' : '/apps/deploy/new';
}
