import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import {
  AppGroupView,
  Application,
  ApplicationStatusEnum,
  ApplicationSourceTypeEnum,
  getStatusLabel,
} from '../../model/application.models';
import type { AppCoverageRow } from '../../service/fleet.service';
import type { Project } from '../../model/project.model';
import { Tone, providerChip, relativeTime } from '../dashboard/home-state';

export type ListView = 'all' | 'running' | 'attention' | 'no_backup';

export interface ListFilters {
  search: string;
  view: ListView;
  cluster: string;
  project: string;
}

export interface ListRowContext {
  clusterName: string;
  providerName: string;
  project: Project | null;
  usage: ReadonlyMap<string, AppMetricsDto>;
  /** Null when the backup read did not answer: the column then says nothing. */
  coverage: ReadonlyMap<string, AppCoverageRow> | null;
  now?: number;
}

export interface ListRow {
  id: string;
  name: string;
  tone: Tone;
  statusLabel: string;
  subtitle: { text: string; tone: Tone; href: string | null };
  bundle: string | null;
  project: Project | null;
  cluster: { name: string; provider: string; chip: string };
  ready: { text: string; tone: Tone; title: string };
  origin: string;
  cpu: number | null;
  memory: number | null;
  usageTitle: string;
  backup: { label: string; tone: Tone; title: string };
  released: { text: string; title: string };
  attention: boolean;
  noBackup: boolean;
  running: boolean;
  searchText: string;
}

const ATTENTION_STATUSES = new Set<string>([
  ApplicationStatusEnum.Failed,
  ApplicationStatusEnum.Degraded,
  ApplicationStatusEnum.RollingBack,
  ApplicationStatusEnum.WaitingForRoom,
]);

const BUSY_STATUSES = new Set<string>([
  ApplicationStatusEnum.Pending,
  ApplicationStatusEnum.AwaitingBuild,
  ApplicationStatusEnum.Provisioning,
  ApplicationStatusEnum.Updating,
  ApplicationStatusEnum.Deleting,
]);

export function statusTone(status: string): Tone {
  if (status === ApplicationStatusEnum.Running) return 'ok';
  if (status === ApplicationStatusEnum.Failed) return 'danger';
  if (ATTENTION_STATUSES.has(status)) return 'warn';
  if (BUSY_STATUSES.has(status)) return 'info';
  return 'muted';
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return '';
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function primaryOf(group: AppGroupView): Application | undefined {
  return group.components.find((c) => c.id === group.primaryComponentId) ?? group.components[0];
}

export function originOf(app: Application | undefined, group?: AppGroupView): string {
  if (!app) return '—';
  if (group?.catalogSlug || group?.catalogInstallId || app.catalogSlug || app.catalogInstallId) {
    return 'Catalog';
  }
  switch (app.sourceType) {
    case ApplicationSourceTypeEnum.GitBuild: {
      const cfg = app.sourceConfig as { repositoryId?: string; gitUrl?: string } | undefined;
      if (cfg?.repositoryId || /github\.com/i.test(cfg?.gitUrl ?? '')) return 'GitHub';
      return 'Git';
    }
    case ApplicationSourceTypeEnum.DockerImage:
      return 'Image';
    case ApplicationSourceTypeEnum.HelmChart:
      return 'Chart';
    case ApplicationSourceTypeEnum.RawManifest:
      return 'Manifest';
    default:
      return '—';
  }
}

/** The first line of why an application is not running, as the API recorded it. */
export function failureReason(app: Application | undefined): string | null {
  if (!app) return null;
  const raw = app.reconciliationError ?? app.lastOperation?.errorMessage ?? app.endpointError ?? null;
  const line = raw?.split('\n').map((l) => l.trim()).find(Boolean);
  return line ?? null;
}

interface ReplicaSum {
  ready: number;
  desired: number;
  known: boolean;
}

function replicasOf(group: AppGroupView, usage: ReadonlyMap<string, AppMetricsDto>): ReplicaSum {
  let ready = 0;
  let desired = 0;
  let known = false;
  for (const c of group.components) {
    const status = usage.get(c.id)?.status;
    if (status?.replicas_ready == null || status?.replicas_desired == null) continue;
    known = true;
    ready += status.replicas_ready;
    desired += status.replicas_desired;
  }
  return { ready, desired, known };
}

function highest(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return nums.length ? Math.max(...nums) : null;
}

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v)}%`;
}

type CoverageSummary = ListRow['backup'] & { noBackup: boolean };

function backupOf(group: AppGroupView, coverage: ReadonlyMap<string, AppCoverageRow> | null, now: number): CoverageSummary {
  if (!coverage) return { label: '—', tone: 'muted', title: 'Backup state unavailable', noBackup: false };
  const rows = group.components
    .map((c) => coverage.get(c.id))
    .filter((r): r is AppCoverageRow => !!r && r.holdsData);
  if (rows.length === 0) {
    return { label: 'No data', tone: 'muted', title: 'Keeps no data of its own', noBackup: false };
  }
  const unprotected = rows.filter((r) => r.coverage === 'unprotected');
  if (unprotected.length) {
    return {
      label: 'No backup',
      tone: 'warn',
      title:
        rows.length > 1
          ? `${unprotected.map((r) => r.name).join(', ')} not protected`
          : 'Holds data and no recent backup protects it',
      noBackup: unprotected.some((r) => r.alarm),
    };
  }
  if (rows.some((r) => r.coverage === 'pending')) {
    return { label: 'First backup due', tone: 'info', title: 'A policy covers it and has not run yet', noBackup: false };
  }
  if (rows.some((r) => r.coverage === 'to_verify')) {
    return { label: 'To verify', tone: 'muted', title: 'Covered by a label selector Flui cannot check', noBackup: false };
  }
  if (rows.some((r) => r.coverage === 'not_backed_up_by_choice')) {
    return { label: 'Not backed up', tone: 'muted', title: 'Not backed up by choice', noBackup: false };
  }
  const oldest = rows
    .map((r) => r.lastSuccessAt)
    .filter((d): d is string => !!d)
    .sort((a, b) => a.localeCompare(b))[0];
  return {
    label: 'Backed up',
    tone: 'ok',
    title: oldest ? `Last backup ${relativeTime(oldest, now)}` : 'Backed up',
    noBackup: false,
  };
}

function isEndpointBroken(primary: Application | undefined): boolean {
  return (
    primary?.endpointCertificateStatus === 'failed' ||
    primary?.endpointCertificateStatus === 'expired' ||
    primary?.endpointStatus === 'ERROR'
  );
}

interface SubtitleInput {
  group: AppGroupView;
  primary: Application | undefined;
  status: AppGroupView['status'];
  host: string;
  replicas: ReplicaSum;
  replicaShort: boolean;
  endpointBroken: boolean;
}

function subtitleOf({ group, primary, status, host, replicas, replicaShort, endpointBroken }: SubtitleInput): ListRow['subtitle'] {
  if (ATTENTION_STATUSES.has(status)) {
    const reason = failureReason(primary);
    return {
      text: [getStatusLabel(status), reason].filter(Boolean).join(' · '),
      tone: statusTone(status),
      href: null,
    };
  }
  if (replicaShort) {
    return { text: `${replicas.ready} of ${replicas.desired} replicas ready`, tone: 'warn', href: null };
  }
  if (endpointBroken) {
    return {
      text: `${host || 'Endpoint'} · ${failureReason(primary) ?? 'certificate or DNS not ready'}`,
      tone: 'warn',
      href: null,
    };
  }
  if (host) return { text: host, tone: 'info', href: group.url ?? primary?.url ?? null };
  if (BUSY_STATUSES.has(status)) return { text: getStatusLabel(status), tone: 'info', href: null };
  if (status === ApplicationStatusEnum.Stopped) return { text: 'Stopped', tone: 'muted', href: null };
  return { text: 'Reachable inside the cluster', tone: 'muted', href: null };
}

function replicaTone(replicas: ReplicaSum): Tone {
  if (replicas.desired === 0) return 'muted';
  if (replicas.ready === 0) return 'danger';
  return replicas.ready < replicas.desired ? 'warn' : 'ok';
}

function readyOf(replicas: ReplicaSum): ListRow['ready'] {
  if (!replicas.known) return { text: '—', tone: 'muted', title: 'No replica readings' };
  return {
    text: `${replicas.ready} / ${replicas.desired}`,
    tone: replicaTone(replicas),
    title: `${replicas.ready} of ${replicas.desired} replicas ready`,
  };
}

function usageTitleOf(cpu: number | null, memory: number | null, composed: boolean): string {
  if (cpu == null && memory == null) return 'No usage readings against a limit';
  const scope = composed ? ' (highest component)' : '';
  return `CPU ${pct(cpu)} · memory ${pct(memory)} of the limit${scope}`;
}

function rowTone(status: string, attention: boolean): Tone {
  if (!attention) return statusTone(status);
  return status === ApplicationStatusEnum.Failed ? 'danger' : 'warn';
}

function bundleLabel(composed: boolean, version: string | null | undefined): string | null {
  if (!composed) return null;
  return version ? `Bundle · v${version}` : 'Bundle';
}

export function buildListRow(group: AppGroupView, ctx: ListRowContext): ListRow {
  const now = ctx.now ?? Date.now();
  const primary = primaryOf(group);
  const status = group.status;
  const replicas = replicasOf(group, ctx.usage);

  const replicaShort =
    status === ApplicationStatusEnum.Running && replicas.known && replicas.ready < replicas.desired;
  const endpointBroken = isEndpointBroken(primary);
  const attention = ATTENTION_STATUSES.has(status) || replicaShort || endpointBroken;

  const host = hostOf(group.url ?? primary?.url);
  const subtitle = subtitleOf({ group, primary, status, host, replicas, replicaShort, endpointBroken });
  const ready = readyOf(replicas);

  const cpu = highest(group.components.map((c) => ctx.usage.get(c.id)?.cpu?.utilization_percent));
  const memory = highest(group.components.map((c) => ctx.usage.get(c.id)?.memory?.utilization_percent));
  const composed = group.type === 'composed';
  const usageTitle = usageTitleOf(cpu, memory, composed);

  const backup = backupOf(group, ctx.coverage, now);
  const releasedAt = primary?.lastDeployedAt ?? group.createdAt;
  const version = primary?.catalogVersion;

  return {
    id: group.id,
    name: group.name,
    tone: rowTone(status, attention),
    statusLabel: getStatusLabel(status),
    subtitle,
    bundle: bundleLabel(composed, version),
    project: ctx.project,
    cluster: { name: ctx.clusterName || '—', provider: ctx.providerName, chip: providerChip(ctx.providerName || '?') },
    ready,
    origin: originOf(primary, group),
    cpu,
    memory,
    usageTitle,
    backup: { label: backup.label, tone: backup.tone, title: backup.title },
    released: {
      text: relativeTime(releasedAt, now),
      title: releasedAt ? new Date(releasedAt).toLocaleString() : '',
    },
    attention,
    noBackup: backup.noBackup,
    running: status === ApplicationStatusEnum.Running,
    searchText: [group.name, host, primary?.imageRef ?? '', ...group.components.map((c) => c.slug)]
      .join(' ')
      .toLowerCase(),
  };
}

/** Problems first, then applications holding data without a backup, then the order the API gave. */
export function sortRows(rows: ListRow[]): ListRow[] {
  const weight = (r: ListRow) => {
    if (r.attention) return 0;
    return r.noBackup ? 1 : 2;
  };
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => weight(a.row) - weight(b.row) || a.index - b.index)
    .map((x) => x.row);
}

export function matchesView(row: ListRow, view: ListView): boolean {
  switch (view) {
    case 'running':
      return row.running;
    case 'attention':
      return row.attention;
    case 'no_backup':
      return row.noBackup;
    default:
      return true;
  }
}

export function viewCounts(rows: ListRow[]): Record<ListView, number> {
  return {
    all: rows.length,
    running: rows.filter((r) => r.running).length,
    attention: rows.filter((r) => r.attention).length,
    no_backup: rows.filter((r) => r.noBackup).length,
  };
}
