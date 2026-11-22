import type { AppHealthChecks } from '../../service/app-health-checks.service';
import { formatRate } from '../../../shared/utils/metric-format';

export type MonitoringNoteTone = 'warning' | 'error';

export interface MonitoringNote {
  readonly text: string;
  readonly hint?: string;
  readonly tone: MonitoringNoteTone;
}

export interface MonitoringMetric {
  readonly label: string;
  readonly value: string;
  readonly caption: string;
  readonly hint?: string;
  readonly notes: readonly MonitoringNote[];
}

export interface MonitoringReadings {
  readonly cpu: { usage_cores: number | null; limits_cores: number | null } | null;
  readonly memory: { usage_bytes: number | null; limits_bytes: number | null } | null;
  readonly network: {
    receive_bytes_rate: number | null;
    transmit_bytes_rate: number | null;
  } | null;
  readonly replicas: { ready: number | null; desired: number | null; unavailable: number };
  readonly restarts: number;
  readonly restartsHour: number;
  readonly throttledPercent: number | null;
  readonly lastDip: string | null;
  readonly checks: AppHealthChecks | null;
}

const HEALTH_HINT =
  'A copy too busy to answer its readiness check stops receiving traffic; with no other copy ready, visitors get errors. More replicas keep the route open. A copy starting or stopping does not answer either: that is counted apart.';

export function formatCpu(cores: number): string {
  if (cores >= 1) return `${cores.toFixed(2)} cores`;
  return `${(cores * 1000).toFixed(0)} m`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
  }
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes.toFixed(0)} B`;
}

export function limitPercent(usage: number | null | undefined, limit: number | null | undefined) {
  return limit && limit > 0 ? ((usage ?? 0) / limit) * 100 : null;
}

function percentValue(pct: number | null): string {
  return pct == null ? '—' : `${pct.toFixed(1)}%`;
}

function times(n: number): string {
  return n === 1 ? 'time' : 'times';
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDipTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function replicasCaption(ready: number | null, desired: number | null, unavailable: number) {
  if (ready == null || desired == null) return 'no data';
  if (unavailable > 0) return `${unavailable} unavailable`;
  if (desired === 0) return 'none running';
  return ready >= desired ? 'all ready' : `${desired - ready} not ready`;
}

function throttleNotes(percent: number | null): MonitoringNote[] {
  return percent == null
    ? []
    : [
        {
          text: `Held back by its limit ${percent}% of the time`,
          hint: 'The application wanted more CPU than its limit allows. More replicas spread the load; a higher limit only helps one copy.',
          tone: 'warning',
        },
      ];
}

function dipNotes(at: string | null): MonitoringNote[] {
  return at
    ? [{ text: 'Not ready at times', hint: `Last at ${formatDipTime(at)}`, tone: 'warning' }]
    : [];
}

function healthMetric(checks: AppHealthChecks | null): MonitoringMetric {
  const known = !!checks?.read;
  const busy = checks?.readiness_busy ?? checks?.readiness ?? 0;
  const idle = Math.max(0, (checks?.readiness ?? 0) - busy);
  const notes: MonitoringNote[] = [];
  if (known && busy > 0) {
    const last =
      idle === 0 && checks!.last_failure_at
        ? ` · last at ${formatClock(checks!.last_failure_at)}`
        : '';
    notes.push({ text: `Too busy to answer ${busy} ${times(busy)}${last}`, tone: 'warning' });
  }
  if (known && checks!.restarts_by_liveness > 0) {
    const n = checks!.restarts_by_liveness;
    notes.push({ text: `Restarted ${n} ${times(n)} by its liveness check`, tone: 'error' });
  }
  const caption = idle > 0 ? `too busy, last hour · ${idle} while starting` : 'too busy, last hour';
  return {
    label: 'Health checks',
    value: known ? String(busy) : '—',
    caption: known ? caption : 'not read',
    hint: HEALTH_HINT,
    notes,
  };
}

export function monitoringMetrics(r: MonitoringReadings): MonitoringMetric[] {
  const { cpu, memory, network, replicas } = r;
  const netIn = network?.receive_bytes_rate ?? 0;
  const netOut = network?.transmit_bytes_rate ?? 0;
  const ready = replicas.ready;
  const desired = replicas.desired;
  return [
    {
      label: 'CPU',
      value: percentValue(limitPercent(cpu?.usage_cores, cpu?.limits_cores)),
      caption: `${formatCpu(cpu?.usage_cores ?? 0)} / ${formatCpu(cpu?.limits_cores ?? 0)}`,
      notes: throttleNotes(r.throttledPercent),
    },
    {
      label: 'Memory',
      value: percentValue(limitPercent(memory?.usage_bytes, memory?.limits_bytes)),
      caption: `${formatBytes(memory?.usage_bytes ?? 0)} / ${formatBytes(memory?.limits_bytes ?? 0)}`,
      notes: [],
    },
    {
      label: 'Replicas',
      value: ready == null || desired == null ? '—' : `${ready}/${desired}`,
      caption: replicasCaption(ready, desired, replicas.unavailable),
      notes: dipNotes(r.lastDip),
    },
    {
      label: 'Restarts',
      value: String(r.restarts),
      caption: `${r.restartsHour.toFixed(1)} last hour`,
      notes: [],
    },
    healthMetric(r.checks),
    {
      label: 'Network',
      value: formatRate(netIn + netOut),
      caption: `${formatRate(netIn)} in · ${formatRate(netOut)} out`,
      notes: [],
    },
  ];
}
