import { NODE_SERIES_COLORS, StatTileData } from '../../../shared/components/charts';
import { formatDelta, formatRate } from '../../../shared/utils/metric-format';
import { AppGroupView, Application } from '../../model/application.models';
import { FleetWindow } from '../../service/fleet.service';

export interface GuestAppReading {
  /** `GET /observability/applications/:id/metrics/history` */
  history: Record<string, unknown> | null;
  /** `GET /observability/applications/:id/traffic/history` */
  traffic: Record<string, unknown> | null;
}

type Bag = Record<string, unknown>;

const bag = (value: unknown): Bag =>
  value && typeof value === 'object' ? (value as Bag) : {};
const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const points = (answer: Bag | null): Bag[] => {
  const list = bag(answer)['data_points'];
  return Array.isArray(list) ? (list as Bag[]) : [];
};
const series = (rows: Bag[], pick: (row: Bag) => number | null): number[] =>
  rows.map(pick).filter((v): v is number => v !== null);

const WINDOW_SECONDS: Record<FleetWindow, number> = { '1h': 3600, '3h': 10800, '24h': 86400 };

/** The range asked of the history routes: the home's window, sixty points across it. */
export function historyRange(window: FleetWindow, now = Date.now()): { start: string; end: string; step: string } {
  const seconds = WINDOW_SECONDS[window];
  return {
    start: new Date(now - seconds * 1000).toISOString(),
    end: new Date(now).toISOString(),
    step: `${Math.max(60, Math.round(seconds / 60))}s`,
  };
}

export function primaryOf(group: AppGroupView): Application | undefined {
  return group.components.find((c) => c.id === group.primaryComponentId) ?? group.components[0];
}

export function bytes(value: number | null): string {
  if (value === null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = value;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

const percent = (value: number) => value.toFixed(1);
const rate = (value: number) => (value < 10 ? value.toFixed(1) : String(Math.round(value)));
const network = (row: Bag): number | null => {
  const inbound = num(row['network_receive_rate']);
  const outbound = num(row['network_transmit_rate']);
  return inbound === null && outbound === null ? null : (inbound ?? 0) + (outbound ?? 0);
};

/** Copies ready out of copies wanted, from the latest reading. */
export function copiesOf(reading: GuestAppReading | undefined): string | null {
  const last = points(reading?.history ?? null).at(-1);
  if (!last) return null;
  const ready = num(last['replicas_ready']);
  const desired = num(last['replicas_desired']);
  return ready === null || desired === null ? null : `${ready}/${desired}`;
}

/**
 * CPU, memory, requests and network of one application, drawn the way the
 * operator's home draws the fleet: the latest value, its history and how far it
 * sits from the typical one. Before the first reading every value is a dash.
 */
export function appTiles(reading: GuestAppReading | undefined): StatTileData[] {
  const rows = points(reading?.history ?? null);
  const requests = points(reading?.traffic ?? null);
  const last = rows.at(-1) ?? {};
  const lastRequests = requests.at(-1) ?? {};
  const hint = 'vs the typical value in the window';

  const tile = (
    label: string,
    color: string,
    spark: number[],
    now: number | null,
    show: (value: number) => string,
    unit: string,
    footnote: string,
  ): StatTileData => {
    if (now === null) return { label, value: '—', unit: '', spark, color, footnote: reading ? footnote : 'reading…' };
    const delta = formatDelta(now, spark, show);
    return {
      label,
      value: show(now),
      unit,
      spark,
      color,
      footnote,
      ...(delta.text ? { delta: delta.text, deltaTone: delta.tone, deltaHint: hint } : {}),
    };
  };

  return [
    tile(
      'CPU',
      NODE_SERIES_COLORS[0],
      series(rows, (r) => num(r['cpu_utilization_percent'])),
      num(last['cpu_utilization_percent']),
      percent,
      '%',
      'of its limit',
    ),
    tile(
      'Memory',
      NODE_SERIES_COLORS[1],
      series(rows, (r) => num(r['memory_utilization_percent'])),
      num(last['memory_utilization_percent']),
      percent,
      '%',
      bytes(num(last['memory_usage_bytes'])),
    ),
    tile(
      'Requests',
      NODE_SERIES_COLORS[2],
      series(requests, (r) => num(r['requests_per_second'])),
      num(lastRequests['requests_per_second']),
      rate,
      '/s',
      'at its public address',
    ),
    tile(
      'Network',
      NODE_SERIES_COLORS[3],
      series(rows, network),
      network(last),
      formatRate,
      '',
      `↓ ${formatRate(num(last['network_receive_rate']))} · ↑ ${formatRate(num(last['network_transmit_rate']))}`,
    ),
  ];
}
