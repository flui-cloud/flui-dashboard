export type AutoscaleWarningLevel =
  | 'NONE'
  | 'WARN_NEEDS_AUTOSCALE'
  | 'DANGER_NEEDS_SCALE';

export interface AutoscaleEffectiveThresholds {
  scaleUpMemoryPct: number;
  scaleUpCpuPct: number;
  warnMemoryPct: number;
  dangerMemoryPct: number;
  warnCpuPct: number;
  dangerCpuPct: number;
  cooldownSeconds: number;
}

export interface AutoscaleStatus {
  clusterId: string;
  autoscalingEnabled: boolean;
  minNodes: number | null;
  maxNodes: number | null;
  currentNodes: number;
  metrics: { memoryPct: number | null; cpuPct: number | null };
  warning: AutoscaleWarningLevel;
  warningMessage: string | null;
  effectiveThresholds: AutoscaleEffectiveThresholds;
}

export interface UpdateClusterAutoscalePayload {
  autoscalingEnabled?: boolean;
  minNodes?: number;
  maxNodes?: number;
  scaleUpMemoryPct?: number;
  scaleUpCpuPct?: number;
  cooldownSeconds?: number;
}

export interface AutoscaleDefaults extends AutoscaleEffectiveThresholds {
  defaultMinNodes: number;
  defaultMaxNodes: number;
}

export type AutoscaleErrorKind = 'vnet-required' | 'validation' | 'generic';

export interface AutoscaleError {
  kind: AutoscaleErrorKind;
  message: string;
}
