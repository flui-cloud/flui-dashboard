import { StatusTone } from '../../../../ui/primitives/status';
import { BackupHealthState, BackupRunStored } from '../../../model/backup-run.models';
import { DestinationHealthStatus } from '../../../model/backup.models';

export type BackupBadgeKind = 'health' | 'policy' | 'job' | 'location' | 'restore';

const TONES: Record<BackupBadgeKind, Record<string, StatusTone>> = {
  health: { healthy: 'success', degraded: 'warning', failed: 'error' },
  policy: { active: 'success', paused: 'neutral', degraded: 'warning', failed: 'error' },
  job: {
    completed: 'success',
    partially_completed: 'warning',
    failed: 'error',
    cancelled: 'neutral',
    pending: 'neutral',
    running: 'progress',
    uploading: 'progress',
    replicating: 'progress',
  },
  location: {
    verified: 'success',
    available: 'success',
    uploading: 'progress',
    pending: 'progress',
    failed: 'error',
    missing: 'error',
    expired: 'neutral',
  },
  restore: {
    completed: 'success',
    failed: 'error',
    cancelled: 'neutral',
    pending: 'neutral',
    previewing: 'progress',
    restoring: 'progress',
  },
};

const HEALTH_TONES: Record<BackupHealthState, StatusTone> = {
  ok: 'success',
  running: 'progress',
  failed: 'error',
  missed: 'warning',
  paused: 'neutral',
  never_run: 'neutral',
  on_demand: 'neutral',
};

const STORED_TONES: Record<BackupRunStored, StatusTone> = {
  present: 'success',
  expired: 'neutral',
  missing: 'error',
  unknown: 'neutral',
};

const REACHABILITY: Record<DestinationHealthStatus, { tone: StatusTone; label: string }> = {
  healthy: { tone: 'success', label: 'Reachable' },
  degraded: { tone: 'warning', label: 'Degraded' },
  failed: { tone: 'error', label: 'Unreachable' },
  unknown: { tone: 'neutral', label: 'Not checked' },
};

export function backupBadgeTone(kind: BackupBadgeKind, value: string): StatusTone {
  return TONES[kind][value] ?? 'neutral';
}

export function backupHealthTone(state: BackupHealthState | null | undefined): StatusTone {
  return (state && HEALTH_TONES[state]) || 'neutral';
}

export function runStoredTone(stored: BackupRunStored): StatusTone {
  return STORED_TONES[stored] ?? 'neutral';
}

export function destinationReachability(status: string): {
  tone: StatusTone;
  label: string;
} {
  return REACHABILITY[status as DestinationHealthStatus] ?? REACHABILITY.unknown;
}
