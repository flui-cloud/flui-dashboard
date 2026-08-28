import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  AvailabilityOutlook,
  ScalingDecision,
  ScalingPreview,
} from '../model/scaling-group.models';
import {
  ClusterScalingRow,
  FleetHistory,
  FleetReading,
  ProviderScalingCapability,
  SectionGroup,
  ShapeCatalogue,
} from '../model/scaling-section.models';
import { ScalingApiService } from './scaling-api.service';

const HETZNER: ProviderScalingCapability = {
  provider: 'hetzner',
  canProvision: true,
  hasCatalogue: true,
  billing: 'hourly',
};

const CONTABO: ProviderScalingCapability = {
  provider: 'contabo',
  canProvision: false,
  hasCatalogue: true,
  billing: 'monthly',
};

const BYOS: ProviderScalingCapability = {
  provider: 'byos',
  canProvision: false,
  hasCatalogue: false,
  billing: 'none',
};

const ago = (hours: number): string =>
  new Date(Date.UTC(2026, 7, 27, 20, 0, 0) - hours * 3_600_000).toISOString();

const ROWS: ClusterScalingRow[] = [
  {
    clusterId: 'c-prod',
    clusterName: 'prod-eu',
    capability: HETZNER,
    groupId: 'g-prod',
    groupCount: 1,
    bounds: { min: 2, desired: 3, max: 6 },
    nodes: 3,
    monthlyEur: 16.2,
    unpricedNodes: 0,
    monthlyCap: 60,
    pendingPods: 0,
    acts: true,
    openOrders: 1,
    blockedOrders: 1,
    openAlarm: null,
    lastDecisionAt: ago(0.1),
    needsPerson: null,
  },
  {
    clusterId: 'c-batch',
    clusterName: 'eu-batch',
    capability: HETZNER,
    groupId: 'g-batch',
    groupCount: 1,
    bounds: { min: 1, desired: 2, max: 4 },
    nodes: 1,
    monthlyEur: 5.4,
    unpricedNodes: 0,
    monthlyCap: 40,
    pendingPods: 2,
    acts: false,
    openOrders: 0,
    blockedOrders: 0,
    openAlarm: null,
    lastDecisionAt: ago(0.05),
    needsPerson:
      'Two pods cannot be placed and this group is set to buy, but nothing was granted to this installation — so it decided and stopped.',
  },
  {
    clusterId: 'c-onprem',
    clusterName: 'on-prem-1',
    capability: BYOS,
    groupId: 'g-onprem',
    groupCount: 1,
    bounds: { min: 3, desired: 3, max: 3 },
    nodes: 2,
    monthlyEur: null,
    unpricedNodes: 2,
    monthlyCap: null,
    pendingPods: 1,
    acts: false,
    openOrders: 0,
    blockedOrders: 0,
    openAlarm: {
      since: ago(74),
      asks: 'Attach a machine holding at least 4 CPU and 8Gi, then join it with `flui node connect`. Flui cannot create a server on byos.',
    },
    lastDecisionAt: ago(0.2),
    needsPerson:
      'Below its floor — 2 nodes where 3 are required. An alarm raised on ' +
      ago(74).slice(0, 10) +
      ' is still open: it stands until this group decides something else.',
  },
  {
    clusterId: 'c-edge',
    clusterName: 'edge-de',
    capability: CONTABO,
    groupId: 'g-edge',
    groupCount: 1,
    bounds: { min: 1, desired: 2, max: 3 },
    nodes: 2,
    monthlyEur: 12.98,
    unpricedNodes: 1,
    monthlyCap: 30,
    pendingPods: null,
    acts: false,
    openOrders: 1,
    blockedOrders: 0,
    openAlarm: null,
    lastDecisionAt: ago(1.4),
    needsPerson: null,
  },
  {
    clusterId: 'c-staging',
    clusterName: 'staging-hz',
    capability: HETZNER,
    groupId: null,
    groupCount: 0,
    bounds: null,
    nodes: 2,
    monthlyEur: 10.8,
    unpricedNodes: 0,
    monthlyCap: null,
    pendingPods: 0,
    acts: false,
    openOrders: 0,
    blockedOrders: 0,
    openAlarm: null,
    lastDecisionAt: null,
    needsPerson:
      'No scaling group. This cluster will not grow, and nothing will raise an alarm when it should have.',
  },
];

const GROUPS: Record<string, SectionGroup> = {
  'g-prod': {
    id: 'g-prod',
    name: 'general',
    clusterId: 'c-prod',
    clusterName: 'prod-eu',
    provider: 'hetzner',
    capability: HETZNER,
    bounds: { min: 2, desired: 3, max: 6 },
    regions: ['fsn1', 'nbg1'],
    shapes: ['cx32', 'cx42'],
    strategy: 'closest',
    settleSeconds: 30,
    limits: { hourlyBillingOnly: false, maxMonthlyCost: 60 },
    provision: 'automatic',
    acts: {
      acts: true,
      says: 'This installation may commit up to €60 a month on its own, and only through groups set to buy automatically.',
      monthlyEur: 60,
    },
    requirement: null,
    standingOrders: [
      {
        kind: 'replace',
        shape: 'cx42',
        region: 'fsn1',
        wanted: 1,
        replaces: 'prod-eu-worker-2',
        outlook: {
          state: 'available',
          upIn: ['fsn1', 'nbg1'],
          downIn: [],
          sinceHours: null,
          ageSeconds: 214,
        },
        drainable: {
          ok: false,
          blockers: [
            {
              kind: 'dedicated-app',
              what: 'postgres-main',
              fix: 'postgres-main keeps its data on this machine. Back it up, then delete or redeploy it elsewhere.',
            },
            {
              kind: 'disruption-budget',
              what: 'flui-apps/checkout-pdb (covers flui-apps/checkout-7d8f)',
              fix: 'The budget permits no further disruption. Scale the workload up, or relax the budget, before this node can be emptied.',
            },
          ],
          cleared: [
            '6 DaemonSet pod(s) stay where they are: a drain neither evicts them nor waits for them.',
            '9 pod(s) are managed by a controller that will place them again elsewhere.',
          ],
        },
      },
    ],
  },
  'g-batch': {
    id: 'g-batch',
    name: 'heavy-jobs',
    clusterId: 'c-batch',
    clusterName: 'eu-batch',
    provider: 'hetzner',
    capability: HETZNER,
    bounds: { min: 1, desired: 2, max: 4 },
    regions: ['fsn1'],
    shapes: ['cx42'],
    strategy: 'roomiest',
    settleSeconds: 30,
    limits: { hourlyBillingOnly: false, maxMonthlyCost: 40 },
    provision: 'automatic',
    acts: {
      acts: false,
      says: 'Nothing may be bought without being asked: no spending was granted to this installation. Set SCALING_CONCESSION_MONTHLY_EUR to the most it may commit to per month, and scaling groups set to buy automatically will act up to that figure.',
      monthlyEur: null,
    },
    requirement: null,
    standingOrders: [],
  },
};

const PREVIEWS: Record<string, ScalingPreview> = {
  'g-prod': {
    pending: null,
    opportunityHeldBecause: null,
    ladder: [
      {
        step: 1,
        describes: 'The preferred shape, in the cluster’s own region',
        shape: 'cx42',
        region: 'fsn1',
        hourlyEur: 0.0148,
        outcome: 'would-buy',
      },
    ],
    chosen: {
      step: 1,
      describes: 'The preferred shape, in the cluster’s own region',
      shape: 'cx42',
      region: 'fsn1',
      hourlyEur: 0.0148,
      outcome: 'would-buy',
    },
    asks: null,
  },
  'g-batch': {
    pending: { app: 'flui-apps/render-9f2', cpu: '2000m', memory: '8192Mi' },
    opportunityHeldBecause:
      '2 pod(s) cannot be placed. Urgency always wins, and no standing order runs while one is waiting.',
    ladder: [
      {
        step: 1,
        describes: 'The preferred shape, in the cluster’s own region',
        shape: 'cx42',
        region: 'fsn1',
        hourlyEur: 0.0148,
        outcome: 'would-buy',
      },
    ],
    chosen: {
      step: 1,
      describes: 'The preferred shape, in the cluster’s own region',
      shape: 'cx42',
      region: 'fsn1',
      hourlyEur: 0.0148,
      outcome: 'would-buy',
    },
    asks: null,
  },
};

const DECISIONS: Record<string, ScalingDecision[]> = {
  'g-prod': [
    {
      id: 'd-1',
      at: ago(0.1),
      force: 'opportunity',
      outcome: 'declined',
      saw: 'Nothing is waiting. The fleet is at 3 nodes against a target of 3.',
      did: 'Nothing.',
      why: 'prod-eu-worker-2 cannot be emptied, so nothing is bought to replace it. postgres-main: back it up, then delete or redeploy it elsewhere. flui-apps/checkout-pdb: the budget permits no further disruption.',
      shape: 'cx42',
      region: 'fsn1',
      hourlyEur: 0.0148,
    },
    {
      id: 'd-2',
      at: ago(9),
      force: 'urgency',
      outcome: 'added',
      saw: '1 pod(s) the scheduler could not place, waiting for 64s.',
      did: 'Bought a cx32 in fsn1 and set it to join.',
      why: 'Would add a cx32 in fsn1 at €0.0074/h, about €5.4 a month. About €16.2 a month against the €60 granted.',
      shape: 'cx32',
      region: 'fsn1',
      hourlyEur: 0.0074,
    },
    {
      id: 'd-3',
      at: ago(31),
      force: 'opportunity',
      outcome: 'removed',
      saw: 'Nothing is waiting. The fleet is at 4 nodes against a target of 3.',
      did: 'Removed prod-eu-worker-4, which can be emptied, bringing the fleet to 3 against a target of 3.',
      why: 'The fleet is above its target and the node can be emptied.',
      shape: 'cx32',
      region: 'fsn1',
      hourlyEur: 0.0074,
    },
  ],
  'g-batch': [
    {
      id: 'd-4',
      at: ago(0.05),
      force: 'urgency',
      outcome: 'declined',
      saw: '2 pod(s) the scheduler could not place, waiting for 402s. The largest asks for 2000m and 8192Mi (flui-apps/render-9f2).',
      did: 'Would add a cx42 in fsn1 at €0.0148/h, about €10.8 a month.',
      why: 'Nothing may be bought without being asked: no spending was granted to this installation. Set SCALING_CONCESSION_MONTHLY_EUR to the most it may commit to per month, and scaling groups set to buy automatically will act up to that figure.',
      shape: 'cx42',
      region: 'fsn1',
      hourlyEur: 0.0148,
    },
  ],
};

const CATALOGUE: ShapeCatalogue = {
  provider: 'hetzner',
  reading: 'read',
  ageSeconds: 214,
  stale: false,
  says: 'Read 3 minutes ago. It orders the candidates and decides nothing.',
  shapes: [
    {
      shape: 'cx42',
      allowed: true,
      outlook: {
        state: 'available',
        upIn: ['fsn1', 'nbg1'],
        downIn: [],
        sinceHours: null,
        ageSeconds: 214,
      },
      why: 'Up in both regions this group may buy in.',
    },
    {
      shape: 'cx32',
      allowed: true,
      outlook: {
        state: 'limited',
        upIn: ['nbg1'],
        downIn: ['fsn1'],
        sinceHours: null,
        ageSeconds: 214,
      },
      why: 'Down in fsn1, which is where this cluster’s network is.',
    },
  ],
};

const OUTLOOK: Record<string, AvailabilityOutlook> = {
  cx42: {
    state: 'available',
    upIn: ['fsn1', 'nbg1'],
    downIn: [],
    sinceHours: null,
    ageSeconds: 214,
  },
  cx32: {
    state: 'limited',
    upIn: ['nbg1'],
    downIn: ['fsn1'],
    sinceHours: null,
    ageSeconds: 214,
  },
};

const FLEET: FleetReading = {
  nodes: [
    {
      id: 'n-1',
      name: 'prod-eu-master',
      shape: 'cx32',
      region: 'fsn1',
      role: 'master',
      hourlyEur: 0.0074,
      since: ago(2200),
      standIn: false,
      neverReplace:
        'The master carries the control plane and storage nothing can move.',
    },
    {
      id: 'n-2',
      name: 'prod-eu-worker-2',
      shape: 'cx32',
      region: 'fsn1',
      role: 'worker',
      hourlyEur: 0.0074,
      since: ago(1400),
      standIn: false,
      neverReplace: null,
    },
    {
      id: 'n-3',
      name: 'prod-eu-worker-3',
      shape: 'cx32',
      region: 'fsn1',
      role: 'worker',
      hourlyEur: 0.0074,
      since: ago(9),
      standIn: false,
      neverReplace: null,
    },
  ],
  unavailable: null,
};

function fleetOn(day: number): number {
  if (day < 20) return 2;
  if (day === 28) return 4;
  return 3;
}

const HISTORY: FleetHistory = {
  from: new Date(Date.UTC(2026, 6, 28)),
  to: new Date(Date.UTC(2026, 7, 27)),
  stepSeconds: 86_400,
  points: Array.from({ length: 30 }, (_, day) => {
    const nodes = fleetOn(day);
    return {
      at: new Date(Date.UTC(2026, 6, 28).valueOf() + day * 86_400_000),
      byShape: { cx32: nodes },
      nodes,
      hourlyEur: 0.0074 * nodes,
      unpricedNodes: 0,
    };
  }),
  orphanedIntervals: 2,
  orphanedOpenIntervals: 1,
  message:
    '2 billing interval(s) in this window belong to nodes whose row no longer exists; 1 of them is still open.',
};

@Injectable()
export class ScalingFixtureService extends ScalingApiService {
  override rows(): Observable<ClusterScalingRow[]> {
    return of(ROWS);
  }

  override row(clusterId: string): Observable<ClusterScalingRow> {
    return of(ROWS.find((row) => row.clusterId === clusterId) ?? ROWS[0]);
  }

  override group(groupId: string): Observable<SectionGroup> {
    return of(GROUPS[groupId] ?? GROUPS['g-prod']);
  }

  override preview(groupId: string): Observable<ScalingPreview> {
    return of(PREVIEWS[groupId] ?? PREVIEWS['g-prod']);
  }

  override decisions(groupId: string): Observable<ScalingDecision[]> {
    return of(DECISIONS[groupId] ?? []);
  }

  override clusterDecisions(clusterId: string): Observable<ScalingDecision[]> {
    const group = ROWS.find((row) => row.clusterId === clusterId)?.groupId;
    return of(group ? (DECISIONS[group] ?? []) : []);
  }

  override outlook(): Observable<ShapeCatalogue> {
    return of(CATALOGUE);
  }

  override history(): Observable<FleetHistory> {
    return of(HISTORY);
  }

  override fleet(): Observable<FleetReading> {
    return of(FLEET);
  }
}

export const FIXTURE_OUTLOOK = OUTLOOK;
