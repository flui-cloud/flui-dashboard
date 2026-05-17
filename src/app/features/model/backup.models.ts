/**
 * Backup System — Frontend domain types & helpers.
 *
 * Mirrors enums from backend (see docs/backups-frontend-integration.md).
 * Generated DTOs in core/api/model already expose enum constants — this file
 * adds frontend-only entities (response shapes), presets and UI helpers.
 */

import { CreateBackupDestinationDto } from '../../core/api/model/createBackupDestinationDto';
import { CreateBackupPolicyDto } from '../../core/api/model/createBackupPolicyDto';
import { CreateRestoreJobDto } from '../../core/api/model/createRestoreJobDto';
import { PolicyDestinationInputDto } from '../../core/api/model/policyDestinationInputDto';

// ===== Enum re-exports (string literal unions) =====

export type StorageBackendProvider = CreateBackupDestinationDto.ProviderEnum;
export type EncryptionMode = CreateBackupDestinationDto.EncryptionModeEnum;
export type BackupScope = CreateBackupPolicyDto.ScopeEnum;
export type BackupPolicyProfile = CreateBackupPolicyDto.ProfileEnum;
export type DestinationRole = PolicyDestinationInputDto.RoleEnum;
export type RestoreTargetKind = CreateRestoreJobDto.TargetKindEnum;
export type RestoreStrategy = CreateRestoreJobDto.StrategyEnum;

export type DestinationHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'failed';
export type BackupPolicyStatus = 'active' | 'paused' | 'degraded' | 'failed';
export type ReplicationStatus = 'ok' | 'degraded' | 'failed' | 'never_run';
export type BackupJobStatus =
  | 'pending'
  | 'running'
  | 'uploading'
  | 'replicating'
  | 'partially_completed'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type BackupJobTriggerType = 'scheduled' | 'on_demand' | 'pre_deploy';
export type ArtifactLocationState =
  | 'pending'
  | 'uploading'
  | 'available'
  | 'verified'
  | 'missing'
  | 'expired'
  | 'failed';
export type RestoreJobStatus =
  | 'pending'
  | 'previewing'
  | 'restoring'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ===== Response entity shapes (server returns these) =====

export interface BackupDestination {
  id: string;
  userId: string;
  name: string;
  provider: StorageBackendProvider;
  endpoint: string;
  region: string;
  bucket: string;
  pathPrefix?: string;
  encryptionMode: EncryptionMode;
  useSse: boolean;
  forcePathStyle: boolean;
  usableForEtcdL1: boolean;
  healthStatus: DestinationHealthStatus;
  lastHealthCheckAt?: string | null;
  lastHealthError?: string | null;
  usageBytes?: string | null;
  usageRefreshedAt?: string | null;
  costPerGbMonthCents?: number | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPolicyDestination {
  id: string;
  destinationId: string;
  destination?: BackupDestination;
  role: DestinationRole;
  priority: number;
  retentionDaysOverride?: number | null;
  retentionMaxCopiesOverride?: number | null;
  enabled: boolean;
  lastReplicationStatus: ReplicationStatus;
}

export interface BackupPolicy {
  id: string;
  userId: string;
  clusterId: string;
  name: string;
  scope: BackupScope;
  scopeSelector?: {
    namespaces?: string[];
    applicationIds?: string[];
    labelSelector?: string;
  };
  includePvcs: boolean;
  includeEtcdL1: boolean;
  cronSchedule?: string | null;
  retentionDays: number;
  retentionMaxCopies?: number | null;
  enabled: boolean;
  status: BackupPolicyStatus;
  profile: BackupPolicyProfile;
  destinations: BackupPolicyDestination[];
  createdAt: string;
  updatedAt: string;
}

export interface BackupJob {
  id: string;
  policyId?: string;
  clusterId: string;
  userId: string;
  triggerType: BackupJobTriggerType;
  veleroBackupName?: string;
  status: BackupJobStatus;
  startedAt?: string;
  finishedAt?: string;
  infrastructureOperationId?: string;
  errorMessage?: string;
  artifact?: BackupArtifact;
  createdAt: string;
  updatedAt: string;
}

export interface BackupArtifactLocation {
  id: string;
  artifactId: string;
  destinationId: string;
  destination?: BackupDestination;
  role: DestinationRole;
  state: ArtifactLocationState;
  objectKeyPrefix: string;
  bytesStored?: string | null;
  verifiedAt?: string | null;
  lastError?: string | null;
}

export interface BackupArtifact {
  id: string;
  backupJobId: string;
  clusterId: string;
  veleroBackupName: string;
  sizeBytes?: string | null;
  itemCount?: number | null;
  expiresAt?: string | null;
  manifestSummary?: Record<string, unknown>;
  encryptionMode: EncryptionMode;
  locations: BackupArtifactLocation[];
  createdAt: string;
}

export interface RestoreJob {
  id: string;
  userId: string;
  artifactId: string;
  sourceDestinationId: string;
  targetClusterId: string;
  targetKind: RestoreTargetKind;
  targetSelector?: {
    namespaces?: string[];
    applicationId?: string;
    namespaceMapping?: Record<string, string>;
    labelSelector?: string;
  };
  strategy?: RestoreStrategy;
  veleroRestoreName?: string;
  status: RestoreJobStatus;
  previewResult?: Record<string, unknown>;
  infrastructureOperationId?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface RestorePreviewResult {
  veleroBackupName: string;
  manifestSummary?: Record<string, unknown>;
  sizeBytes?: string;
  itemCount?: number;
  sourceDestinationId: string;
  objectsAtPrefix?: number;
  bytesAtPrefix?: number;
}

// ===== Provider presets (UX prefill) =====

export interface ProviderRegionOption {
  value: string;
  label: string;
  endpoint: string;
}

export interface ProviderPreset {
  id: StorageBackendProvider;
  label: string;
  endpoint: string;
  defaultRegion: string;
  forcePathStyle: boolean;
  usableForEtcdL1: boolean;
  description: string;
  badge?: string;
  regions?: ProviderRegionOption[];
}

/**
 * EU-first card lineup. AWS / Wasabi / Backblaze / Cloudflare R2 / IDrive E2
 * are still supported via the Generic S3 card — they remain valid backend
 * enum values, just not promoted in the UI.
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'scaleway_object_storage',
    label: 'Scaleway Object Storage',
    endpoint: 'https://s3.fr-par.scw.cloud',
    defaultRegion: 'fr-par',
    forcePathStyle: false,
    usableForEtcdL1: true,
    badge: 'Recommended primary',
    description: 'EU sovereignty (France / Netherlands / Poland). Default Object Storage for app-level backups.',
    regions: [
      { value: 'fr-par', label: 'Paris (fr-par)', endpoint: 'https://s3.fr-par.scw.cloud' },
      { value: 'nl-ams', label: 'Amsterdam (nl-ams)', endpoint: 'https://s3.nl-ams.scw.cloud' },
      { value: 'pl-waw', label: 'Warsaw (pl-waw)', endpoint: 'https://s3.pl-waw.scw.cloud' },
    ],
  },
  {
    id: 'hetzner_object_storage',
    label: 'Hetzner Object Storage',
    endpoint: 'https://nbg1.your-objectstorage.com',
    defaultRegion: 'nbg1',
    forcePathStyle: true,
    usableForEtcdL1: true,
    badge: 'Advanced only',
    description: 'EU sovereignty (Germany / Finland). Available via advanced setup — not offered in 1-click flow during MVP (flat-fee billing model).',
    regions: [
      { value: 'nbg1', label: 'Nuremberg (nbg1)', endpoint: 'https://nbg1.your-objectstorage.com' },
      { value: 'fsn1', label: 'Falkenstein (fsn1)', endpoint: 'https://fsn1.your-objectstorage.com' },
      { value: 'hel1', label: 'Helsinki (hel1)', endpoint: 'https://hel1.your-objectstorage.com' },
    ],
  },
  {
    id: 'minio',
    label: 'MinIO (self-hosted)',
    endpoint: '',
    defaultRegion: 'us-east-1',
    forcePathStyle: true,
    usableForEtcdL1: true,
    badge: 'Full sovereignty',
    description: 'Your own infrastructure. Total data control, on your terms.',
  },
  {
    id: 'generic_s3',
    label: 'Generic S3',
    endpoint: '',
    defaultRegion: '',
    forcePathStyle: true,
    usableForEtcdL1: false,
    description: 'Any S3-compatible endpoint — AWS, Wasabi, Backblaze B2, Cloudflare R2, IDrive E2, MinIO server, …',
  },
];

export function getProviderPreset(id: StorageBackendProvider): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}

// ===== Helpers =====

export function inferProfile(
  destinations: { role: DestinationRole }[]
): BackupPolicyProfile {
  if (!destinations.length) return 'custom';
  const replicas = destinations.filter((d) => d.role === 'replica').length;
  if (replicas === 0) return 'single';
  if (replicas === 1 && destinations.length === 2) return 'mirrored';
  return 'custom';
}

export function validatePolicyDestinations(
  destinations: PolicyDestinationInputDto[]
): string | null {
  if (!destinations.length) return 'At least one destination is required';
  const primaries = destinations.filter((d) => d.role === 'primary');
  if (primaries.length === 0) return 'A primary destination is required';
  if (primaries.length > 1) return 'Only one primary destination is allowed';
  const ids = new Set(destinations.map((d) => d.destinationId));
  if (ids.size !== destinations.length) return 'Duplicate destinations are not allowed';
  return null;
}

export function costEstimateMonthlyEur(
  usageBytes: number | string | null | undefined,
  costPerGbMonthCents: number | null | undefined
): number | null {
  if (usageBytes == null || costPerGbMonthCents == null) return null;
  const bytes = typeof usageBytes === 'string' ? Number(usageBytes) : usageBytes;
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  const gb = bytes / 1024 / 1024 / 1024;
  return (gb * costPerGbMonthCents) / 100;
}

export function formatBytes(bytes: number | string | null | undefined): string {
  if (bytes == null) return '—';
  const n = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (!Number.isFinite(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== UI badge styling =====

export interface BadgeStyle {
  label: string;
  classes: string;
}

const TONE = {
  green: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  red: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
  gray: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/30',
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30',
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
      return { label: status[0].toUpperCase() + status.slice(1), classes: TONE.blue };
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
      return { label: state[0].toUpperCase() + state.slice(1), classes: TONE.blue };
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
      return { label: status[0].toUpperCase() + status.slice(1), classes: TONE.blue };
  }
}

export function providerLabel(provider: StorageBackendProvider): string {
  return getProviderPreset(provider)?.label ?? provider;
}

export interface ActiveOperation {
  operationId: string;
  jobId?: string;
  resourceType?: 'backup_job' | 'restore_job' | 'quick_setup';
  percentage: number;
  currentStep: string;
  totalSteps: number;
  message: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  startedAt: number;
  endedAt?: number;
}

// ===== Phase 2: status / quick-setup / billing =====

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
}

export interface BackupStatus {
  overall: BackupOverallStatus;
  summary: BackupStatusSummary;
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
  persistentVolumes: boolean;
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
  estimatedDataGb: number | null;
  estimatedDataSource?: 'last-backup' | 'pvc-requests';
  backupScope?: BackupScopeInfo;
  disclaimer: string;
}

export interface SetupOptions {
  currentProvider: string;
  primary: ProviderReadiness;
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
const ALERT_COPY: Record<string, { message: (a: BackupStatusAlert) => string; cta?: string }> = {
  NO_CLUSTERS: {
    message: () => 'No clusters yet. Create your first cluster to enable backups.',
    cta: 'Create cluster',
  },
  CLUSTERS_WITHOUT_BACKUPS: {
    message: () => "Some clusters don't have active backups. Configure them in 1 click.",
    cta: 'Enable backups',
  },
  DEGRADED_POLICIES: {
    message: () => 'One or more policies are degraded — replica destinations are failing.',
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
};

export function alertCtaPath(alert: BackupStatusAlert, fallback = '/management/backup'): string {
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

export function providerReadinessMessage(reason?: string, fallbackMessage?: string): string {
  if (reason && PROVIDER_READINESS_COPY[reason]) return PROVIDER_READINESS_COPY[reason];
  return (
    fallbackMessage ||
    'Flui backups run on Scaleway Object Storage. Enable Scaleway as a provider to use the service.'
  );
}
