import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import { Tone } from '../dashboard/home-state';

export function runStateOf(m: AppMetricsDto, appStatus: string | null | undefined): { label: string; tone: Tone } {
  if (appStatus === 'waiting_for_room') return { label: 'Waiting for room', tone: 'warn' };
  const s = m.status;
  if (s.replicas_ready == null && s.replicas_desired == null) {
    const running = m.pods?.some((p) => p.phase === 'Running' && (p.count ?? 0) > 0) ?? false;
    return running ? { label: 'Healthy', tone: 'ok' } : { label: 'Down', tone: 'danger' };
  }
  const ready = s.replicas_ready ?? 0;
  const desired = s.replicas_desired ?? 0;
  if (ready === 0) return { label: 'Down', tone: 'danger' };
  if (ready < desired) return { label: 'Degraded', tone: 'warn' };
  return { label: 'Healthy', tone: 'ok' };
}

export function limitPercent(usage: number | null | undefined, limit: number | null | undefined): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(((usage ?? 0) / limit) * 100, 100);
}

export function loadTone(percent: number, warn: number, danger: number): Tone {
  if (percent >= danger) return 'danger';
  return percent >= warn ? 'warn' : 'ok';
}

export function replicasTone(ready: number, desired: number): Tone {
  if (desired === 0) return 'muted';
  if (ready === 0) return 'danger';
  return ready < desired ? 'warn' : 'ok';
}

export function formatCores(cores: number): string {
  return cores >= 1 ? `${cores.toFixed(2)}c` : `${(cores * 1000).toFixed(0)}m`;
}

export function formatUsageBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes.toFixed(0)}B`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export interface EndpointCounts<T> {
  count: number;
  synced: number;
  drift: number;
  primary: T | null;
  extraInSync: number;
}

export function endpointCountsOf<T extends { applicationId?: string | null; reconciliationStatus: string }>(
  endpoints: readonly T[],
  appId: string | null | undefined,
): EndpointCounts<T> {
  const mine = appId ? endpoints.filter((e) => e.applicationId === appId) : [];
  const inSync = mine.filter((e) => e.reconciliationStatus === 'IN_SYNC');
  return {
    count: mine.length,
    synced: inSync.length,
    drift: mine.filter((e) => e.reconciliationStatus === 'DRIFT' || e.reconciliationStatus === 'ERROR').length,
    primary: inSync[0] ?? null,
    extraInSync: Math.max(0, inSync.length - 1),
  };
}
