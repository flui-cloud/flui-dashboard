// ===== TYPES =====
// Shape come da docs/SCALING_PHASE_1_2_API.md (risposta non tipizzata lato backend).

export type PodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
export type QosClass = 'Guaranteed' | 'Burstable' | 'BestEffort';

export interface PodCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

export interface ContainerStateRunning {
  startedAt?: string;
}

export interface ContainerStateWaiting {
  reason?: string;
  message?: string;
}

export interface ContainerStateTerminated {
  reason?: string;
  exitCode?: number;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ContainerState {
  running?: ContainerStateRunning;
  waiting?: ContainerStateWaiting;
  terminated?: ContainerStateTerminated;
}

export interface ResourceSpec {
  cpu: string | null;
  memory: string | null;
}

export interface Probe {
  type: 'http' | 'tcp' | 'exec' | null;
  path?: string;
  port?: number | string;
  command?: string[];
  initialDelaySeconds?: number;
  periodSeconds?: number;
  timeoutSeconds?: number;
  failureThreshold?: number;
  successThreshold?: number;
}

export interface EnvEntryValueFrom {
  kind: 'Secret' | 'ConfigMap';
  name: string;
  key: string;
  exists: boolean;
}

export interface EnvEntry {
  name: string;
  value?: string;
  valueFrom?: EnvEntryValueFrom;
}

export interface ContainerDebugInfo {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  requests: ResourceSpec;
  limits: ResourceSpec;
  state: ContainerState;
  lastState: ContainerState | null;
  readinessProbe?: Probe;
  livenessProbe?: Probe;
  startupProbe?: Probe;
  env: EnvEntry[];
}

export type VolumeKind = 'Secret' | 'ConfigMap' | 'PersistentVolumeClaim' | 'EmptyDir' | 'Other';

export interface VolumeDebugInfo {
  name: string;
  kind: VolumeKind;
  resourceName?: string;
  exists?: boolean;
}

export interface PodEvent {
  type: string;
  reason: string;
  message: string;
  count: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
}

export interface PodScheduling {
  nodeSelector?: Record<string, string>;
  tolerations?: Array<Record<string, unknown>>;
  affinity?: Record<string, unknown>;
}

export interface PodDebugInfo {
  name: string;
  namespace: string;
  uid: string;
  creationTimestamp: string | null;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  nodeName: string | null;
  hostIP: string | null;
  podIP: string | null;
  phase: PodPhase | string;
  qosClass: QosClass | string | null;
  conditions: PodCondition[];
  containers: ContainerDebugInfo[];
  volumes: VolumeDebugInfo[];
  events: PodEvent[];
  scheduling: PodScheduling;
  latestDiagnosisId: string | null;
}

// ===== HELPERS =====

export function totalRestarts(pod: PodDebugInfo): number {
  return pod.containers.reduce((sum, c) => sum + (c.restartCount ?? 0), 0);
}

export function hasUnreadyContainer(pod: PodDebugInfo): boolean {
  return pod.containers.some(c => !c.ready);
}

export function hasMissingResources(pod: PodDebugInfo): boolean {
  const envMissing = pod.containers.some(c =>
    c.env.some(e => e.valueFrom?.exists === false),
  );
  const volMissing = pod.volumes.some(v => v.exists === false);
  return envMissing || volMissing;
}

export function phaseBadgeClass(phase: string): string {
  const base = 'text-xs px-2 py-0.5 rounded font-medium';
  switch (phase) {
    case 'Running':
      return `${base} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
    case 'Pending':
      return `${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`;
    case 'Succeeded':
      return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400`;
    case 'Failed':
      return `${base} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
    default:
      return `${base} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`;
  }
}
