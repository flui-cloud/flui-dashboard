import type { BackupJob } from './backup.models';

export interface BackupJobOutcome {
  status: 'completed' | 'failed';
  partial: boolean;
  detail?: string;
}

function leftOut(metadata: BackupJob['metadata']): string[] {
  const lists = [metadata?.['volumesFailed'], metadata?.['volumesNeedingDecision']];
  return lists.flatMap((list) =>
    Array.isArray(list)
      ? list
          .map((v) => (typeof v === 'string' ? v : (v as { volume?: unknown } | null)?.volume))
          .filter((v): v is string => typeof v === 'string')
      : [],
  );
}

function completedDetail(metadata: BackupJob['metadata']): string | undefined {
  if (metadata?.['baseSkipped']) {
    return 'Its changes are already being copied and the last full backup is recent, so no new one was needed.';
  }
  const copied = metadata?.['volumesCopied'];
  if (Array.isArray(copied) && copied.length === 0) {
    return 'Nothing to copy: every volume of this application is left out by the policy.';
  }
  return undefined;
}

/** How a finished run ended, in the words the progress dialog shows; null while it runs. */
export function backupJobOutcome(job: Pick<BackupJob, 'status' | 'errorMessage' | 'metadata'>): BackupJobOutcome | null {
  switch (job.status) {
    case 'completed':
      return {
        status: 'completed',
        partial: false,
        detail: completedDetail(job.metadata),
      };
    case 'partially_completed': {
      const volumes = leftOut(job.metadata);
      return {
        status: 'completed',
        partial: true,
        detail: job.errorMessage ?? (volumes.length ? `Left out: ${volumes.join(', ')}.` : undefined),
      };
    }
    case 'failed':
      return { status: 'failed', partial: false, detail: job.errorMessage ?? 'The backup failed.' };
    case 'cancelled':
      return { status: 'failed', partial: false, detail: job.errorMessage ?? 'The backup was cancelled.' };
    default:
      return null;
  }
}
