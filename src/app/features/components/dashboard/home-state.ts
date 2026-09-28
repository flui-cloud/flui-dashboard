import { StatTileData, NODE_SERIES_COLORS } from '../../../shared/components/charts';
import { formatDelta, formatRate } from '../../../shared/utils/metric-format';
import { ClusterInfo, ClusterStatus, isControlClusterType } from '../../model/cluster.models';
import { FleetClusterMetrics, FleetMetrics, FleetPoint, FleetWindow } from '../../service/fleet.service';

export interface FreshInput {
  loading: boolean;
  userApps: number;
  clusters: Pick<ClusterInfo, 'clusterType'>[];
}

/**
 * A platform is "just installed" while nothing has been built on it yet: no
 * application of the user's and no workload cluster (one being created counts,
 * so its progress shows on the control room). Only the control cluster exists.
 */
export function isFreshInstall(input: FreshInput): boolean {
  if (input.loading) return false;
  const workload = input.clusters.filter((c) => !isControlClusterType(c.clusterType));
  return input.userApps === 0 && workload.length === 0;
}

const WINDOW_LABEL: Record<FleetWindow, string> = {
  '1h': 'last hour',
  '3h': 'last 3 hours',
  '24h': 'last day',
};

const percent = (value: number) => `${value.toFixed(1)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function valuesOf(series: FleetPoint[], pick: (p: FleetPoint) => number | null): number[] {
  return series.map(pick).filter((v): v is number => v != null);
}

function networkOf(p: FleetPoint): number | null {
  if (p.networkInBytesPerSecond == null && p.networkOutBytesPerSecond == null) return null;
  return (p.networkInBytesPerSecond ?? 0) + (p.networkOutBytesPerSecond ?? 0);
}

/**
 * The four fleet tiles, built only from what the fleet read returned: with no
 * cluster reporting now the value is a dash, never a zero.
 */
export function fleetTiles(metrics: FleetMetrics, fresh: boolean): StatTileData[] {
  const { current, series, clustersReporting, nodesReporting } = metrics.fleet;
  const hint = `vs the typical value over the ${WINDOW_LABEL[metrics.window]}`;
  const silent = 'no cluster reporting';
  const nodes = fresh ? 'control cluster only' : `across ${plural(nodesReporting, 'node')}`;

  const tile = (
    label: string,
    color: string,
    pick: (p: FleetPoint) => number | null,
    format: (v: number) => string,
    unit: string,
    footnote: string,
  ): StatTileData => {
    const spark = valuesOf(series, pick);
    const now = current ? pick(current) : null;
    if (now == null) return { label, value: '—', unit: '', spark, color, footnote: silent };
    const delta = formatDelta(now, spark, format);
    return {
      label,
      value: unit ? now.toFixed(1) : format(now),
      unit,
      spark,
      color,
      footnote,
      ...(delta.text ? { delta: delta.text, deltaTone: delta.tone, deltaHint: hint } : {}),
    };
  };

  const netIn = current?.networkInBytesPerSecond ?? null;
  const netOut = current?.networkOutBytesPerSecond ?? null;

  return [
    tile('Avg CPU', NODE_SERIES_COLORS[0], (p) => p.cpuPercent, percent, '%',
      fresh ? 'control cluster only' : `${plural(clustersReporting, 'cluster')} reporting`),
    tile('Avg memory', NODE_SERIES_COLORS[1], (p) => p.memoryPercent, percent, '%', nodes),
    tile('Avg disk', NODE_SERIES_COLORS[2], (p) => p.diskPercent, percent, '%', nodes),
    tile('Network', NODE_SERIES_COLORS[3], networkOf, formatRate, '',
      `↓ ${formatRate(netIn)} · ↑ ${formatRate(netOut)}`),
  ];
}

export function relativeTime(date: Date | string | null | undefined, now = Date.now()): string {
  if (!date) return '—';
  const at = typeof date === 'string' ? Date.parse(date) : date.getTime();
  if (Number.isNaN(at)) return '—';
  const min = Math.floor((now - at) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export type Tone = 'ok' | 'info' | 'warn' | 'danger' | 'muted';

export const CLUSTER_STATUS: Record<string, { label: string; tone: Tone }> = {
  [ClusterStatus.ACTIVE]: { label: 'Active', tone: 'ok' },
  [ClusterStatus.CREATING]: { label: 'Creating', tone: 'info' },
  [ClusterStatus.SCALING]: { label: 'Scaling', tone: 'info' },
  [ClusterStatus.UPDATING]: { label: 'Updating', tone: 'info' },
  [ClusterStatus.STARTING]: { label: 'Starting', tone: 'info' },
  [ClusterStatus.STOPPING]: { label: 'Stopping', tone: 'warn' },
  [ClusterStatus.STOPPED]: { label: 'Stopped', tone: 'muted' },
  [ClusterStatus.DELETING]: { label: 'Removing', tone: 'warn' },
  [ClusterStatus.DELETION_FAILED]: { label: 'Removal failed', tone: 'danger' },
  [ClusterStatus.ERROR]: { label: 'Error', tone: 'danger' },
  lost: { label: 'Lost', tone: 'danger' },
};

const IN_PROGRESS_NOTE: Partial<Record<string, string>> = {
  [ClusterStatus.CREATING]: 'Provisioning cluster',
  [ClusterStatus.SCALING]: 'Adding or removing nodes',
  [ClusterStatus.UPDATING]: 'Updating cluster',
  [ClusterStatus.STARTING]: 'Starting cluster',
  [ClusterStatus.STOPPING]: 'Stopping cluster',
  [ClusterStatus.DELETING]: 'Removing cluster',
};

export interface ClusterRowApps {
  user: number;
  system: number;
}

export interface ClusterRow {
  id: string;
  name: string;
  chip: string;
  meta: string;
  status: { label: string; tone: Tone };
  clusterStatus: string;
  live: boolean;
  cpu: number[];
  cpuNow: string;
  memory: number[];
  memoryNow: string;
  note: string;
  inProgress: boolean;
  apps: string;
}

export function providerChip(name: string): string {
  const words = name.trim().split(/[\s-]+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

function appsLabel(apps: ClusterRowApps | undefined): string {
  if (!apps) return '—';
  if (apps.user > 0) return plural(apps.user, 'app');
  if (apps.system > 0) return `${apps.system} system`;
  return '—';
}

function metricsNote(row: FleetClusterMetrics | undefined, now: number): string {
  if (!row) return '';
  switch (row.metrics) {
    case 'stale':
      return `No metrics since ${relativeTime(row.lastSampleAt, now)}`;
    case 'no_data':
      return 'No metrics in this window';
    case 'unavailable':
      return 'Metrics could not be read';
    default:
      return '';
  }
}

export function clusterRow(
  cluster: ClusterInfo,
  metrics: FleetClusterMetrics | undefined,
  apps: ClusterRowApps | undefined,
  providerName: string,
  now = Date.now(),
): ClusterRow {
  const status = CLUSTER_STATUS[cluster.status] ?? { label: cluster.status, tone: 'muted' as Tone };
  const nodes = cluster.nodeCount ?? 0;
  const meta = [
    providerName,
    isControlClusterType(cluster.clusterType) ? 'control' : null,
    nodes > 0 ? plural(nodes, 'node') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const live = metrics?.metrics === 'reporting' && !!metrics.current;
  const inProgressNote = IN_PROGRESS_NOTE[cluster.status];
  const series = metrics?.series ?? [];
  return {
    id: cluster.id ?? '',
    name: cluster.name ?? 'Unnamed cluster',
    chip: providerChip(providerName),
    meta,
    status,
    clusterStatus: cluster.status,
    live,
    cpu: live ? valuesOf(series, (p) => p.cpuPercent) : [],
    cpuNow: live && metrics!.current!.cpuPercent != null ? percent(metrics!.current!.cpuPercent) : '—',
    memory: live ? valuesOf(series, (p) => p.memoryPercent) : [],
    memoryNow:
      live && metrics!.current!.memoryPercent != null ? percent(metrics!.current!.memoryPercent) : '—',
    note: live ? '' : (inProgressNote ?? metricsNote(metrics, now)),
    inProgress: !!inProgressNote,
    apps: appsLabel(apps),
  };
}
