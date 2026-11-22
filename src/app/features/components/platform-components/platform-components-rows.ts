import { PlatformComponentResponseDto } from '../../../core/api/model/platformComponentResponseDto';
import { ClusterComponentsEntry } from '../../service/platform-components.service';

export type ClusterComponent = PlatformComponentResponseDto & {
  clusterId: string;
  clusterName: string;
};

export interface ComponentFilters {
  readonly search: string;
  readonly status: string;
  readonly cluster: string;
}

export interface ClusterGroup {
  readonly entry: ClusterComponentsEntry;
  readonly components: ClusterComponent[];
}

export function matchesComponent(
  c: PlatformComponentResponseDto,
  search: string,
  status: string,
): boolean {
  if (status && c.status !== status) return false;
  const q = search.toLowerCase();
  return !q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
}

export function clusterGroups(
  entries: readonly ClusterComponentsEntry[],
  f: ComponentFilters,
): ClusterGroup[] {
  return entries
    .filter((e) => !f.cluster || e.clusterId === f.cluster)
    .filter(
      (e) =>
        (!f.search && !f.status) ||
        e.components.some((c) => matchesComponent(c, f.search, f.status)),
    )
    .map((entry) => ({
      entry,
      components: entry.components
        .filter((c) => matchesComponent(c, f.search, f.status))
        .map((c) => ({ ...c, clusterId: entry.clusterId, clusterName: entry.clusterName })),
    }));
}

export function createdAtOf(comp: PlatformComponentResponseDto): string | undefined {
  const dates = comp.resources
    .map((r) => r.createdAt)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime());
  if (dates.length === 0) return undefined;
  return new Date(Math.min(...dates)).toISOString();
}

export function relativeAge(iso?: string): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
