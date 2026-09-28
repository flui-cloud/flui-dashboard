import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import { NODE_SERIES_COLORS } from '../../../shared/components/charts';
import { formatBytes } from '../../../shared/utils/metric-format';
import { databaseEngineOf, engineDescriptor } from '../../model/db-engine';
import { Application, ApplicationKindEnum, getStatusLabel } from '../../model/application.models';
import type { AppProtection } from '../../service/fleet.service';
import { Tone, relativeTime } from '../dashboard/home-state';
import { statusTone } from './applications-list-rows';
import { BackupBand, appEventText, backupBand } from './app-recap-view';

export interface ComponentCard {
  app: Application;
  role: string;
  badge: string;
  status: { label: string; tone: Tone };
  meta: string;
  bars: { key: string; percent: number | null; color: string }[];
  backup: BackupBand | null;
}

export interface RecentEvent {
  id: string;
  at: string;
  text: string;
  tone: Tone;
}

export interface BackupAlarm {
  app: Application;
  path: string;
  title: string;
  detail: string;
}

type AuditEvent = Parameters<typeof appEventText>[0];

const EVENT_TONE: Record<string, Tone> = {
  created: 'ok',
  deploy: 'info',
  rollback: 'warn',
  stop: 'muted',
};

export function statusOf(status: string): { label: string; tone: Tone } {
  return { label: getStatusLabel(status as Application['status']), tone: statusTone(status) };
}

export function roleOf(app: Application): string {
  const labels = app.labels as Record<string, string> | undefined;
  return labels?.['flui.cloud/composed-component'] ?? app.name;
}

function replicaSummary(ready: number | null | undefined, desired: number | null | undefined): string {
  if (ready == null || desired == null) return 'replicas not reported';
  const noun = desired === 1 ? 'replica' : 'replicas';
  return `${ready} of ${desired} ${noun}`;
}

export function componentCard(
  app: Application,
  metrics: AppMetricsDto | undefined,
  protection: AppProtection | undefined,
  isPrimary: boolean,
): ComponentCard {
  const s = metrics?.status;
  const replicas = replicaSummary(s?.replicas_ready, s?.replicas_desired);
  const volume = metrics?.volume?.capacity_bytes;
  const bars: ComponentCard['bars'] = [
    { key: 'CPU', percent: metrics?.cpu?.utilization_percent ?? null, color: NODE_SERIES_COLORS[0] },
    { key: 'MEM', percent: metrics?.memory?.utilization_percent ?? null, color: NODE_SERIES_COLORS[1] },
  ];
  if (volume != null) {
    bars.push({ key: 'DISK', percent: metrics?.volume?.utilization_percent ?? null, color: NODE_SERIES_COLORS[2] });
  }
  const engine = databaseEngineOf(app);
  const badge = engine
    ? `${engineDescriptor(engine).label} · ${app.exposure}`
    : [isPrimary ? 'primary' : null, app.exposure].filter(Boolean).join(' · ');
  return {
    app,
    role: roleOf(app),
    badge,
    status: statusOf(app.status),
    meta: volume != null ? `${replicas} · volume ${formatBytes(volume)}` : replicas,
    bars,
    backup: backupBand(protection),
  };
}

export function splitCards(cards: ComponentCard[], primaryId: string | undefined): { front: ComponentCard[]; back: ComponentCard[] } {
  const isFront = (c: ComponentCard) => c.app.id === primaryId || c.app.exposure === 'public';
  const matched = cards.filter(isFront);
  const front = matched.length ? matched : cards.slice(0, 1);
  const frontIds = new Set(front.map((c) => c.app.id));
  return { front, back: cards.filter((c) => !frontIds.has(c.app.id)) };
}

export function runningSummary(components: Application[]): string {
  const running = components.filter((c) => c.status === 'running').length;
  return `${running} of ${components.length} components running`;
}

export function internalNote(back: ComponentCard[]): string {
  if (!back.length || back.some((c) => c.app.exposure !== 'cluster')) return '';
  const names = back.map((c) => c.role).join(', ');
  return `${names} ${back.length === 1 ? 'is' : 'are'} reachable inside the cluster only.`;
}

export function backupAlarms(
  components: Application[],
  protection: Record<string, AppProtection>,
  metrics: Record<string, AppMetricsDto>,
): BackupAlarm[] {
  const alarms: BackupAlarm[] = [];
  for (const app of components) {
    const cov = protection[app.id]?.coverage;
    if (!cov?.alarm || !cov.protectPath) continue;
    const size = metrics[app.id]?.volume?.capacity_bytes;
    const isDb = app.kind === ApplicationKindEnum.Database || !!databaseEngineOf(app);
    const name = roleOf(app);
    const where = size == null ? '' : ` on a ${formatBytes(size)} volume`;
    alarms.push({
      app,
      path: cov.protectPath,
      title: isDb ? 'The database has no backup' : `${name} has no backup`,
      detail: `${name} keeps data${where} and no recent backup protects it.`,
    });
  }
  return alarms;
}

/** Audit answers per component, merged newest first; a component whose read failed is `null`. */
export function recentEvents(components: Application[], answers: unknown[], limit = 5): RecentEvent[] {
  const merged: RecentEvent[] = [];
  answers.forEach((value, i) => {
    if (value == null) return;
    const list = Array.isArray(value) ? value : ((value as { events?: unknown[] }).events ?? []);
    for (const e of list as AuditEvent[]) {
      merged.push({
        id: e.id,
        at: e.createdAt,
        text: components.length > 1 ? `${roleOf(components[i])}: ${appEventText(e)}` : appEventText(e),
        tone: EVENT_TONE[e.eventType] ?? 'muted',
      });
    }
  });
  merged.sort((a, b) => b.at.localeCompare(a.at));
  return merged.slice(0, limit);
}

export function dbSubtitle(app: Application): string {
  const engine = databaseEngineOf(app);
  const label = engine ? engineDescriptor(engine).label : 'Database';
  const version = app.catalogVersion ? ` ${app.catalogVersion}` : '';
  const reach = app.exposure === 'cluster' ? 'cluster only' : app.exposure;
  return `${label}${version} · ${reach}`;
}

export function dbData(metrics: AppMetricsDto | undefined): { value: string; label: string } {
  const v = metrics?.volume;
  if (v?.used_bytes == null) return { value: '—', label: 'Data' };
  return {
    value: formatBytes(v.used_bytes),
    label: v.capacity_bytes != null ? `Data of ${formatBytes(v.capacity_bytes)}` : 'Data',
  };
}

export function dbLastBackup(protection: AppProtection | undefined, now = Date.now()): { value: string; tone: Tone } {
  const cov = protection?.coverage;
  if (!cov) return { value: '—', tone: 'muted' };
  if (!cov.lastSuccessAt) return { value: 'None', tone: cov.holdsData ? 'warn' : 'muted' };
  return { value: relativeTime(cov.lastSuccessAt, now), tone: cov.coverage === 'protected' ? 'ok' : 'warn' };
}
