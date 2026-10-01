import type { StorageBackendProvider } from './backup.models';
import type { NeedsDecisionItem } from './backup-protection.models';

export type BackupOverallStatus = 'ok' | 'info' | 'warning' | 'critical';

export interface BackupStatusAlert {
  severity: BackupOverallStatus;
  code: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  ctaLabel?: string;
  ctaPath?: string;
}

export interface BackupStatusSummary {
  clustersTotal: number;
  clustersWithBackups: number;
  clustersWithoutBackups: number;
  activePolicies: number;
  degradedPolicies: number;
  failedDestinations: number;
  healthyDestinations: number;
  totalArtifactsLast30d: number;
  failedJobsLast24h: number;
  needsDecision?: number;
}

export interface ClusterBackupState {
  clusterId: string;
  name: string;
  protected: boolean;
  needsDecision: NeedsDecisionItem[];
}

export interface BackupStatus {
  overall: BackupOverallStatus;
  summary: BackupStatusSummary;
  clusters?: ClusterBackupState[];
  lastSuccessfulBackupAt?: string;
  alerts: BackupStatusAlert[];
  cta?: { label: string; path: string };
  generatedAt: string;
}

export interface ProviderReadiness {
  provider: StorageBackendProvider;
  ready: boolean;
  needsConnection: boolean;
  reason?: string;
  message?: string;
}

export interface BackupScopeInfo {
  k8sResources: boolean;
  /** `per-application`: every application gets a policy with the engine that fits it. */
  persistentVolumes: 'per-application' | 'shared-storage-only' | false;
  method: string;
  notes: string;
}

export interface SetupOptionsEstimate {
  currency: 'EUR';
  clusterMonthlyCents: number | null;
  clusterUnavailableReason?: string;
  backupMonthlyCentsBy: {
    single: number | null;
    mirrored: number | null;
  };
  backupUnavailableReason?: string;
  backupPricingSource?: string;
  estimatedDataGb: number | null;
  estimatedDataSource?: 'last-backup' | 'pvc-requests';
  backupScope?: BackupScopeInfo;
  disclaimer: string;
}

export interface SetupOptions {
  currentProvider: string;
  primary: ProviderReadiness;
  /** Every destination this cluster may use. Never includes its own cloud. */
  eligible?: ProviderReadiness[];
  recommendedReplicas: ProviderReadiness[];
  estimate: SetupOptionsEstimate;
}

/** MVP only supports 'single'. 'mirrored' returns when a 2nd GA destination is added. */
export type QuickSetupProfile = 'single';

export const STATUS_BANNER_TONE: Record<BackupOverallStatus, string> = {
  ok: 'border-green-500/30 bg-green-500/5',
  info: 'border-border bg-card',
  warning: 'border-amber-500/30 bg-amber-500/5',
  critical: 'border-red-500/30 bg-red-500/5',
};

export const STATUS_TEXT_TONE: Record<BackupOverallStatus, string> = {
  ok: 'text-green-700 dark:text-green-400',
  info: 'text-muted-foreground',
  warning: 'text-amber-700 dark:text-amber-400',
  critical: 'text-red-700 dark:text-red-400',
};

export function centsToEur(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—';
  return `€${(cents / 100).toFixed(2)}`;
}

/**
 * English copy for alert codes — backend may return localized strings,
 * but we keep the UI consistent in English by mapping on alert.code.
 */
const ALERT_COPY: Record<
  string,
  { message: (a: BackupStatusAlert) => string; cta?: string }
> = {
  NO_CLUSTERS: {
    message: () =>
      'No clusters yet. Create your first cluster to enable backups.',
    cta: 'Create cluster',
  },
  CLUSTERS_WITHOUT_BACKUPS: {
    message: () =>
      "Some clusters don't have active backups. Configure them in 1 click.",
    cta: 'Enable backups',
  },
  DEGRADED_POLICIES: {
    message: () =>
      'One or more policies are degraded — replica destinations are failing.',
    cta: 'Check destinations',
  },
  FAILED_DESTINATIONS: {
    message: () => 'One or more destinations are unhealthy.',
    cta: 'Open destinations',
  },
  FAILED_JOBS_24H: {
    message: () => 'A backup job failed in the last 24 hours.',
    cta: 'Open jobs history',
  },
  STALE_BACKUPS: {
    message: () => 'No successful backup in the last 36 hours.',
    cta: 'Diagnose',
  },
  VOLUMES_NEED_DECISION: {
    message: (a) => a.message,
    cta: 'Decide',
  },
  ALL_GOOD: {
    message: () => 'All clusters protected.',
  },
};

export function alertMessage(alert: BackupStatusAlert): string {
  return ALERT_COPY[alert.code]?.message(alert) ?? alert.message;
}

export function alertCtaLabel(alert: BackupStatusAlert): string | undefined {
  return ALERT_COPY[alert.code]?.cta ?? alert.ctaLabel;
}

const ALERT_CTA_PATH: Record<string, string> = {
  NO_CLUSTERS: '/cluster',
  CLUSTERS_WITHOUT_BACKUPS: '/management/backup/overview',
  DEGRADED_POLICIES: '/management/backup/destinations',
  FAILED_DESTINATIONS: '/management/backup/destinations',
  FAILED_JOBS_24H: '/management/backup/jobs',
  STALE_BACKUPS: '/management/backup/jobs',
  VOLUMES_NEED_DECISION: '/management/backup/overview',
};

export function alertCtaPath(
  alert: BackupStatusAlert,
  fallback = '/management/backup',
): string {
  if (alert.resourceType === 'cluster' && alert.resourceId) {
    return `/cluster/${alert.resourceId}/overview`;
  }
  return ALERT_CTA_PATH[alert.code] ?? alert.ctaPath ?? fallback;
}

/**
 * Friendly English copy for `setup-options.primary.reason` codes.
 * Backend may return technical codes or localized strings — map by code so
 * the UI is consistent and never leaks internals like NO_PROVISIONER_REGISTERED.
 */
const PROVIDER_READINESS_COPY: Record<string, string> = {
  CONNECT_SCALEWAY_REQUIRED:
    'Flui backups run on Scaleway Object Storage. Enable Scaleway as a provider to use the service.',
  NO_PROVISIONER_REGISTERED:
    'Flui backups run on Scaleway Object Storage. Enable Scaleway as a provider to use the service.',
};

export function providerReadinessMessage(
  reason?: string,
  fallbackMessage?: string,
): string {
  if (reason && PROVIDER_READINESS_COPY[reason])
    return PROVIDER_READINESS_COPY[reason];
  return (
    fallbackMessage ||
    'Flui backups run on Scaleway Object Storage. Enable Scaleway as a provider to use the service.'
  );
}
