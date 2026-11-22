import {
  AppGroupView,
  Application,
  ApplicationKind,
  ApplicationKindEnum,
  getGroupKind,
  getKindLabel,
} from '../../model/application.models';
import { Project } from '../../model/project.model';
import { accessOf } from '../../model/app-access';
import { ListRow, buildListRow } from '../application/applications-list-rows';

export const UNASSIGNED_KEY = '__unassigned';

export interface ProjectSection {
  project: Project | null;
  groups: AppGroupView[];
  counts: { kind: ApplicationKind; count: number }[];
}

export interface WorkloadFilters {
  term: string;
  kind: string;
  includeSystem: boolean;
}

export interface WorkloadRow {
  row: ListRow;
  kind: string;
  target: Application | null;
}

export const SELECTABLE_KINDS: ApplicationKind[] = [
  ApplicationKindEnum.Application,
  ApplicationKindEnum.Database,
  ApplicationKindEnum.Tool,
];

export function sectionKey(section: ProjectSection): string {
  return section.project?.id ?? UNASSIGNED_KEY;
}

export function filterGroups(groups: AppGroupView[], filters: WorkloadFilters): AppGroupView[] {
  const term = filters.term.trim().toLowerCase();
  return groups.filter((g) => {
    const groupKind = getGroupKind(g);
    if (!filters.includeSystem && groupKind === ApplicationKindEnum.System) return false;
    if (filters.kind && groupKind !== filters.kind) return false;
    return !term || matchesTerm(g, term);
  });
}

export function buildSections(
  groups: AppGroupView[],
  projects: Project[],
  hideEmpty: boolean,
): ProjectSection[] {
  const byProject = new Map<string, AppGroupView[]>();
  const unassigned: AppGroupView[] = [];
  for (const group of groups) {
    if (group.projectId) {
      const bucket = byProject.get(group.projectId) ?? [];
      bucket.push(group);
      byProject.set(group.projectId, bucket);
    } else {
      unassigned.push(group);
    }
  }

  const sections: ProjectSection[] = [];
  for (const project of projects) {
    const bucket = byProject.get(project.id) ?? [];
    if (hideEmpty && bucket.length === 0) continue;
    sections.push({ project, groups: bucket, counts: countByKind(bucket) });
  }
  if (unassigned.length > 0) {
    sections.push({ project: null, groups: unassigned, counts: countByKind(unassigned) });
  }
  return sections;
}

export function sectionSummary(section: ProjectSection): string {
  if (section.groups.length === 0) return 'No workloads';
  return section.counts
    .map(
      ({ kind, count }) => `${count} ${singularWhenOne(getKindLabel(kind).toLowerCase(), count)}`,
    )
    .join(' · ');
}

export function clusterNamesOf(
  groups: AppGroupView[],
  clusterName: (id: string) => string,
): string[] {
  const names = new Set(groups.map((g) => clusterName(g.clusterId)).filter(Boolean));
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function workloadRows(
  groups: AppGroupView[],
  project: Project | null,
  clusterName: (id: string) => string,
): WorkloadRow[] {
  const now = Date.now();
  return groups.map((group) => ({
    row: buildListRow(group, {
      clusterName: clusterName(group.clusterId),
      providerName: '',
      project,
      usage: new Map(),
      coverage: null,
      now,
    }),
    kind: singularWhenOne(getKindLabel(getGroupKind(group)), 1),
    target: deleteTarget(group),
  }));
}

function deleteTarget(group: AppGroupView): Application | null {
  if (group.type === 'composed') return null;
  const app = group.components[0];
  if (!app || app.systemProtected || app.status === 'deleting') return null;
  return accessOf(app)?.readOnly ? null : app;
}

function matchesTerm(group: AppGroupView, term: string): boolean {
  if (group.name.toLowerCase().includes(term)) return true;
  return group.components.some(
    (c) => c.name.toLowerCase().includes(term) || (c.slug?.toLowerCase().includes(term) ?? false),
  );
}

function countByKind(groups: AppGroupView[]): ProjectSection['counts'] {
  const counts = new Map<ApplicationKind, number>();
  for (const group of groups) {
    const kind = getGroupKind(group);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
}

/** "1 application", "2 applications"; "system" has no plural to drop. */
export function singularWhenOne(label: string, count: number): string {
  return count === 1 && label.endsWith('s') ? label.slice(0, -1) : label;
}
