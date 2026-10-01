export type BackupHealthState =
  | 'ok'
  | 'running'
  | 'failed'
  | 'missed'
  | 'paused'
  | 'never_run'
  | 'on_demand';

export type BackupRunStored = 'present' | 'expired' | 'missing' | 'unknown';

export interface BackupRun {
  jobId: string;
  trigger: 'scheduled' | 'manual' | 'platform_update' | (string & {});
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationSeconds: number | null;
  sizeBytes: number | null;
  encrypted: boolean | null;
  expiresAt: string | null;
  stored: BackupRunStored;
  errorMessage: string | null;
}

export interface BackupSchedule {
  cron: string | null;
  description: string;
  timezone: 'UTC';
  nextRunAt: string | null;
  previousDueAt: string | null;
}

export interface BackupHealth {
  state: BackupHealthState;
  detail: string;
  lastSuccessAt: string | null;
}

export interface BackupPolicyActivity {
  policyId: string;
  policyName: string;
  engineClass: string;
  status: string;
  schedule: BackupSchedule;
  health: BackupHealth;
  lastRun: BackupRun | null;
  runs: BackupRun[];
}
