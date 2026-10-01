import type {
  ArtifactLocationState,
  BackupJobStatus,
  BackupPolicyStatus,
  DestinationHealthStatus,
  RestoreJobStatus,
} from './backup.models';
import type { BackupHealthState, BackupRunStored } from './backup-run.models';

export interface BadgeStyle {
  label: string;
  classes: string;
}

const TONE = {
  green:
    'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  amber:
    'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  red: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
  gray: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/30',
  violet:
    'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30',
  alarm:
    'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-600/60 font-semibold',
};

export function healthBadge(status: DestinationHealthStatus): BadgeStyle {
  switch (status) {
    case 'healthy':
      return { label: 'Healthy', classes: TONE.green };
    case 'degraded':
      return { label: 'Degraded', classes: TONE.amber };
    case 'failed':
      return { label: 'Failed', classes: TONE.red };
    default:
      return { label: 'Unknown', classes: TONE.gray };
  }
}

export function policyStatusBadge(status: BackupPolicyStatus): BadgeStyle {
  switch (status) {
    case 'active':
      return { label: 'Active', classes: TONE.green };
    case 'paused':
      return { label: 'Paused', classes: TONE.gray };
    case 'degraded':
      return { label: 'Degraded', classes: TONE.amber };
    case 'failed':
      return { label: 'Failed', classes: TONE.red };
  }
}

export function jobStatusBadge(status: BackupJobStatus): BadgeStyle {
  switch (status) {
    case 'completed':
      return { label: 'Completed', classes: TONE.green };
    case 'partially_completed':
      return { label: 'Partial', classes: TONE.amber };
    case 'failed':
      return { label: 'Failed', classes: TONE.red };
    case 'cancelled':
      return { label: 'Cancelled', classes: TONE.gray };
    case 'pending':
      return { label: 'Pending', classes: TONE.gray };
    case 'running':
    case 'uploading':
    case 'replicating':
      return {
        label: status[0].toUpperCase() + status.slice(1),
        classes: TONE.blue,
      };
  }
}

export function locationStateBadge(state: ArtifactLocationState): BadgeStyle {
  switch (state) {
    case 'verified':
      return { label: 'Verified', classes: TONE.violet };
    case 'available':
      return { label: 'Available', classes: TONE.green };
    case 'uploading':
    case 'pending':
      return {
        label: state[0].toUpperCase() + state.slice(1),
        classes: TONE.blue,
      };
    case 'failed':
      return { label: 'Failed', classes: TONE.red };
    case 'missing':
      return { label: 'Missing', classes: TONE.red };
    case 'expired':
      return { label: 'Expired', classes: TONE.gray };
  }
}

export function restoreStatusBadge(status: RestoreJobStatus): BadgeStyle {
  switch (status) {
    case 'completed':
      return { label: 'Completed', classes: TONE.green };
    case 'failed':
      return { label: 'Failed', classes: TONE.red };
    case 'cancelled':
      return { label: 'Cancelled', classes: TONE.gray };
    case 'pending':
      return { label: 'Pending', classes: TONE.gray };
    case 'previewing':
    case 'restoring':
      return {
        label: status[0].toUpperCase() + status.slice(1),
        classes: TONE.blue,
      };
  }
}

export function backupHealthBadge(state: BackupHealthState): BadgeStyle {
  switch (state) {
    case 'ok':
      return { label: 'OK', classes: TONE.green };
    case 'running':
      return { label: 'Running', classes: TONE.blue };
    case 'failed':
      return { label: 'Failed', classes: TONE.red };
    case 'missed':
      return { label: 'Missed', classes: TONE.alarm };
    case 'paused':
      return { label: 'Paused', classes: TONE.gray };
    case 'never_run':
      return { label: 'Never run', classes: TONE.gray };
    case 'on_demand':
      return { label: 'On demand', classes: TONE.gray };
    default:
      return { label: 'Unknown', classes: TONE.gray };
  }
}

export function runStatusBadge(status: string): BadgeStyle {
  return (
    jobStatusBadge(status as BackupJobStatus) ?? {
      label: status ? status[0].toUpperCase() + status.slice(1).replaceAll('_', ' ') : 'Unknown',
      classes: TONE.gray,
    }
  );
}

export function runStoredBadge(stored: BackupRunStored): BadgeStyle {
  switch (stored) {
    case 'present':
      return { label: 'Stored', classes: TONE.green };
    case 'expired':
      return { label: 'Expired', classes: TONE.gray };
    case 'missing':
      return { label: 'Missing', classes: TONE.red };
    default:
      return { label: 'Unknown', classes: TONE.gray };
  }
}
