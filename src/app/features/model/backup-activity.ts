import type {
  BackupHealthState,
  BackupPolicyActivity,
  BackupRun,
} from './backup-run.models';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function parse(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export function formatRelativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  const t = parse(iso);
  if (t == null) return '—';
  const diff = t - now;
  const abs = Math.abs(diff);
  if (abs < MINUTE) return diff >= 0 ? 'in under a minute' : 'just now';
  let amount: string;
  if (abs < HOUR) amount = `${Math.round(abs / MINUTE)} min`;
  else if (abs < DAY) amount = `${Math.round(abs / HOUR)} h`;
  else {
    const days = Math.round(abs / DAY);
    amount = days === 1 ? '1 day' : `${days} days`;
  }
  return diff >= 0 ? `in ${amount}` : `${amount} ago`;
}

export function formatLocalDateTime(iso: string | null | undefined): string {
  const t = parse(iso);
  if (t == null) return '—';
  return new Date(t).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatUtcDateTime(iso: string | null | undefined): string {
  const t = parse(iso);
  if (t == null) return '';
  return `${new Date(t).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

export function runTriggerLabel(trigger: string | null | undefined): string {
  switch (trigger) {
    case 'scheduled':
      return 'Scheduled';
    case 'manual':
    case 'on_demand':
      return 'Manual';
    case 'platform_update':
      return 'Before update';
    case 'pre_deploy':
      return 'Before deploy';
    case null:
    case undefined:
    case '':
      return '—';
    default:
      return trigger[0].toUpperCase() + trigger.slice(1).replaceAll('_', ' ');
  }
}

export interface EncryptionMarker {
  icon: 'lucideLock' | 'lucideLockOpen' | null;
  label: string;
}

export function runEncryptionMarker(encrypted: boolean | null | undefined): EncryptionMarker {
  if (encrypted === true) return { icon: 'lucideLock', label: 'Encrypted' };
  if (encrypted === false) return { icon: 'lucideLockOpen', label: 'Not encrypted' };
  return { icon: null, label: 'Encryption unknown' };
}

export function runTime(run: Pick<BackupRun, 'startedAt' | 'finishedAt'>): string | null {
  return run.startedAt ?? run.finishedAt;
}

export function healthNeedsAttention(state: BackupHealthState | null | undefined): boolean {
  return state === 'missed' || state === 'failed';
}

export function activityByPolicyId(list: BackupPolicyActivity[]): Map<string, BackupPolicyActivity> {
  return new Map(list.map((a) => [a.policyId, a]));
}

export function sortByAttention<T>(rows: T[], stateOf: (row: T) => BackupHealthState | null | undefined): T[] {
  return rows
    .map((row, index) => ({ row, index, urgent: healthNeedsAttention(stateOf(row)) }))
    .sort((a, b) => {
      if (a.urgent === b.urgent) return a.index - b.index;
      return a.urgent ? -1 : 1;
    })
    .map((entry) => entry.row);
}

export function sortRunsNewestFirst(runs: BackupRun[]): BackupRun[] {
  return [...runs].sort((a, b) => (parse(runTime(b)) ?? 0) - (parse(runTime(a)) ?? 0));
}
