import type { BackupJob } from '../../../model/backup.models';

export function jobDurationSeconds(
  job: Pick<BackupJob, 'startedAt' | 'finishedAt'>,
): number | null {
  if (!job.startedAt || !job.finishedAt) return null;
  const ms = new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms / 1000 : null;
}
