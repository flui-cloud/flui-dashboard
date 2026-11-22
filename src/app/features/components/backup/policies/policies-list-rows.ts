import type { StatusTone } from '../../../../ui/primitives/status';
import type { BackupPolicy } from '../../../model/backup.models';
import type { BackupHealthState, BackupPolicyActivity } from '../../../model/backup-run.models';
import { runStatusBadge } from '../../../model/backup-badges';
import {
  formatLocalDateTime,
  formatRelativeTime,
  formatUtcDateTime,
  runTime,
} from '../../../model/backup-activity';
import { policyEngineLabel } from '../../../model/backup-protection.models';
import { backupBadgeTone } from '../shared/backup-tones';
import { nextRunIso, retentionText, scheduleView, scopeSummary } from './policy-text';

export interface PolicyRow {
  readonly id: string;
  readonly name: string;
  readonly engine: string;
  readonly cluster: string;
  readonly scope: string;
  readonly schedule: string;
  readonly cron: string | null;
  readonly retention: string;
  readonly destination: string;
  readonly replicas: number;
  readonly health: { state: BackupHealthState; detail: string } | null;
  readonly lastRun: { tone: StatusTone; label: string; when: string; title: string | null } | null;
  readonly nextRun: { text: string; title: string | null };
  readonly status: string;
}

function hover(iso: string | null): string | null {
  return iso ? `${formatLocalDateTime(iso)} (${formatUtcDateTime(iso)})` : null;
}

export function policyRow(
  p: BackupPolicy,
  clusterName: string,
  activity: BackupPolicyActivity | null,
): PolicyRow {
  const schedule = scheduleView(p.cronSchedule, activity);
  const primary = p.destinations.find((d) => d.role === 'primary') ?? p.destinations[0];
  const last = activity?.lastRun ?? null;
  const lastAt = last ? runTime(last) : null;
  const next =
    activity?.schedule.nextRunAt ?? (p.status === 'paused' ? null : nextRunIso(schedule.cron));
  return {
    id: p.id,
    name: p.name,
    engine: policyEngineLabel(p.engineClass, p.engine),
    cluster: clusterName,
    scope: scopeSummary(p),
    schedule: schedule.text,
    cron: schedule.cron,
    retention: retentionText(p),
    destination: primary ? primary.destination?.name || primary.destinationId.slice(0, 8) : '—',
    replicas: p.destinations.filter((d) => d.role === 'replica').length,
    health: activity ? { state: activity.health.state, detail: activity.health.detail } : null,
    lastRun: last
      ? {
          tone: backupBadgeTone('job', last.status),
          label: runStatusBadge(last.status).label,
          when: formatRelativeTime(lastAt),
          title: hover(lastAt),
        }
      : null,
    nextRun: { text: formatRelativeTime(next), title: hover(next) },
    status: p.status,
  };
}
