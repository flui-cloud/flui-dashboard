
export type ProvisionMode = 'automatic' | 'manual';

export type PlacementStrategy = 'cheapest' | 'closest' | 'roomiest' | 'uniform';

export interface StrategyCopy {
  id: PlacementStrategy;
  label: string;
  optimises: string;
  when: string;
}

export const STRATEGIES: readonly StrategyCopy[] = [
  {
    id: 'cheapest',
    label: 'Cheapest',
    optimises: 'money',
    when: 'Workloads that tolerate latency — batch, staging, anything not user-facing.',
  },
  {
    id: 'closest',
    label: 'Closest',
    optimises: 'latency',
    when: "Production, where the network between nodes is what's slow.",
  },
  {
    id: 'roomiest',
    label: 'Roomiest',
    optimises: 'quiet',
    when: 'Load that arrives in steps — the next pod should not trigger another purchase.',
  },
  {
    id: 'uniform',
    label: 'Uniform',
    optimises: 'predictability',
    when: 'A fleet where every node is the same. This is what happens today, unchosen.',
  },
];

export interface ScalingBounds {
  min: number;
  desired: number;
  max: number;
}

export interface ScalingLimits {
  hourlyBillingOnly: boolean;
  maxMonthlyCost: number | null;
}

export interface ScalingGroup {
  id: string;
  name: string;
  clusterId: string;
  clusterName: string;
  provider: string;
  bounds: ScalingBounds;
  regions: string[];
  shapes: string[];
  strategy: PlacementStrategy;
  settleSeconds: number;
  limits: ScalingLimits;
  provision: ProvisionMode;
  standingOrders: StandingOrder[];
}

export type StandingOrderKind = 'expand' | 'replace';

export interface StandingOrder {
  kind: StandingOrderKind;
  shape: string;
  region: string;
  wanted: number;
  replaces: string | null;
  outlook: AvailabilityOutlook | null;
  drainable: DrainCheck | null;
}

export interface DrainCheck {
  ok: boolean;
  blockers: DrainBlocker[];
  cleared: string[];
}

export interface ReplacePlan {
  steps: { at: number; does: string; note?: string }[];
}

export interface DrainBlocker {
  kind:
    | 'dedicated-app'
    | 'bound-volume'
    | 'no-controller'
    | 'disruption-budget'
    | 'not-evictable'
    | 'is-master';
  what: string;
  fix: string;
}

export interface AvailabilityOutlook {
  state: 'available' | 'limited' | 'sold-out' | 'recovered';
  upIn: string[];
  downIn: string[];
  sinceHours: number | null;
  ageSeconds: number | null;
}

export interface FleetNode {
  id: string;
  name: string;
  shape: string;
  region: string;
  role: 'master' | 'worker';
  hourlyEur: number | null;
  since: string;
  standIn: boolean;
  neverReplace: string | null;
}

export interface ScalingDecision {
  id: string;
  at: string;
  force: 'urgency' | 'opportunity';
  outcome: 'added' | 'replaced' | 'removed' | 'declined' | 'alerted';
  saw: string;
  did: string;
  why: string;
  shape?: string;
  region?: string;
  hourlyEur?: number | null;
}

export interface LadderRung {
  step: number;
  describes: string;
  shape: string | null;
  region: string | null;
  hourlyEur: number | null;
  outcome:
    | 'would-buy'
    | 'unavailable'
    | 'does-not-fit'
    | 'over-budget'
    | 'refused-by-limit'
    | 'alert';
  note?: string;
}

export interface ScalingPreview {
  pending: { app: string; cpu: string; memory: string } | null;
  opportunityHeldBecause: string | null;
  ladder: LadderRung[];
  chosen: LadderRung | null;
  asks?: string | null;
}
