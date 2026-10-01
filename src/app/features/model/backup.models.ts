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

export type DestinationHealthStatus =
  'unknown' | 'healthy' | 'degraded' | 'failed';
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
export type BackupEngineClass = 'database' | 'platform' | 'volume_copy';

export type RestoreJobStatus =
  'pending' | 'previewing' | 'restoring' | 'completed' | 'failed' | 'cancelled';

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
  engineClass?: BackupEngineClass;
  /** The database engine behind a database policy; `…-dump` means scheduled dumps. */
  engine?: string | null;
  cronSchedule?: string | null;
  retentionDays: number;
  retentionMaxCopies?: number | null;
  enabled: boolean;
  status: BackupPolicyStatus;
  metadata?: Record<string, unknown> | null;
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
  status: BackupJobStatus;
  startedAt?: string;
  finishedAt?: string;
  infrastructureOperationId?: string;
  errorMessage?: string;
  /** Per volume, seconds the application was stopped for its copy. */
  metadata?: { stoppedSeconds?: Record<string, number> } & Record<
    string,
    unknown
  >;
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
  engineClass?: BackupEngineClass;
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
  status: RestoreJobStatus;
  previewResult?: Record<string, unknown>;
  infrastructureOperationId?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface RestorePreviewResult {
  manifestSummary?: Record<string, unknown>;
  sizeBytes?: string;
  itemCount?: number;
  sourceDestinationId: string;
  objectsAtPrefix?: number;
  bytesAtPrefix?: number;
}

// ===== Destination catalogue (served by the API) =====

export interface ObjectStorageRegionOption {
  value: string;
  label: string;
  endpoint: string;
}

/** Mirrors the API's ObjectStoragePresetDto; fetch via BackupService.loadPresets(). */
export interface ObjectStoragePreset {
  provider: StorageBackendProvider;
  label: string;
  description: string;
  badge?: string;
  defaultRegion?: string;
  defaultEndpoint?: string;
  forcePathStyle: boolean;
  usableForEtcdL1: boolean;
  provisioning: 'full_auto' | 'semi_auto' | 'none';
  regions?: ObjectStorageRegionOption[];
}

// ===== Helpers =====

export function inferProfile(
  destinations: { role: DestinationRole }[],
): BackupPolicyProfile {
  if (!destinations.length) return 'custom';
  const replicas = destinations.filter((d) => d.role === 'replica').length;
  if (replicas === 0) return 'single';
  if (replicas === 1 && destinations.length === 2) return 'mirrored';
  return 'custom';
}

export function validatePolicyDestinations(
  destinations: PolicyDestinationInputDto[],
): string | null {
  if (!destinations.length) return 'At least one destination is required';
  const primaries = destinations.filter((d) => d.role === 'primary');
  if (primaries.length === 0) return 'A primary destination is required';
  if (primaries.length > 1) return 'Only one primary destination is allowed';
  const ids = new Set(destinations.map((d) => d.destinationId));
  if (ids.size !== destinations.length)
    return 'Duplicate destinations are not allowed';
  return null;
}

export function costEstimateMonthlyEur(
  usageBytes: number | string | null | undefined,
  costPerGbMonthCents: number | null | undefined,
): number | null {
  if (usageBytes == null || costPerGbMonthCents == null) return null;
  const bytes =
    typeof usageBytes === 'string' ? Number(usageBytes) : usageBytes;
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

/**
 * Presets come from the API, so callers pass what they have loaded. Falls back
 * to the raw provider id rather than inventing a name.
 */
export function providerLabel(
  provider: StorageBackendProvider,
  presets: ObjectStoragePreset[] = [],
): string {
  return presets.find((p) => p.provider === provider)?.label ?? provider;
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
  /** A backup run that finished but left something out. */
  partial?: boolean;
  /** What the finished run said about itself. */
  detail?: string;
  startedAt: number;
  endedAt?: number;
}
