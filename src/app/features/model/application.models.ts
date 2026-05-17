// ===== RE-EXPORT GENERATED DTOs =====
export { ApplicationResponseDto } from '../../core/api/model/applicationResponseDto';
export { AppResourceResponseDto } from '../../core/api/model/appResourceResponseDto';
export { AppRevisionResponseDto } from '../../core/api/model/appRevisionResponseDto';
export { CreateApplicationDto } from '../../core/api/model/createApplicationDto';
export type { UpdateApplicationDto } from '../../core/api/model/updateApplicationDto';
export type { DeployApplicationDto } from '../../core/api/model/deployApplicationDto';
export type { RollbackApplicationDto } from '../../core/api/model/rollbackApplicationDto';
export type { EnvVarDto } from '../../core/api/model/envVarDto';
export type { ApplicationResourcesDto } from '../../core/api/model/applicationResourcesDto';
export type { ApplicationScalingDto } from '../../core/api/model/applicationScalingDto';
export type { ResourceLimitDto } from '../../core/api/model/resourceLimitDto';

// ===== RUNTIME DTOs =====
export type { AppRuntimeResponseDto } from '../../core/api/model/appRuntimeResponseDto';
export type { ReplicaStatusDto } from '../../core/api/model/replicaStatusDto';
export type { ContainerRuntimeDetailDto } from '../../core/api/model/containerRuntimeDetailDto';
export type { ContainerResourcesDto } from '../../core/api/model/containerResourcesDto';
export type { UpdateResourcesDto } from '../../core/api/model/updateResourcesDto';
export type { UpdateReplicasDto } from '../../core/api/model/updateReplicasDto';
export type { ContainerResourceSpecDto } from '../../core/api/model/containerResourceSpecDto';

// ===== METRICS DTOs =====
export type { AppMetricsDto } from '../../core/api/model/appMetricsDto';
export type { AppCpuMetricsDto } from '../../core/api/model/appCpuMetricsDto';
export type { AppMemoryMetricsDto } from '../../core/api/model/appMemoryMetricsDto';
export type { AppNetworkMetricsDto } from '../../core/api/model/appNetworkMetricsDto';
export type { AppStatusMetricsDto } from '../../core/api/model/appStatusMetricsDto';
export type { AppPodPhaseDto } from '../../core/api/model/appPodPhaseDto';
export type { AppMetricsDataPointDto } from '../../core/api/model/appMetricsDataPointDto';
export type { SingleAppMetricsResponseDto } from '../../core/api/model/singleAppMetricsResponseDto';
export type { SingleAppMetricsHistoryResponseDto } from '../../core/api/model/singleAppMetricsHistoryResponseDto';

import { ApplicationResponseDto } from '../../core/api/model/applicationResponseDto';

// ===== TYPE ALIASES =====
export type Application = ApplicationResponseDto;
export type ApplicationCategory = ApplicationResponseDto.CategoryEnum;
export type ApplicationKind = ApplicationResponseDto.KindEnum;
export type ApplicationSourceType = ApplicationResponseDto.SourceTypeEnum;
export type ApplicationStatus = ApplicationResponseDto.StatusEnum;
export type ReconciliationStatus = ApplicationResponseDto.ReconciliationStatusEnum;

export const ApplicationCategoryEnum = ApplicationResponseDto.CategoryEnum;
export const ApplicationKindEnum = ApplicationResponseDto.KindEnum;
export const ApplicationSourceTypeEnum = ApplicationResponseDto.SourceTypeEnum;
export const ApplicationStatusEnum = ApplicationResponseDto.StatusEnum;
export const ReconciliationStatusEnum = ApplicationResponseDto.ReconciliationStatusEnum;
export const LastBuildStatusEnum = ApplicationResponseDto.LastBuildStatusEnum;
export const LastBuildConclusionEnum = ApplicationResponseDto.LastBuildConclusionEnum;

export type LastBuildStatus = ApplicationResponseDto.LastBuildStatusEnum;
export type LastBuildConclusion = ApplicationResponseDto.LastBuildConclusionEnum;

// ===== HELPER FUNCTIONS =====

export function getStatusLabel(status: ApplicationStatus): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    awaiting_build: 'Awaiting Build',
    provisioning: 'Provisioning',
    running: 'Running',
    degraded: 'Degraded',
    stopped: 'Stopped',
    updating: 'Updating',
    rolling_back: 'Rolling Back',
    failed: 'Failed',
    deleting: 'Deleting',
    deleted: 'Deleted',
  };
  return labels[status] || status;
}

export function getStatusColor(status: ApplicationStatus): string {
  const colors: Record<string, string> = {
    running: 'green',
    pending: 'yellow',
    awaiting_build: 'blue',
    provisioning: 'blue',
    updating: 'blue',
    rolling_back: 'orange',
    degraded: 'orange',
    stopped: 'gray',
    failed: 'red',
    deleting: 'gray',
    deleted: 'gray',
  };
  return colors[status] || 'gray';
}

export function getCategoryLabel(category: ApplicationCategory): string {
  return category === 'system' ? 'System' : 'User';
}

export function getKindLabel(kind: ApplicationKind): string {
  switch (kind) {
    case ApplicationKindEnum.Database:
      return 'Databases';
    case ApplicationKindEnum.Tool:
      return 'Tools';
    case ApplicationKindEnum.System:
      return 'System';
    case ApplicationKindEnum.Application:
    default:
      return 'Applications';
  }
}

const DB_IMAGE_PREFIXES = [
  'postgres', 'postgresql', 'mysql', 'mariadb', 'redis', 'valkey',
  'mongo', 'mongodb', 'ferretdb', 'clickhouse', 'cockroachdb', 'cassandra',
];

export function suggestKindFromImageRef(imageRef: string | undefined): ApplicationKind {
  if (!imageRef) return ApplicationKindEnum.Application;
  const name = imageRef.split('/').pop()?.split(':')[0]?.toLowerCase() ?? '';
  if (DB_IMAGE_PREFIXES.some((p) => name === p || name.startsWith(`${p}-`))) {
    return ApplicationKindEnum.Database;
  }
  return ApplicationKindEnum.Application;
}

export function getSourceTypeLabel(sourceType: ApplicationSourceType): string {
  const labels: Record<string, string> = {
    docker_image: 'Docker Image',
    git_build: 'Git Build',
    helm_chart: 'Helm Chart',
    raw_manifest: 'Raw Manifest',
  };
  return labels[sourceType] || sourceType;
}

export function getReconciliationLabel(status: ReconciliationStatus): string {
  const labels: Record<string, string> = {
    PENDING: 'Pending',
    IN_SYNC: 'In Sync',
    DRIFT: 'Drift',
    RECONCILING: 'Reconciling',
    ERROR: 'Error',
  };
  return labels[status] || status;
}

// ===== BADGE HELPER FUNCTIONS =====

export function getStatusBadgeClass(status: ApplicationStatus): string {
  const base = 'text-sm px-3 py-1 rounded-full font-medium';
  switch (status) {
    case ApplicationStatusEnum.Running:
      return `${base} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
    case ApplicationStatusEnum.AwaitingBuild:
    case ApplicationStatusEnum.Provisioning:
    case ApplicationStatusEnum.Updating:
      return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400`;
    case ApplicationStatusEnum.Failed:
      return `${base} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
    case ApplicationStatusEnum.Degraded:
      return `${base} bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400`;
    default:
      return `${base} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`;
  }
}

export function getCategoryBadgeClass(category: string): string {
  const base = 'text-xs px-2 py-0.5 rounded font-medium';
  if (category === 'system') {
    return `${base} bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400`;
  }
  return `${base} bg-sky-100 text-sky-800 dark:bg-sky-900/20 dark:text-sky-400`;
}

export function getReconciliationBadgeClass(status: string): string {
  const base = 'text-xs px-2 py-0.5 rounded font-medium';
  switch (status) {
    case 'IN_SYNC':
      return `${base} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
    case 'DRIFT':
      return `${base} bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400`;
    case 'ERROR':
      return `${base} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
    default:
      return `${base} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`;
  }
}

// ===== LEGACY TYPES (kept for wizard/templates/repositories compatibility) =====

export enum Framework {
  NextJS = 'nextjs',
  Angular = 'angular',
  NestJS = 'nestjs',
  React = 'react',
  Vue = 'vue',
  Nuxt = 'nuxt',
  Express = 'express',
  Fastify = 'fastify',
  Django = 'django',
  Flask = 'flask',
  Laravel = 'laravel',
  Custom = 'custom',
}

export enum GitProvider {
  GitHub = 'github',
  GitLab = 'gitlab',
}

export enum BuildStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Success = 'success',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum HealthStatus {
  Healthy = 'healthy',
  Degraded = 'degraded',
  Unhealthy = 'unhealthy',
  Unknown = 'unknown',
}

export interface GitRepository {
  provider: GitProvider;
  url: string;
  branch: string;
  lastCommit?: {
    sha: string;
    message: string;
    author: string;
    timestamp: string;
  };
  webhookEnabled: boolean;
  autoDeployEnabled: boolean;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface FrameworkVersion {
  version: string;
  nodeVersion?: string;
  pythonVersion?: string;
  phpVersion?: string;
  eolDate?: string;
  stable: boolean;
  lts: boolean;
}

export interface Template {
  id: string;
  name: string;
  framework: Framework;
  description: string;
  icon?: string;
  category: 'frontend' | 'backend' | 'fullstack' | 'static';
  versions: FrameworkVersion[];
  defaultVersion: string;
  features: {
    ssr: boolean;
    apiRoutes: boolean;
    staticExport: boolean;
    serverless: boolean;
  };
  requirements: {
    minCpu: string;
    minMemory: string;
    buildTime: string;
  };
  status: 'stable' | 'beta' | 'experimental';
  popularity: number;
  docsUrl?: string;
  exampleRepoUrl?: string;
}

// ===== DEPLOY WIZARD INTERFACES =====

export interface FrameworkDetectionResult {
  framework: Framework;
  version?: string;
  confidence: number;
  detectedFrom: 'package.json' | 'Dockerfile' | '.flui.yaml' | 'composer.json' | 'requirements.txt' | 'manual';
  buildCommand?: string;
  startCommand?: string;
  defaultPort?: number;
  detectedFiles: string[];
}

export interface DeployWizardConfiguration {
  repository: {
    id: string;
    name: string;
    url: string;
    provider: GitProvider;
  };
  branch: string;
  framework: Framework;
  frameworkVersion?: string;
  buildPlan?: any;
  environmentVariables: EnvironmentVariable[];
  environmentFormat?: 'key-value' | 'json' | 'yaml';
  rawEnvironment?: string;
  cluster: {
    id: string;
    name: string;
  };
  applicationName?: string;
}

export interface DeploymentStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  weight?: number;
  errorMessage?: string;
}

export interface DeploymentProgress {
  operationId: string;
  applicationId?: string;
  applicationName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  currentStepIndex: number;
  totalSteps: number;
  steps: DeploymentStep[];
  logs: string[];
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
}

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  isValid: boolean;
  isCompleted: boolean;
}
