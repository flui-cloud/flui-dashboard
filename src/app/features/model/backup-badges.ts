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
}

export function healthBadge(status: DestinationHealthStatus): BadgeStyle {
  switch (status) {
    case 'healthy':
      return { label: 'Healthy' };
    case 'degraded':
      return { label: 'Degraded' };
    case 'failed':
      return { label: 'Failed' };
    default:
      return { label: 'Unknown' };
  }
}

export function policyStatusBadge(status: BackupPolicyStatus): BadgeStyle {
  switch (status) {
    case 'active':
      return { label: 'Active' };
    case 'paused':
      return { label: 'Paused' };
    case 'degraded':
      return { label: 'Degraded' };
    case 'failed':
      return { label: 'Failed' };
  }
}

export function jobStatusBadge(status: BackupJobStatus): BadgeStyle {
  switch (status) {
    case 'completed':
      return { label: 'Completed' };
    case 'partially_completed':
      return { label: 'Partial' };
    case 'failed':
      return { label: 'Failed' };
    case 'cancelled':
      return { label: 'Cancelled' };
    case 'pending':
      return { label: 'Pending' };
    case 'running':
    case 'uploading':
    case 'replicating':
      return { label: status[0].toUpperCase() + status.slice(1) };
  }
}

export function locationStateBadge(state: ArtifactLocationState): BadgeStyle {
  switch (state) {
    case 'verified':
      return { label: 'Verified' };
    case 'available':
      return { label: 'Available' };
    case 'uploading':
    case 'pending':
      return { label: state[0].toUpperCase() + state.slice(1) };
    case 'failed':
      return { label: 'Failed' };
    case 'missing':
      return { label: 'Missing' };
    case 'expired':
      return { label: 'Expired' };
  }
}

export function restoreStatusBadge(status: RestoreJobStatus): BadgeStyle {
  switch (status) {
    case 'completed':
      return { label: 'Completed' };
    case 'failed':
      return { label: 'Failed' };
    case 'cancelled':
      return { label: 'Cancelled' };
    case 'pending':
      return { label: 'Pending' };
    case 'previewing':
    case 'restoring':
      return { label: status[0].toUpperCase() + status.slice(1) };
  }
}

export function backupHealthBadge(state: BackupHealthState): BadgeStyle {
  switch (state) {
    case 'ok':
      return { label: 'OK' };
    case 'running':
      return { label: 'Running' };
    case 'failed':
      return { label: 'Failed' };
    case 'missed':
      return { label: 'Missed' };
    case 'paused':
      return { label: 'Paused' };
    case 'never_run':
      return { label: 'Never run' };
    case 'on_demand':
      return { label: 'On demand' };
    default:
      return { label: 'Unknown' };
  }
}

export function runStatusBadge(status: string): BadgeStyle {
  return (
    jobStatusBadge(status as BackupJobStatus) ?? {
      label: status ? status[0].toUpperCase() + status.slice(1).replaceAll('_', ' ') : 'Unknown',
    }
  );
}

export function runStoredBadge(stored: BackupRunStored): BadgeStyle {
  switch (stored) {
    case 'present':
      return { label: 'Stored' };
    case 'expired':
      return { label: 'Expired' };
    case 'missing':
      return { label: 'Missing' };
    default:
      return { label: 'Unknown' };
  }
}
