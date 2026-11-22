import type { StatusTone } from '../../../../ui/primitives/status';
import type { BackupPolicy, BackupScope, ReplicationStatus } from '../../../model/backup.models';
import type { BackupPolicyActivity } from '../../../model/backup-run.models';
import { describeCron, nextCronRun } from '../../application/cron-text';

export interface StatusView {
  readonly tone: StatusTone;
  readonly label: string;
}

const REPLICATION: Record<ReplicationStatus, StatusView> = {
  ok: { tone: 'success', label: 'In sync' },
  degraded: { tone: 'warning', label: 'Degraded' },
  failed: { tone: 'error', label: 'Failed' },
  never_run: { tone: 'neutral', label: 'Never run' },
};

const SCOPE: Record<BackupScope, string> = {
  cluster_all: 'Entire cluster',
  namespaces: 'Specific namespaces',
  applications: 'Specific applications',
  label_selector: 'Label selector',
};

export function replicationStatusView(status: string | null | undefined): StatusView {
  return REPLICATION[status as ReplicationStatus] ?? { tone: 'neutral', label: 'Unknown' };
}

export function scopeLabel(scope: string | null | undefined): string {
  return SCOPE[scope as BackupScope] ?? 'Unknown';
}

export function scopeSummary(policy: Pick<BackupPolicy, 'scope' | 'scopeSelector'>): string {
  const selector = policy.scopeSelector;
  if (policy.scope === 'applications') {
    const n = selector?.applicationIds?.length ?? 0;
    return n === 1 ? '1 application' : `${n} applications`;
  }
  if (policy.scope === 'namespaces' && selector?.namespaces?.length) {
    return selector.namespaces.join(', ');
  }
  if (policy.scope === 'label_selector' && selector?.labelSelector) return selector.labelSelector;
  return scopeLabel(policy.scope);
}

export function volumeRetentionText(keepMonthly: boolean): string {
  return `7 daily, 4 weekly${keepMonthly ? ', 3 monthly' : ''}`;
}

export function copiesRetentionText(days: number, maxCopies?: number | null): string {
  const d = days === 1 ? '1 day' : `${days} days`;
  return maxCopies ? `${d}, up to ${maxCopies} copies` : `${d}, no copy limit`;
}

export function retentionText(
  policy: Pick<BackupPolicy, 'engineClass' | 'metadata' | 'retentionDays' | 'retentionMaxCopies'>,
): string {
  if (policy.engineClass === 'volume_copy') {
    return volumeRetentionText(!!policy.metadata?.['keepMonthly']);
  }
  return copiesRetentionText(policy.retentionDays, policy.retentionMaxCopies);
}

export interface ScheduleView {
  readonly text: string;
  readonly cron: string | null;
}

export function scheduleView(
  cronSchedule: string | null | undefined,
  activity?: Pick<BackupPolicyActivity, 'schedule'> | null,
): ScheduleView {
  const cron = cronSchedule || activity?.schedule.cron || null;
  if (cron) return { text: describeCron(cron), cron };
  return { text: activity?.schedule.description || 'On demand', cron: null };
}

export function nextRunIso(cron: string | null | undefined): string | null {
  return nextCronRun(cron, 'UTC')?.toISOString() ?? null;
}
