import { AppGroupView, Application, ApplicationKind, ApplicationKindEnum, getKindLabel } from '../../model/application.models';
import { originOf } from './applications-list-rows';

export interface HeaderPart {
  text: string;
  mono: boolean;
}

export function listRouteForKind(kind: ApplicationKind | undefined): string {
  switch (kind) {
    case ApplicationKindEnum.Database:
      return '/apps/databases';
    case ApplicationKindEnum.Tool:
      return '/apps/tools';
    case ApplicationKindEnum.System:
      return '/apps/system';
    default:
      return '/apps/applications';
  }
}

export function backLink(from: string | null, kind: ApplicationKind | undefined): string {
  return from === 'catalog' ? '/apps/catalog' : listRouteForKind(kind);
}

export function backLabel(from: string | null, kind: ApplicationKind | undefined): string {
  if (from === 'catalog') return 'Back to catalog';
  return `Back to ${getKindLabel(kind ?? ApplicationKindEnum.Application).toLowerCase()}`;
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
