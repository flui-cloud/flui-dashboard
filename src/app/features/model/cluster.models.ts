
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
  OVH = 'ovh'
}

export enum ClusterViewMode {
  LOADING = 'loading',
  NO_PROVIDER = 'no-provider',
  NO_CLUSTER = 'no-cluster',
  LIST = 'list'
}

export enum ClusterType {
  OBSERVABILITY = 'observability',
  WORKLOAD = 'workload'
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
  nodeTypeId: string; // ID del tipo di nodo (es. 'cx11', 'cx21')
  minNodes: number;
  maxNodes: number;
  autoScalingEnabled: boolean;
  // Optional autoscale threshold overrides (50–95 for %, 60–3600 for cooldown)
  scaleUpMemoryPct?: number;
  scaleUpCpuPct?: number;
  cooldownSeconds?: number;
  sshKeys?: string[]; // Array of SSH key IDs
  diskSizeGb?: number; // Required for storageType=network nodes
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
  estimatedDuration?: number; // in seconds
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
  scaleUpCooldown: number; // in seconds
  scaleDownCooldown: number; // in seconds
}

// Wizard-specific models
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
  id: string; // ID univoco dal provider (es. 'cx11', 'cx21', 'cx31')
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

// Operation Step with weight
export interface OperationStep {
  step: string;
  description: string;
  weight: number;
}

// API Response models
export interface OperationStatus {
  id: string;
  operationType: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  resourceType?: string;
  resourceName?: string;
  resourceId?: string;
  provider?: string;
  userId?: string | null;

  // Progress tracking
  progress: number; // Overall progress 0-100
  currentStep: string; // Step identifier (e.g., "cluster_create_workers")
  currentStepIndex: number; // Current step index (0-based)
  totalSteps: number; // Total number of steps
  currentStepProgress: number; // Progress within current step 0-100

  // Metadata with step details
  metadata: {
    stepDescription?: string; // Human-readable step description
    stepWeight?: number; // Weight of current step
    estimatedDurationInSeconds?: number; // Total estimated duration
    operationSteps?: OperationStep[]; // Array of operation steps with weights
    [key: string]: any; // Allow additional dynamic properties
  };

  errorMessage?: string | null;
  estimatedDurationInSeconds?: number | null;
  startedAt?: string;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
