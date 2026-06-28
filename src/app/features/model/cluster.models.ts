
export enum ClusterStatus {
  NO_PROVIDER = 'no_provider',
  NO_CLUSTER = 'no_cluster',
  CREATING = 'creating',
  ACTIVE = 'active',
  ERROR = 'error',
  SCALING = 'scaling',
  UPDATING = 'updating',
  DELETING = 'deleting',
  STOPPED = 'stopped',
  STOPPING = 'stopping',
  STARTING = 'starting'
}

export enum NodeSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  XLARGE = 'xlarge'
}

export enum ProviderType {
  HETZNER = 'hetzner',
  CONTABO = 'contabo',
  SCALEWAY = 'scaleway',
  OVH = 'ovh',
  BYOS = 'byos'
}

export enum ClusterViewMode {
  LOADING = 'loading',
  NO_PROVIDER = 'no-provider',
  NO_CLUSTER = 'no-cluster',
  LIST = 'list'
}

export enum ClusterType {
  CONTROL = 'control',
  WORKLOAD = 'workload',
  /** @deprecated legacy value for the control cluster; accepted for back-compat. */
  OBSERVABILITY = 'observability'
}

export function isControlClusterType(type?: ClusterType | string | null): boolean {
  return type === ClusterType.CONTROL || type === 'observability';
}

export interface ClusterInfo {
  id?: string;
  name?: string;
  status: ClusterStatus;
  clusterType?: ClusterType;
  provider?: ProviderType;
  region?: string;
  nodeCount?: number;
  minNodes?: number;
  maxNodes?: number;
  nodeSize?: NodeSize;
  autoScalingEnabled?: boolean;
  masterIpAddress?: string;
  createdAt?: Date;
  lastActivity?: Date;
  version?: string;
  cost?: {
    current: number;
    projected: number;
    currency: string;
  };
  vnetId?: string;
  vnetName?: string;
}

export interface ClusterConfiguration {
  name: string;
  provider: ProviderType;
  region: string;
  nodeTypeId: string;
  minNodes: number;
  maxNodes: number;
  autoScalingEnabled: boolean;
  scaleUpMemoryPct?: number;
  scaleUpCpuPct?: number;
  cooldownSeconds?: number;
  sshKeys?: string[];
  diskSizeGb?: number;
  networkType?: 'public' | 'private';
  firewallRules?: Array<{
    description: string;
    direction: 'in' | 'out';
    protocol: 'tcp' | 'udp' | 'icmp';
    port?: string;
    sourceIps?: string[];
    destinationIps?: string[];
  }>;
  vnetConfig?: {
    vnetId: string;
    subnetId?: string;
    autoAssignIp?: boolean;
  };
  endpointHostnameMode?: 'ip' | 'domain';
  sharedStorageEnabled?: boolean;
  sharedStorageVolumeSizeGb?: number;
}

export interface ClusterCreationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  details?: string;
}

export interface ClusterMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  podCount: number;
  serviceCount: number;
  timestamp: Date;
}

export interface AutoScalingConfig {
  enabled: boolean;
  minNodes: number;
  maxNodes: number;
  targetCpuUtilization: number;
  targetMemoryUtilization: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
}

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  isValid: boolean;
  isCompleted: boolean;
}

export interface ProviderRegion {
  id: string;
  name: string;
  country: string;
  flagEmoji: string;
  available: boolean;
}

export interface NodeSizeOption {
  id: string;
  name: string;
  vcpu: number;
  ram: number;
  disk: number;
  pricePerHour: number;
  cpuType: 'shared' | 'dedicated';
  architecture: 'x86' | 'arm';
}

export interface ProviderOption {
  id: string;
  name: string;
  regions: number;
  comingSoon?: boolean;
}

export interface OperationStep {
  step: string;
  description: string;
  weight: number;
}

export interface OperationStatus {
  id: string;
  operationType: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  resourceType?: string;
  resourceName?: string;
  resourceId?: string;
  provider?: string;
  userId?: string | null;

  progress: number;
  currentStep: string;
  currentStepIndex: number;
  totalSteps: number;
  currentStepProgress: number;

  metadata: {
    stepDescription?: string;
    stepWeight?: number;
    estimatedDurationInSeconds?: number;
    operationSteps?: OperationStep[];
    [key: string]: any;
  };

  errorMessage?: string | null;
  estimatedDurationInSeconds?: number | null;
  startedAt?: string;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
