export type CronConcurrencyPolicy = 'Allow' | 'Forbid' | 'Replace';

export interface ScheduledJob {
  name: string;
  resourceName: string;
  schedule: string;
  command: string;
  timezone?: string;
  concurrencyPolicy: CronConcurrencyPolicy;
  enabled: boolean;
  activeRuns: number;
  lastScheduleTime?: string | null;
  lastSuccessfulTime?: string | null;
  createdAt?: string | null;
}

export interface CreateScheduledJobRequest {
  name: string;
  schedule: string;
  command: string;
  timezone?: string;
  concurrencyPolicy?: CronConcurrencyPolicy;
  enabled?: boolean;
}

export interface UpdateScheduledJobRequest {
  schedule?: string;
  command?: string;
  timezone?: string;
  concurrencyPolicy?: CronConcurrencyPolicy;
  enabled?: boolean;
}

export type ScheduledJobRunStatus =
  | 'Running'
  | 'Succeeded'
  | 'Failed'
  | 'Unknown';

export interface ScheduledJobRun {
  jobName: string;
  status: ScheduledJobRunStatus;
  manual: boolean;
  startTime?: string | null;
  completionTime?: string | null;
}
