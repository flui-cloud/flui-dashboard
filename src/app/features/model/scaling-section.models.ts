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

export interface ScalingModeLabel {
  mode: 'automatic' | 'manual' | 'alarm-only';
  /** "Manual — Flui does not buy", the same words on every surface. The API owns them. */
  label: string;
  /** A group Flui could buy for, set to manual: somebody may be expecting scaling. */
  attention: boolean;
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
  mode?: ScalingModeLabel | null;
  openOrders: number;
  blockedOrders: number;
  openAlarm: OpenAlarm | null;
  lastDecisionAt: string | null;
  needsPerson: string | null;
}

export interface GroupActuation extends Partial<ScalingModeLabel> {
  acts: boolean;
  /** What stands between this group and a purchase. The API owns the wording. */
  says: string;
}

export interface SectionGroup extends ScalingGroup {
  capability: ProviderScalingCapability;
  /**
   * The regions a node bought for this cluster could join it from, or null
   * where geography fences nothing. Not what the provider sells: a machine can
   * be on offer somewhere this cluster's private network cannot be reached.
   */
  buyableRegions: string[] | null;
  acts: GroupActuation;
  requirement: NodeRequirement | null;
  /**
   * Set while a failed purchase holds the group back: it buys nothing more
   * until a person asks it to try again, or a later purchase goes through.
   */
  purchaseHeld: PurchaseHold | null;
  /** The last purchase, while on its way and for half an hour after. */
  purchase?: PurchaseInFlight | null;
}

export interface PurchaseInFlight {
  decisionId: string;
  decidedAt: Date;
  shape: string | null;
  region: string | null;
  state: 'buying' | 'joined' | 'failed';
  /** "Buying cx23 in fsn1 — installing (60%)". The API owns the wording. */
  says: string;
  operationId: string;
  progress: number;
  finishedAt: Date | null;
}

export interface PurchaseHold {
  failedAt: Date;
  error: string | null;
  /** Set when the machine was sold out: the hold ends by itself then. */
  until: Date | null;
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
  /** The machine as the provider describes it, priced the way the ceiling counts. */
  facts?: ShapeSpec | null;
}

export interface ShapeSpec {
  cores: number;
  memoryMi: number;
  hourlyEur: number | null;
  monthlyEur: number | null;
}

export interface ShapeCatalogue {
  provider: string;
  reading: CatalogueReadingState;
  ageSeconds: number | null;
  stale: boolean;
  says: string;
  shapes: OrderedShape[];
}

export interface FleetLoad {
  reservedMemoryMi: number;
  capacityMemoryMi: number;
  reservedCpuMillicores: number;
  capacityCpuMillicores: number;
}

export interface FleetHistoryPoint {
  at: Date;
  /** Reserved by running apps against what the nodes hold; null where nothing was recorded. */
  load?: FleetLoad | null;
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
