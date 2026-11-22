import { StatusTone } from '../../../ui/primitives/status';
import {
  PlatformComponentUpdate,
  PlatformUpdateComponentProgress,
  PlatformUpdateOperation,
  PlatformUpgradePhase,
} from '../../service/platform-update.service';

const STEP_TONES: Record<string, StatusTone> = {
  done: 'success',
  running: 'progress',
  upgrading: 'progress',
  failed: 'error',
  skipped: 'neutral',
  pending: 'neutral',
};

const STEP_LABELS: Record<string, string> = {
  done: 'Done',
  running: 'Running',
  upgrading: 'Upgrading',
  failed: 'Failed',
  skipped: 'Skipped',
  pending: 'Waiting',
};

export function stepTone(status: string): StatusTone {
  return STEP_TONES[status] ?? 'neutral';
}

export function stepLabel(status: string): string {
  return STEP_LABELS[status] ?? status;
}

export function isRunningOperation(operation: PlatformUpdateOperation): boolean {
  return ['PENDING', 'IN_PROGRESS'].includes(operation.status);
}

export function isFailedOperation(operation: PlatformUpdateOperation): boolean {
  return ['FAILED', 'CANCELLED'].includes(operation.status);
}

export function operationStatus(operation: PlatformUpdateOperation): {
  tone: StatusTone;
  label: string;
} {
  switch (operation.status) {
    case 'COMPLETED':
      return { tone: 'success', label: 'Completed' };
    case 'FAILED':
      return { tone: 'error', label: 'Failed' };
    case 'CANCELLED':
      return { tone: 'error', label: 'Cancelled' };
    default:
      return { tone: 'progress', label: 'Updating' };
  }
}

export function phaseNote(phase: PlatformUpgradePhase, withoutBackup: boolean): string | null {
  switch (phase.status) {
    case 'skipped':
      return phase.key === 'backup' && withoutBackup
        ? 'Skipped by acknowledgement: without a backup, a database migration cannot be undone.'
        : 'Nothing to do';
    case 'done':
      return phase.key === 'backup' && phase.backupJobId ? `Backup ${phase.backupJobId}` : null;
    case 'failed':
      return phase.error ?? 'Stopped';
    default:
      return null;
  }
}

export function componentDetail(component: PlatformUpdateComponentProgress): string {
  switch (component.status) {
    case 'skipped':
      return `Already on ${component.targetVersion || 'its release version'}, nothing to roll out`;
    case 'running':
      return component.key === 'fluiApi'
        ? 'Rolling out and applying database migrations'
        : 'Rolling out';
    case 'done':
      return 'Rolled out';
    case 'failed':
      return 'Did not become ready';
    default:
      return 'Waiting';
  }
}

export function operationSubline(operation: PlatformUpdateOperation): string {
  if (operation.awaitingSelfRestart) {
    return 'Waiting for the API to come back on the new version.';
  }
  if (isFailedOperation(operation)) {
    if (operation.schema === 2) {
      return operation.guidance && !operation.errorMessage?.includes(operation.guidance)
        ? operation.guidance
        : 'Stopped where shown below. Nothing was rolled back.';
    }
    return 'Components already rolled out were left on their new versions.';
  }
  if (!isRunningOperation(operation) && operation.completedAt) {
    return `Completed ${new Date(operation.completedAt).toLocaleString()}`;
  }
  return operation.migrations > 0
    ? `${plural(operation.migrations, 'database migration')} run with this release.`
    : 'No database migrations in this release.';
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function clockTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleTimeString() : '—';
}

export function elapsed(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) return '—';
  const seconds = Math.round((Date.parse(to) - Date.parse(from)) / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} m ${String(seconds % 60).padStart(2, '0')} s`;
}

export function historyDetail(operation: PlatformUpdateOperation): string {
  if (operation.errorMessage) return operation.errorMessage;
  const moved = operation.components.filter((c) => c.status === 'done').length;
  const migrations = operation.migrations
    ? plural(operation.migrations, 'migration')
    : 'no migrations';
  return `${plural(moved, 'component')} · ${migrations}`;
}

export function historyWhen(operation: PlatformUpdateOperation): string {
  const at = operation.completedAt ?? operation.startedAt;
  return at ? new Date(at).toLocaleDateString() : '—';
}

/** "Unchanged" is a comparison; without a release there was none to make. */
export function changeLabel(
  component: PlatformComponentUpdate,
  availableVersion: string | null,
): string {
  if (!component.installed) return 'Absent';
  if (!availableVersion) return 'Not compared';
  return component.changed ? 'Will update' : 'Unchanged';
}

export function checkedAgo(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}
