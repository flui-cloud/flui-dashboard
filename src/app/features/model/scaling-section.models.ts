import {
  AvailabilityOutlook,
  FleetNode,
  ScalingBounds,
  ScalingGroup,
} from './scaling-group.models';

export interface ProviderScalingCapability {
  provider: string;
  canProvision: boolean;
  hasCatalogue: boolean;
  billing: 'hourly' | 'monthly' | 'none';
}

export interface NodeRequirement {
  cpu: string;
  memory: string;
}

export interface OpenAlarm {
  since: string;
  asks: string;
}

export interface ClusterScalingRow {
  clusterId: string;
  clusterName: string;
  capability: ProviderScalingCapability;
  groupId: string | null;
  groupCount: number;
  bounds: ScalingBounds | null;
  nodes: number;
  monthlyEur: number | null;
  unpricedNodes: number;
  monthlyCap: number | null;
  pendingPods: number | null;
  acts: boolean;
  openOrders: number;
  blockedOrders: number;
  openAlarm: OpenAlarm | null;
  lastDecisionAt: string | null;
  needsPerson: string | null;
}

export interface GroupActuation {
  acts: boolean;
  says: string;
  monthlyEur: number | null;
}

export interface SectionGroup extends ScalingGroup {
  capability: ProviderScalingCapability;
  acts: GroupActuation;
  requirement: NodeRequirement | null;
}

export type CatalogueReadingState =
  | 'read'
  | 'not-published'
  | 'not-covered'
  | 'unreachable'
  | 'no-market'
  | 'off';

export interface OrderedShape {
  shape: string;
  allowed: boolean;
  outlook: AvailabilityOutlook | null;
  why: string;
}

export interface ShapeCatalogue {
  provider: string;
  reading: CatalogueReadingState;
  ageSeconds: number | null;
  stale: boolean;
  says: string;
  shapes: OrderedShape[];
}

export interface FleetHistoryPoint {
  at: Date;
  byShape: Record<string, number>;
  nodes: number;
  hourlyEur: number;
  unpricedNodes: number;
}

export interface FleetHistory {
  from: Date;
  to: Date;
  stepSeconds: number;
  points: FleetHistoryPoint[];
  orphanedIntervals: number;
  orphanedOpenIntervals: number;
  message: string | null;
}

export interface FleetReading {
  nodes: FleetNode[] | null;
  unavailable: string | null;
}
