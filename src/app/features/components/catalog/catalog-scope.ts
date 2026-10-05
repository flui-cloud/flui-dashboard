import { CatalogResponseDto } from '../../../core/api/model/models';

export type CatalogScope = 'applications' | 'data' | 'system';
export type CatalogSection = 'data' | 'applications' | 'tools' | 'system';

export interface CatalogScopeCopy {
  title: string;
  subtitle: string;
  back: string;
}

const SCOPE_COPY: Record<CatalogScope, CatalogScopeCopy> = {
  data: {
    title: 'Add a data store',
    subtitle: 'Databases, caches, queues, search and object stores — Flui provisions storage, secrets, backups and connection settings for you.',
    back: '/apps/data',
  },
  applications: {
    title: 'Add an application',
    subtitle: 'Curated open-source applications and tools ready to deploy on your cluster.',
    back: '/apps/applications',
  },
  system: {
    title: 'Add a system app',
    subtitle: 'Internal platform components — usually managed automatically.',
    back: '/apps/system',
  },
};

export const SECTION_LABEL: Record<CatalogSection, string> = {
  data: 'Data',
  applications: 'Applications',
  tools: 'Tools',
  system: 'System',
};

export const SECTION_ORDER: CatalogSection[] = ['data', 'applications', 'tools', 'system'];

export function scopeCopy(scope: CatalogScope | null): CatalogScopeCopy | null {
  return scope ? SCOPE_COPY[scope] : null;
}

/** `?list=` names the scope; the older `?appKind=` still lands in the matching one. */
export function catalogScopeOf(params: { get(name: string): string | null }): CatalogScope | null {
  const list = params.get('list');
  if (list === 'applications' || list === 'data' || list === 'system') return list;
  switch (params.get('appKind')) {
    case 'DATABASE':
      return 'data';
    case 'TOOL':
    case 'APPLICATION':
      return 'applications';
    case 'SYSTEM':
      return 'system';
    default:
      return null;
  }
}

/** A building block is a store other apps keep their data in, whatever kind the catalog gives it. */
export function catalogSectionOf(app: CatalogResponseDto): CatalogSection {
  const kind = String(app.appKind ?? '').toUpperCase();
  if (kind === 'SYSTEM') return 'system';
  if (kind === 'DATABASE' || app.appType === CatalogResponseDto.AppTypeEnum.BuildingBlock) return 'data';
  return kind === 'TOOL' ? 'tools' : 'applications';
}

export function inCatalogScope(app: CatalogResponseDto, scope: CatalogScope): boolean {
  const section = catalogSectionOf(app);
  if (scope === 'applications') return section === 'applications' || section === 'tools';
  return section === scope;
}
