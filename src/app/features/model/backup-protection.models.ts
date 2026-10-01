export type DecisionOption = 'stop_during_copy' | 'leave_out';

/** A volume, or a whole application, no backup can take consistently until somebody decides. */
export interface NeedsDecisionItem {
  clusterId: string;
  applicationId: string;
  name: string;
  slug: string;
  volume?: string;
  engine?: string;
  reason: string;
  source: 'engine' | 'last_run';
  policyId?: string;
  at?: string;
  options: DecisionOption[];
}

export type ProtectedAppOutcomeKind =
  | 'protected'
  | 'already_protected'
  | 'waiting'
  | 'needs_decision'
  | 'failed'
  | 'skipped';

export interface ProtectedApp {
  applicationId: string;
  name: string | null;
  outcome: ProtectedAppOutcomeKind;
  reason?: string;
  policyId?: string;
  engine?: string;
  engineClass?: string;
  at: string;
}

export interface ClusterProtection {
  clusterId: string;
  protected: boolean;
  destinationId: string | null;
  replicaDestinationId: string | null;
  cronSchedule: string | null;
  retentionDays: number | null;
  beforeDeploy: boolean;
  since: string | null;
  lastReconciledAt: string | null;
  applications: ProtectedApp[];
  needsDecision: NeedsDecisionItem[];
}

export interface ProtectClusterRequest {
  destinationId: string;
  replicaDestinationId?: string;
  cronSchedule?: string;
  retentionDays?: number;
  beforeDeploy?: boolean;
  runFirstBackup?: boolean;
}

export interface BackupPolicyOptions {
  excludeVolumes?: string[];
  pauseDuringCopy?: boolean;
  keepMonthly?: boolean;
}

const SKIP_REASON: Record<string, string> = {
  system: 'part of Flui, covered by the platform backup',
  no_data: 'keeps no data',
};

/** What a backup engine is called on screen. */
export function protectionEngineLabel(engine?: string | null): string {
  if (!engine) return 'Protected';
  if (engine === 'kopia') return 'Volume backups';
  if (engine.endsWith('-dump')) return `Scheduled dumps (${engine.slice(0, -5)})`;
  return `Continuous backup (${engine})`;
}

export function protectedAppLine(app: ProtectedApp): string {
  switch (app.outcome) {
    case 'protected':
      return protectionEngineLabel(app.engine);
    case 'already_protected':
      return 'Already has a policy';
    case 'waiting':
      return app.reason ?? 'Waiting';
    case 'needs_decision':
      return 'Needs a decision';
    case 'failed':
      return app.reason ?? 'Failed';
    default:
      return SKIP_REASON[app.reason ?? ''] ?? app.reason ?? 'Skipped';
  }
}

export function policyEngineLabel(
  engineClass?: string | null,
  engine?: string | null,
): string {
  switch (engineClass) {
    case 'database':
      return engine?.endsWith('-dump') ? 'Database (dumps)' : 'Database (continuous)';
    case 'volume_copy':
      return 'Volume backups';
    case 'platform':
      return 'Flui itself';
    default:
      return engineClass ?? '—';
  }
}
