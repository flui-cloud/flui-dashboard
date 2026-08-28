import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  AvailabilityOutlook,
  DrainCheck,
  FleetNode,
  LadderRung,
  PlacementStrategy,
  ProvisionMode,
  ScalingBounds,
  ScalingDecision,
  ScalingLimits,
  ScalingPreview,
  StandingOrder,
  StandingOrderKind,
} from '../model/scaling-group.models';
import {
  CatalogueReadingState,
  ClusterScalingRow,
  FleetHistory,
  FleetHistoryPoint,
  FleetReading,
  NodeRequirement,
  OpenAlarm,
  ProviderScalingCapability,
  SectionGroup,
  ShapeCatalogue,
} from '../model/scaling-section.models';

interface WireCapability {
  provider: string;
  canProvision: boolean;
  hasCatalogue: boolean;
  billing: 'hourly' | 'monthly' | 'none';
}

interface WireBounds {
  min: number;
  desired: number;
  max: number;
}

interface WireLimits {
  hourlyBillingOnly: boolean;
  maxMonthlyCost: number | null;
}

interface WireOutlook {
  state: AvailabilityOutlook['state'];
  upIn: string[];
  downIn: string[];
  sinceHours: number | null;
  ageSeconds: number | null;
}

interface WireDrainCheck {
  ok: boolean;
  blockers: { kind: string; what: string; fix: string }[];
  cleared: string[];
}

interface WireStandingOrder {
  kind: StandingOrderKind;
  shape: string;
  region: string;
  wanted: number;
  replaces: string | null;
  outlook: WireOutlook | null;
  drainable: WireDrainCheck | null;
}

interface WireGroup {
  id: string;
  name: string;
  clusterId: string;
  clusterName: string;
  provider: string;
  capability: WireCapability;
  bounds: WireBounds;
  regions: string[];
  shapes: string[];
  strategy: PlacementStrategy;
  settleSeconds: number;
  limits: WireLimits;
  provision: ProvisionMode;
  standingOrders: WireStandingOrder[];
  requirement: NodeRequirement | null;
  acts: WireActuation;
}

interface WireActuation {
  acts: boolean;
  says: string;
}

interface WireRow {
  clusterId: string;
  clusterName: string;
  capability: WireCapability;
  groupId: string | null;
  groupCount: number;
  bounds: WireBounds | null;
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

interface WireRung {
  step: number;
  describes: string;
  shape: string | null;
  region: string | null;
  hourlyEur: number | null;
  outcome: LadderRung['outcome'];
  note?: string;
}

interface WirePreview {
  groupId: string;
  pending: { app: string; cpu: string; memory: string } | null;
  opportunityHeldBecause: string | null;
  ladder: WireRung[];
  chosen: WireRung | null;
  asks: string | null;
}

interface WireDecision {
  id: string;
  at: string;
  force: ScalingDecision['force'];
  outcome: ScalingDecision['outcome'];
  saw: string;
  did: string;
  why: string;
  asks: string | null;
  shape: string | null;
  region: string | null;
  hourlyEur: number | null;
}

interface WireOrderedShape {
  shape: string;
  allowed: boolean;
  outlook: WireOutlook | null;
  why: string;
}

interface WireCatalogue {
  groupId: string;
  provider: string;
  reading: CatalogueReadingState;
  ageSeconds: number | null;
  stale: boolean;
  says: string;
  shapes: WireOrderedShape[];
}

interface WireHistoryPoint {
  at: string;
  byShape: Record<string, number>;
  nodes: number;
  hourlyEur: number;
  unpricedNodes: number;
}

interface WireNode {
  id: string;
  serverName: string;
  nodeType: 'master' | 'worker';
  ipAddress: string | null;
  status: string;
  providerResourceId: string;
  provider: string;
  region: string | null;
  serverType: string | null;
  hourlyPriceEur: number | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface WireHistory {
  clusterId: string;
  from: string;
  to: string;
  stepSeconds: number;
  points: WireHistoryPoint[];
  orphanedIntervals: number;
  orphanedOpenIntervals: number;
  message: string | null;
}

@Injectable({ providedIn: 'root' })
export class ScalingApiService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private get base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/infrastructure`;
  }

  rows(): Observable<ClusterScalingRow[]> {
    return this.http
      .get<WireRow[]>(`${this.base}/scaling`)
      .pipe(map((rows) => rows.map(toRow)));
  }

  row(clusterId: string): Observable<ClusterScalingRow> {
    return this.http
      .get<WireRow>(`${this.base}/clusters/${clusterId}/scaling`)
      .pipe(map(toRow));
  }

  group(groupId: string): Observable<SectionGroup> {
    return this.http
      .get<WireGroup>(`${this.base}/scaling-groups/${groupId}`)
      .pipe(map(toGroup));
  }

  preview(groupId: string): Observable<ScalingPreview> {
    return this.http
      .get<WirePreview>(`${this.base}/scaling-groups/${groupId}/preview`)
      .pipe(map(toPreview));
  }

  decisions(groupId: string, limit = 50): Observable<ScalingDecision[]> {
    return this.http
      .get<WireDecision[]>(`${this.base}/scaling-groups/${groupId}/decisions`, {
        params: { limit },
      })
      .pipe(map((rows) => rows.map(toDecision)));
  }

  clusterDecisions(clusterId: string, limit = 50): Observable<ScalingDecision[]> {
    return this.http
      .get<WireDecision[]>(
        `${this.base}/clusters/${clusterId}/scaling-decisions`,
        { params: { limit } },
      )
      .pipe(map((rows) => rows.map(toDecision)));
  }

  outlook(groupId: string): Observable<ShapeCatalogue> {
    return this.http
      .get<WireCatalogue>(`${this.base}/scaling-groups/${groupId}/catalogue`)
      .pipe(map(toCatalogue));
  }

  history(
    clusterId: string,
    days = 30,
    stepHours = 24,
  ): Observable<FleetHistory> {
    return this.http
      .get<WireHistory>(
        `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/clusters/${clusterId}/fleet/history`,
        { params: { days, stepHours } },
      )
      .pipe(map(toHistory));
  }

  fleet(clusterId: string): Observable<FleetReading> {
    return this.http
      .get<WireNode[]>(`${this.base}/clusters/${clusterId}/nodes`)
      .pipe(map((nodes) => ({ nodes: nodes.map(toFleetNode), unavailable: null })));
  }
}

function toCapability(wire: WireCapability): ProviderScalingCapability {
  return {
    provider: wire.provider,
    canProvision: wire.canProvision,
    hasCatalogue: wire.hasCatalogue,
    billing: wire.billing,
  };
}

function toBounds(wire: WireBounds): ScalingBounds {
  return { min: wire.min, desired: wire.desired, max: wire.max };
}

function toLimits(wire: WireLimits): ScalingLimits {
  return {
    hourlyBillingOnly: wire.hourlyBillingOnly,
    maxMonthlyCost: wire.maxMonthlyCost,
  };
}

function toOutlook(wire: WireOutlook): AvailabilityOutlook {
  return {
    state: wire.state,
    upIn: wire.upIn,
    downIn: wire.downIn,
    sinceHours: wire.sinceHours,
    ageSeconds: wire.ageSeconds,
  };
}

function toDrainCheck(wire: WireDrainCheck): DrainCheck {
  return {
    ok: wire.ok,
    blockers: wire.blockers.map((blocker) => ({
      kind: blocker.kind as DrainCheck['blockers'][number]['kind'],
      what: blocker.what,
      fix: blocker.fix,
    })),
    cleared: wire.cleared,
  };
}

function toStandingOrder(wire: WireStandingOrder): StandingOrder {
  return {
    kind: wire.kind,
    shape: wire.shape,
    region: wire.region,
    wanted: wire.wanted,
    replaces: wire.replaces,
    outlook: wire.outlook ? toOutlook(wire.outlook) : null,
    drainable: wire.drainable ? toDrainCheck(wire.drainable) : null,
  };
}

function toGroup(wire: WireGroup): SectionGroup {
  return {
    id: wire.id,
    name: wire.name,
    clusterId: wire.clusterId,
    clusterName: wire.clusterName,
    provider: wire.provider,
    capability: toCapability(wire.capability),
    bounds: toBounds(wire.bounds),
    regions: wire.regions,
    shapes: wire.shapes,
    strategy: wire.strategy,
    settleSeconds: wire.settleSeconds,
    limits: toLimits(wire.limits),
    provision: wire.provision,
    standingOrders: wire.standingOrders.map(toStandingOrder),
    requirement: wire.requirement,
    acts: wire.acts,
  };
}

function toRow(wire: WireRow): ClusterScalingRow {
  return {
    clusterId: wire.clusterId,
    clusterName: wire.clusterName,
    capability: toCapability(wire.capability),
    groupId: wire.groupId,
    groupCount: wire.groupCount,
    bounds: wire.bounds ? toBounds(wire.bounds) : null,
    nodes: wire.nodes,
    monthlyEur: wire.monthlyEur,
    unpricedNodes: wire.unpricedNodes,
    monthlyCap: wire.monthlyCap,
    pendingPods: wire.pendingPods,
    acts: wire.acts,
    openOrders: wire.openOrders,
    blockedOrders: wire.blockedOrders,
    openAlarm: wire.openAlarm,
    lastDecisionAt: wire.lastDecisionAt,
    needsPerson: wire.needsPerson,
  };
}

function toRung(wire: WireRung): LadderRung {
  return {
    step: wire.step,
    describes: wire.describes,
    shape: wire.shape,
    region: wire.region,
    hourlyEur: wire.hourlyEur,
    outcome: wire.outcome,
    note: wire.note,
  };
}

function toPreview(wire: WirePreview): ScalingPreview {
  return {
    pending: wire.pending,
    opportunityHeldBecause: wire.opportunityHeldBecause,
    ladder: wire.ladder.map(toRung),
    chosen: wire.chosen ? toRung(wire.chosen) : null,
    asks: wire.asks,
  };
}

function toDecision(wire: WireDecision): ScalingDecision {
  return {
    id: wire.id,
    at: wire.at,
    force: wire.force,
    outcome: wire.outcome,
    saw: wire.saw,
    did: wire.did,
    why: wire.why,
    shape: wire.shape ?? undefined,
    region: wire.region ?? undefined,
    hourlyEur: wire.hourlyEur,
  };
}

function toCatalogue(wire: WireCatalogue): ShapeCatalogue {
  return {
    provider: wire.provider,
    reading: wire.reading,
    ageSeconds: wire.ageSeconds,
    stale: wire.stale,
    says: wire.says,
    shapes: wire.shapes.map((shape) => ({
      shape: shape.shape,
      allowed: shape.allowed,
      outlook: shape.outlook ? toOutlook(shape.outlook) : null,
      why: shape.why,
    })),
  };
}

function toHistoryPoint(wire: WireHistoryPoint): FleetHistoryPoint {
  return {
    at: new Date(wire.at),
    byShape: wire.byShape,
    nodes: wire.nodes,
    hourlyEur: wire.hourlyEur,
    unpricedNodes: wire.unpricedNodes,
  };
}

function toHistory(wire: WireHistory): FleetHistory {
  return {
    from: new Date(wire.from),
    to: new Date(wire.to),
    stepSeconds: wire.stepSeconds,
    points: wire.points.map(toHistoryPoint),
    orphanedIntervals: wire.orphanedIntervals,
    orphanedOpenIntervals: wire.orphanedOpenIntervals,
    message: wire.message,
  };
}

const UNKNOWN_SHAPE = 'unknown';

const MASTER_NEVER_REPLACED =
  'It is the master: it carries the control plane and storage nothing can move.';

function toFleetNode(wire: WireNode): FleetNode {
  return {
    id: wire.id,
    name: wire.serverName,
    shape: wire.serverType ?? UNKNOWN_SHAPE,
    region: wire.region ?? UNKNOWN_SHAPE,
    role: wire.nodeType,
    hourlyEur: wire.hourlyPriceEur ?? null,
    since: wire.createdAt,
    standIn: false,
    neverReplace: wire.nodeType === 'master' ? MASTER_NEVER_REPLACED : null,
  };
}
