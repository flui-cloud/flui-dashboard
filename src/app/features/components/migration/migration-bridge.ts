import type { MigrationBridge, MigrationRow } from '../../service/migration.service';

const ABORTABLE = new Set([
  'pending',
  'provisioning',
  'db_replicating',
  'app_staging',
  'ready',
  'replicating',
  'synced',
  'failed',
]);

function bridgeOf(row: MigrationRow): MigrationBridge | null {
  return row.type === 'db' ? null : (row.bridge ?? null);
}

export function canDestroySource(row: MigrationRow): boolean {
  if (row.type === 'db') return false;
  if (row.type === 'app' && row.sourceDestroyedAt) return false;
  const s = row.status.toLowerCase();
  if (row.type === 'full' && s === 'completed') {
    return (row.nextSteps ?? []).some((step) => step.key === 'destroy-source');
  }
  return s === 'bridging' || s === 'completed';
}

/** The API refuses to abort once the old cluster forwards to the new one. */
export function bridgeBlocksAbort(row: MigrationRow): boolean {
  return row.type === 'app' && row.bridge?.state === 'active';
}

/** Computed by the API: a cutover that lost its job, or failed after the bridge opened. */
export function canResumeCutover(row: MigrationRow): boolean {
  return (row.type === 'app' || row.type === 'full') && !!row.canResumeCutover;
}

export function canCutover(row: MigrationRow): boolean {
  const s = row.status.toLowerCase();
  if (row.type === 'db') return s === 'synced';
  if (row.type === 'full') return s === 'ready' || canResumeCutover(row);
  return s === 'ready' || canResumeCutover(row);
}

export function canAbort(row: MigrationRow): boolean {
  return ABORTABLE.has(row.status.toLowerCase()) && !bridgeBlocksAbort(row);
}

export function cutoverLabel(row: MigrationRow): string {
  const s = row.status.toLowerCase();
  return s === 'ready' || s === 'synced' ? 'Cutover' : 'Resume cutover';
}

/** One line under the status while the old cluster still forwards. */
export function bridgeLine(row: MigrationRow): string | null {
  const bridge = bridgeOf(row);
  return bridge?.state === 'active' ? bridge.summary : null;
}

export function destroyConfirmation(row: MigrationRow): {
  message: string;
  confirmText: string;
  closeBridge: boolean;
} {
  const bridge = bridgeOf(row);
  if (bridge?.state === 'active' && !bridge.readyToClose) {
    return {
      message: `${bridge.summary} Destroying now closes the bridge: clients that still resolve the old cluster lose the application. This is irreversible.`,
      confirmText: 'Close bridge and destroy',
      closeBridge: true,
    };
  }
  return {
    message:
      bridge?.state === 'active'
        ? 'Close the bridge and destroy the source workload? This is irreversible.'
        : 'Destroy the drained source workload? This is irreversible.',
    confirmText: 'Destroy',
    closeBridge: false,
  };
}

export type PendingMigrationAction = { kind: 'abort' | 'destroy'; row: MigrationRow };

/** The confirmation dialog's copy for the action waiting on the operator. */
export function pendingConfirmation(action: PendingMigrationAction | null): {
  title: string;
  message: string;
  confirmText: string;
} {
  if (action?.kind === 'destroy') {
    const { message, confirmText } = destroyConfirmation(action.row);
    return { title: 'Destroy source', message, confirmText };
  }
  return {
    title: 'Abort migration',
    message: 'Abort this migration? The destination is torn down; the source is untouched.',
    confirmText: 'Abort',
  };
}
