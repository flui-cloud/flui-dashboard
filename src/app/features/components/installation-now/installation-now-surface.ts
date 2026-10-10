import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  boolObservation,
  buildSurfaceList,
  clusterEntityRef,
  scopeIdPart,
  SURFACE_APP_ID,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import {
  InstallationNow,
  cpuLevel,
  edgeErrorPercent,
  isEdgeFailing,
  isLinkBusy,
  isMonthHeavy,
  isRateLimited,
  isSurge,
  memoryLevel,
  monthSharePercent,
  TB,
} from '../../model/installation-now.models';

const PAGE_ID = 'installation-now';
const DEMO_ID = `${PAGE_ID}:demo`;
const EDGES_ID = `${PAGE_ID}:requests`;
const NODES_ID = `${PAGE_ID}:nodes`;
const PLATFORM_ID = `${PAGE_ID}:platform`;
const REGISTRY_ID = `${PAGE_ID}:registry`;

export interface InstallationNowSurfaceInput {
  loading: boolean;
  refused: boolean;
  hasError: boolean;
  paused: boolean;
  now: InstallationNow | null;
}

export interface InstallationNowSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

function keep(observations: (Observation | null)[]): Observation[] {
  return observations.filter((o): o is Observation => o !== null);
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

function percentObservation(key: string, value: number | null): Observation | null {
  return value == null ? null : valueObservation(key, Math.round(value), 'api', '%');
}

export function presentedContent(input: InstallationNowSurfaceInput): PresentedContent {
  const now = input.now;
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Now',
    observations: keep([
      boolObservation('flui.now.refused', input.refused, 'api'),
      boolObservation('flui.now.paused', input.paused, 'ui'),
      now ? textObservation('flui.now.measured_at', now.measuredAt, 'api') : null,
      now ? valueObservation('flui.now.alerts_firing', now.alerts.firing, 'api') : null,
      now ? valueObservation('flui.now.alerts_critical', now.alerts.critical, 'api') : null,
      now && now.alerts.names.length > 0
        ? textObservation('flui.now.alert_names', now.alerts.names.join(', '), 'api')
        : null,
    ]),
    state: {
      loading: input.loading && !now,
      ...(input.hasError ? { error: true, errorCode: 'flui.now.load_failed' } : {}),
    },
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope];

  if (now) {
    const t = now.thresholds;

    if (now.sandbox) {
      scopes.push({
        id: DEMO_ID,
        parentId: PAGE_ID,
        kind: 'region',
        label: 'Demo',
        observations: [
          valueObservation('flui.now.demo.live', now.sandbox.live, 'api'),
          valueObservation('flui.now.demo.ceiling', now.sandbox.ceiling, 'api'),
          valueObservation('flui.now.demo.ready', now.sandbox.warm, 'api'),
          valueObservation('flui.now.demo.waiting', now.sandbox.waiting, 'api'),
          valueObservation('flui.now.demo.turned_away', now.sandbox.fullRefusals, 'api'),
        ],
      });
    }

    const edges = buildSurfaceList({
      listId: EDGES_ID,
      parentId: PAGE_ID,
      label: 'Requests at the door',
      totalCount: now.edges.length,
      rows: now.edges.map((edge) => ({
        id: `${EDGES_ID}:${scopeIdPart(edge.clusterId)}`,
        ref: clusterEntityRef(edge.clusterId),
        label: edge.clusterName,
        observations: keep([
          valueObservation('flui.now.edge.rps_now', round1(edge.rpsNow), 'api', 'req/s'),
          valueObservation('flui.now.edge.rps_before', round1(edge.rpsBefore), 'api', 'req/s'),
          boolObservation('flui.now.edge.surge', isSurge(edge, t), 'derived'),
          valueObservation('flui.now.edge.rate_limited_10m', edge.rateLimited10m, 'api'),
          boolObservation('flui.now.edge.rate_limit_alert', isRateLimited(edge, t), 'derived'),
          percentObservation('flui.now.edge.server_error_percent', edgeErrorPercent(edge)),
          boolObservation('flui.now.edge.error_alert', isEdgeFailing(edge, t), 'derived'),
        ]),
      })),
    });
    scopes.push(...edges.scopes);

    const nodes = buildSurfaceList({
      listId: NODES_ID,
      parentId: PAGE_ID,
      label: 'Nodes',
      totalCount: now.nodes.length,
      rows: now.nodes.map((node) => {
        const share = monthSharePercent(node);
        const nodeKey = `${node.clusterId}:${node.node}`;
        return {
          id: `${NODES_ID}:${scopeIdPart(nodeKey)}`,
          label: `${node.clusterName} / ${node.node}`,
          observations: keep([
            percentObservation('flui.now.node.cpu_percent', node.cpuPercent),
            textObservation('flui.now.node.cpu_level', cpuLevel(node.cpuPercent), 'derived'),
            percentObservation('flui.now.node.memory_percent', node.memoryPercent),
            textObservation('flui.now.node.memory_level', memoryLevel(node.memoryPercent), 'derived'),
            valueObservation('flui.now.node.mbps_out', round1(node.mbpsOut), 'api', 'Mbit/s'),
            valueObservation('flui.now.node.mbps_in', round1(node.mbpsIn), 'api', 'Mbit/s'),
            boolObservation('flui.now.node.link_alert', isLinkBusy(node, t), 'derived'),
            valueObservation('flui.now.node.month_pace_tb', round1(node.monthPaceBytes / TB), 'api', 'TB'),
            node.includedTb != null
              ? valueObservation('flui.now.node.included_tb', node.includedTb, 'api', 'TB')
              : boolObservation('flui.now.node.not_metered', true, 'api'),
            share !== null ? valueObservation('flui.now.node.month_share_percent', Math.round(share), 'derived', '%') : null,
            boolObservation('flui.now.node.month_alert', isMonthHeavy(node, t), 'derived'),
          ]),
        };
      }),
    });
    scopes.push(...nodes.scopes);

    const platform = buildSurfaceList({
      listId: PLATFORM_ID,
      parentId: PAGE_ID,
      label: 'Platform components',
      totalCount: now.platform.length,
      rows: now.platform.map((component) => ({
        id: `${PLATFORM_ID}:${scopeIdPart(component.name)}`,
        label: component.name,
        observations: keep([
          percentObservation('flui.now.platform.cpu_percent', component.cpuPercent),
          percentObservation('flui.now.platform.memory_percent', component.memoryPercent),
          valueObservation('flui.now.platform.restarts_last_hour', component.restartsLastHour, 'api'),
        ]),
      })),
    });
    scopes.push(...platform.scopes);

    if (now.registry) {
      const r = now.registry;
      scopes.push({
        id: REGISTRY_ID,
        parentId: PAGE_ID,
        kind: 'region',
        label: 'Image registry, last hour',
        observations: [
          valueObservation('flui.now.registry.pulls', r.requests.pulls, 'api'),
          valueObservation('flui.now.registry.pushes', r.requests.pushes, 'api'),
          valueObservation('flui.now.registry.bytes_out', r.bytesOut, 'api', 'B'),
          valueObservation('flui.now.registry.peak_out', r.peakBytesPerSecondOut, 'api', 'B/s'),
          valueObservation('flui.now.registry.refused', r.outcomes.refused, 'api'),
          valueObservation('flui.now.registry.failed', r.outcomes.failed, 'api'),
        ],
      });
    }
  }

  return { scopes, attention: [{ scopeId: PAGE_ID, reason: 'route' }] };
}

export function buildInstallationNowSurface(
  input: InstallationNowSurfaceInput,
  context: InstallationNowSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  const truncated = content.scopes.some((scope) => scope.completeness?.truncated);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/now',
      revision: context.revision,
      generatedAt: context.generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class InstallationNowSurfaceRevision {
  private counter = 0;
  private lastHash = '';

  next(presented: PresentedContent): number {
    const hash = JSON.stringify(presented);
    if (hash !== this.lastHash) {
      this.lastHash = hash;
      this.counter += 1;
    }
    return this.counter;
  }
}
