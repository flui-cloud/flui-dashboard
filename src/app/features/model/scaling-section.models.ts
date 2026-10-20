import { ServerArchitecture } from '../../shared/components/architecture-badge.component';
import {
  AvailabilityOutlook,
  FleetNode,
  ScalingBounds,
  ScalingCost,
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
  groupId?: string;
  /** `give-back`: the fleet is above its target and the node that would go back cannot be emptied. */
  kind?: 'purchase' | 'give-back';
  giveBack?: GiveBackAlarm | null;
}

export interface GiveBackAlarm {
  node: string | null;
  nodes: number;
  target: number;
  monthlyEur: number | null;
  /** The target that closes the alarm by keeping the node. */
  keepNodes: number;
  /** "5 applications keep their data on it", written by the API. */
  says: string;
  reasons: GiveBackReason[];
}

export interface GiveBackReason {
  kind: 'data-on-node' | 'not-restarted' | 'no-interruption' | 'placed-by-machine' | 'master' | 'runs-flui-api';
  title: string;
  fix: string;
  items: { label: string; applicationId: string | null }[];
}

/** What saving lower node limits would do to the machines, read before saving. */
export interface RemovalPreview {
  removes: boolean;
  fleet: number;
  target: number;
  leaving: number;
  node: string | null;
  shape: string | null;
  /** Whether the first removal could start now; false means it would wait, touching nothing. */
  proceeds: boolean;
  opensMaster: boolean;
  moves: { what: string; system: boolean }[];
  waitsFor: GiveBackReason[];
  sentence: string;
  /** The sentence without the list of what moves, shown beside that list. */
  headline: string;
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
  /** What the node limits cost; absent from an API that does not compute it. */
  cost?: ScalingCost | null;
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
  architecture: ServerArchitecture | null;
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
