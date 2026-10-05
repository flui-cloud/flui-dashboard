import { AppGroupView, Application, ApplicationKind, ApplicationKindEnum } from '../../model/application.models';
import { WORKLOAD_LIST_LABEL, WORKLOAD_LIST_ROUTE, WorkloadList, workloadListOf } from '../../model/workload-list';
import { databaseEngineOf, engineDescriptor } from '../../model/db-engine';
import { originOf } from './applications-list-rows';

export interface HeaderPart {
  text: string;
  mono: boolean;
}

export function backLink(from: string | null, list: WorkloadList): string {
  return from === 'catalog' ? '/apps/catalog' : WORKLOAD_LIST_ROUTE[list];
}

export function backLabel(from: string | null, list: WorkloadList): string {
  if (from === 'catalog') return 'Back to catalog';
  return `Back to ${WORKLOAD_LIST_LABEL[list].toLowerCase()}`;
}

export function kindLabel(kind: ApplicationKind | undefined): string {
  switch (kind) {
    case ApplicationKindEnum.Database:
      return 'Database';
    case ApplicationKindEnum.Tool:
      return 'Tool';
    case ApplicationKindEnum.System:
      return 'System';
    default:
      return 'Application';
  }
}

export function kindChip(group: AppGroupView, primary: Application | null): string {
  if (group.type === 'composed') {
    const n = group.components.length;
    return `Bundle · ${n} component${n === 1 ? '' : 's'}`;
  }
  if (primary && workloadListOf(primary) === 'data') {
    const engine = databaseEngineOf(primary);
    if (engine) return engineDescriptor(engine).label;
    return primary.kind === ApplicationKindEnum.Database ? kindLabel(primary.kind) : 'Data store';
  }
  return kindLabel(primary?.kind);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function headerMeta(group: AppGroupView, primary: Application | null, clusterName: string): HeaderPart[] {
  const parts: HeaderPart[] = [];
  const origin = originOf(primary ?? undefined, group);
  if (group.type === 'composed' || origin === 'Catalog') {
    parts.push({ text: origin === 'Catalog' ? 'From the catalog' : origin, mono: false });
  } else if (primary?.imageRef) {
    parts.push({ text: primary.imageRef, mono: true });
  } else {
    parts.push({ text: origin, mono: false });
  }
  if (clusterName) parts.push({ text: clusterName, mono: false });
  parts.push({ text: `created ${formatDate(group.createdAt)}`, mono: false });
  return parts;
}

export function endpointHostOf(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}

export function openUrlOf(url: string, tlsEnabled: boolean | null): string {
  if (!url) return '';
  return tlsEnabled === false ? url.replace(/^https:\/\//i, 'http://') : url;
}
