import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import type { ApplicationReleaseDto } from '../../../core/api/model/applicationReleaseDto';
import type { AppAuditEventSummaryDto } from '../../../core/api/model/appAuditEventSummaryDto';
import { formatBytes } from '../../../shared/utils/metric-format';
import type { Application } from '../../model/application.models';
import type { AppProtection } from '../../service/fleet.service';
import { Tone, relativeTime } from '../dashboard/home-state';

export interface RecapFact {
  key: string;
  value: string;
  sub: string;
  tone: Tone;
}

const pad = (n: number) => String(n).padStart(2, '0');

function plural(n: number, word: string): string {
  return n === 1 ? `${n} ${word}` : `${n} ${word}s`;
}

function replicasTone(ready: number, desired: number): Tone {
  if (desired === 0) return 'muted';
  if (ready === 0) return 'danger';
  return ready < desired ? 'warn' : 'ok';
}

function loadTone(percent: number): Tone {
  if (percent >= 90) return 'danger';
  return percent >= 75 ? 'warn' : 'ok';
}

/** A cron line in words for the shapes the policy form writes; anything else is shown as written. */
export function scheduleText(cron: string | null | undefined): string {
  if (!cron) return 'no schedule';
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  const num = (v: string) => /^\d+$/.test(v);
  if (num(min) && hour === '*' && dom === '*' && mon === '*' && dow === '*') return 'hourly';
  if (num(min) && num(hour) && mon === '*' && dom === '*') {
    const at = `${pad(+hour)}:${pad(+min)} UTC`;
    if (dow === '*') return `daily ${at}`;
    if (num(dow)) {
      const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][+dow % 7];
      return `${day}s ${at}`;
    }
  }
  return cron;
}

export function untilTime(date: string | null | undefined, now = Date.now()): string {
  if (!date) return '—';
  const at = Date.parse(date);
  if (Number.isNaN(at)) return '—';
  const min = Math.round((at - now) / 60000);
  if (min <= 0) return 'due now';
  if (min < 60) return `in ${min}m`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** What the recorded endpoint and certificate state say, in one phrase. */
export function endpointHealth(app: Application | null | undefined, tls: boolean | null): { label: string; tone: Tone } {
  if (!app) return { label: '', tone: 'muted' };
  const cert = app.endpointCertificateStatus;
  if (app.endpointStatus === 'ERROR') return { label: 'DNS or routing error', tone: 'danger' };
  if (cert === 'failed') return { label: 'Certificate failed', tone: 'danger' };
  if (cert === 'expired') return { label: 'Certificate expired', tone: 'danger' };
  if (app.endpointStatus && app.endpointStatus !== 'IN_SYNC') return { label: 'Publishing the endpoint', tone: 'info' };
  if (cert === 'pending' || cert === 'issuing') return { label: 'DNS ok · certificate being issued', tone: 'info' };
  if (cert === 'valid') return { label: 'DNS and certificate ok', tone: 'ok' };
  if (tls === false) return { label: 'DNS ok · no TLS', tone: 'muted' };
  return app.endpointStatus === 'IN_SYNC' ? { label: 'DNS ok', tone: 'ok' } : { label: '', tone: 'muted' };
}

export function replicasFact(metrics: AppMetricsDto | null | undefined): RecapFact {
  const s = metrics?.status;
  if (s?.replicas_ready == null || s?.replicas_desired == null) {
    return { key: 'Replicas', value: '—', sub: 'No readings', tone: 'muted' };
  }
  const tone = replicasTone(s.replicas_ready, s.replicas_desired);
  const restarts = s.restart_rate_1h == null ? null : Math.round(s.restart_rate_1h);
  return {
    key: 'Replicas',
    value: `${s.replicas_ready} / ${s.replicas_desired} ready`,
    sub: restarts == null ? 'Restarts not reported' : `${plural(restarts, 'restart')} in the last hour`,
    tone: restarts ? 'warn' : tone,
  };
}

function usagePart(label: string, percent: number | null | undefined, limit: number | null | undefined, usage: number | null | undefined): string {
  if (percent != null) return `${label} ${Math.round(percent)}%`;
  if (usage != null && limit == null) return `${label} no limit`;
  return `${label} —`;
}

export function resourcesFact(metrics: AppMetricsDto | null | undefined): RecapFact {
  if (!metrics) return { key: 'Resources', value: '—', sub: 'No readings', tone: 'muted' };
  const cpu = metrics.cpu;
  const mem = metrics.memory;
  const high = Math.max(cpu?.utilization_percent ?? 0, mem?.utilization_percent ?? 0);
  return {
    key: 'Resources',
    value: `${usagePart('CPU', cpu?.utilization_percent, cpu?.limits_cores, cpu?.usage_cores)} · ${usagePart('MEM', mem?.utilization_percent, mem?.limits_bytes, mem?.usage_bytes)}`,
    sub: 'of the limit, now',
    tone: loadTone(high),
  };
}

const RELEASE_LABEL: Record<string, { label: string; tone: Tone }> = {
  SUCCEEDED: { label: 'Succeeded', tone: 'ok' },
  FAILED: { label: 'Failed', tone: 'danger' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  ROLLED_BACK: { label: 'Rolled back', tone: 'warn' },
};

export function imageTag(imageRef: string | null | undefined): string {
  if (!imageRef) return '';
  const ref = imageRef.split('@')[0];
  const colon = ref.lastIndexOf(':');
  return colon > ref.lastIndexOf('/') ? ref.slice(colon + 1) : '';
}

export function releaseFact(release: ApplicationReleaseDto | null | undefined): RecapFact {
  if (!release) return { key: 'Latest release', value: '—', sub: 'No release recorded', tone: 'muted' };
  const status = RELEASE_LABEL[release.status] ?? { label: release.status, tone: 'muted' as Tone };
  const tag = imageTag(release.imageRef);
  return {
    key: 'Latest release',
    value: status.label,
    sub: [shortDate(release.completedAt ?? release.startedAt), tag].filter(Boolean).join(' · '),
    tone: status.tone,
  };
}

export interface BackupBand {
  label: string;
  tone: Tone;
  policy: string | null;
  last: string | null;
  next: string | null;
  kept: string | null;
  detail: string | null;
  runPolicyId: string | null;
  protectPath: string | null;
  holdsData: boolean;
}

/** The backup state of one application as the fleet rule judges it, with the facts of the policy behind it. */
export function backupBand(protection: AppProtection | null | undefined, now = Date.now()): BackupBand | null {
  const c = protection?.coverage;
  if (!c) return null;
  const policy = c.policy;
  const size = protection?.lastBackupSizeBytes;
  const sizeText = size == null ? null : formatBytes(size);
  const base: BackupBand = {
    label: '',
    tone: 'muted',
    policy: policy ? `${policy.name} · ${scheduleText(policy.schedule)}` : null,
    last: c.lastSuccessAt ? [relativeTime(c.lastSuccessAt, now), sizeText].filter(Boolean).join(' · ') : null,
    next: policy?.nextRunAt ? untilTime(policy.nextRunAt, now) : null,
    kept: policy?.retentionDays ? plural(policy.retentionDays, 'day') : null,
    detail: null,
    runPolicyId: policy?.id ?? null,
    protectPath: c.protectPath,
    holdsData: c.holdsData,
  };
  if (!c.holdsData && c.coverage !== 'protected') {
    return { ...base, label: 'Nothing to back up', tone: 'muted', detail: 'Keeps no data of its own: redeploying brings it back.' };
  }
  switch (c.coverage) {
    case 'protected':
      return { ...base, label: 'Backed up', tone: 'ok' };
    case 'pending':
      return { ...base, label: 'First backup due', tone: 'info' };
    case 'to_verify':
      return { ...base, label: 'To verify', tone: 'warn', detail: 'A label-selector policy covers it; Flui cannot check which apps it reaches.' };
    case 'not_backed_up_by_choice':
      return { ...base, label: 'Not backed up by choice', tone: 'muted', detail: c.decision?.note ?? null, protectPath: null };
    default:
      return { ...base, label: 'Not backed up', tone: 'warn', detail: UNPROTECTED_DETAIL[c.reason] ?? 'No recent backup protects its data.' };
  }
}

export const UNPROTECTED_DETAIL: Record<string, string> = {
  no_policy: 'No policy covers it.',
  stale: 'Its last backup is too old.',
  never_succeeded: 'Its policy has never succeeded.',
  left_out: 'The last backup left its volumes out.',
  no_schedule: 'Its policy has no schedule.',
};

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

/** Why an app holding data is not protected: what protecting its cluster ran into, else the coverage reason. */
export function unprotectedWhy(pendingReason: string | null | undefined, reason: string): string | null {
  return pendingReason ? sentence(pendingReason) : (UNPROTECTED_DETAIL[reason] ?? null);
}

/** Parses a path the API returned (`/route?a=b`) into router commands and query params. */
export function routeOf(path: string): { path: string; query: Record<string, string> } {
  const [p, q = ''] = path.split('?');
  return { path: p, query: Object.fromEntries(new URLSearchParams(q)) };
}

type EventMetadata = Record<string, any> | undefined;

function scaleText(m: EventMetadata): string {
  if (m?.['before']?.replicas === undefined || m?.['after']?.replicas === undefined) return 'Scaled replicas';
  return `Scaled from ${m['before'].replicas} to ${m['after'].replicas} replicas`;
}

function resourceUpdateText(m: EventMetadata): string {
  if (m?.['autoFix'] && m?.['previousMemoryLimit'] && m?.['newMemoryLimit']) {
    return `Memory limit raised ${m['previousMemoryLimit']} → ${m['newMemoryLimit']}`;
  }
  const parts: string[] = [];
  if (m?.['after']?.cpu?.limit) parts.push(`CPU limit ${m['before']?.cpu?.limit ?? '?'} → ${m['after'].cpu.limit}`);
  if (m?.['after']?.memory?.limit) parts.push(`Memory limit ${m['before']?.memory?.limit ?? '?'} → ${m['after'].memory.limit}`);
  return parts.length ? parts.join(', ') : 'Resources updated';
}

export function appEventText(event: AppAuditEventSummaryDto): string {
  const m = event.changeMetadata as EventMetadata;
  switch (event.eventType) {
    case 'deploy':
      return event.imageRef ? `Deployed ${event.imageRef}` : 'Deployed';
    case 'rollback':
      return `Rolled back to #${m?.['rollbackFromRevision'] ?? '?'}`;
    case 'scale':
      return scaleText(m);
    case 'resource_update':
      return resourceUpdateText(m);
    case 'restart':
      return 'Rolling restart triggered';
    case 'stop':
      return m?.['previousReplicas'] === undefined ? 'Application stopped' : `Stopped (was ${m['previousReplicas']} replicas)`;
    case 'start':
      return m?.['restoredReplicas'] === undefined ? 'Application started' : `Started (restored ${m['restoredReplicas']} replicas)`;
    case 'config_update':
      return 'Configuration variables updated';
    case 'created':
      return 'Application created';
    case 'reconciled':
      return 'Reconciled with cluster';
    default:
      return event.eventType;
  }
}

export const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-green-700 dark:text-green-400',
  info: 'text-primary',
  warn: 'text-amber-700 dark:text-amber-400',
  danger: 'text-destructive',
  muted: 'text-muted-foreground',
};

export const TONE_DOT: Record<Tone, string> = {
  ok: 'bg-green-500',
  info: 'bg-primary',
  warn: 'bg-amber-500',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/50',
};

export const TONE_PILL: Record<Tone, string> = {
  ok: 'chip-ok',
  info: 'chip-brand',
  warn: 'chip-warn',
  danger: 'chip-danger',
  muted: 'bg-muted text-muted-foreground',
};

export type RunState = 'running' | 'started' | 'failed';

export function runLabel(state: RunState | undefined): string {
  switch (state) {
    case 'running':
      return 'Starting…';
    case 'started':
      return 'Backup started';
    case 'failed':
      return 'Could not start · retry';
    default:
      return 'Back up now';
  }
}

export function runBusy(state: RunState | undefined): boolean {
  return state === 'running' || state === 'started';
}

export function barWidth(percent: number | null): number {
  return percent == null ? 0 : Math.max(2, Math.min(100, percent));
}

export function componentBackupDetail(band: BackupBand): string {
  if (band.protectPath) return band.detail ?? '';
  const parts = [band.last ? `last ${band.last}` : null, band.next ? `next ${band.next}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : (band.detail ?? '');
}
