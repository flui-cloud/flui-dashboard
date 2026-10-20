import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  buildSurfaceList,
  clusterEntityRef,
  entityRef,
  instanceEntityRef,
  SURFACE_APP_ID,
  SurfaceListRow,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import { applicationEntityRef } from '../application/application-surface';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyFocus, TopologyViewState } from './topology-state';
import { attentionOf } from './topology-attention.component';

const PAGE_ID = 'topology';
const PROBLEMS_ID = `${PAGE_ID}:problems`;
const FOCUS_ID = `${PAGE_ID}:focus`;

export interface TopologySurfaceInput {
  snapshot: TopologyResponseDto | null;
  state: TopologyViewState;
  focus: TopologyFocus | null;
}

export interface TopologySurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/** The ref of a focused element, by the same grammar the page it opens uses. */
export function topologyEntityRef(focus: TopologyFocus, t: TopologyResponseDto): string | undefined {
  switch (focus.type) {
    case 'cluster':
      return clusterEntityRef(focus.id);
    case 'server': {
      const s = t.servers.find((x) => x.id === focus.id);
      return s?.providerResourceId ? instanceEntityRef(s.provider, s.providerResourceId) : entityRef('server', focus.id);
    }
    case 'app':
      return applicationEntityRef(focus.id);
    case 'stack':
      return entityRef('stack', focus.id);
    case 'link':
      return entityRef('topology-link', focus.id);
    case 'platform':
      return clusterEntityRef(focus.id);
  }
}

function labelOf(focus: TopologyFocus, t: TopologyResponseDto): string {
  switch (focus.type) {
    case 'cluster':
      return t.clusters.find((c) => c.id === focus.id)?.name ?? focus.id;
    case 'server':
      return t.servers.find((s) => s.id === focus.id)?.nodeName ?? focus.id;
    case 'app':
      return t.apps.find((a) => a.id === focus.id)?.displayName ?? focus.id;
    case 'stack':
      return t.stacks.find((s) => s.id === focus.id)?.name ?? focus.id;
    case 'link':
      return 'Link';
    case 'platform':
      return `Flui platform on ${t.clusters.find((c) => c.id === focus.id)?.name ?? focus.id}`;
  }
}

/**
 * What the Topology page presents: the view and level being looked at, the
 * fleet's size, the problems it lists, and the one element selected. Read from
 * the same snapshot the page draws, so mask mode applies here as it does on
 * screen. Never a route host, a namespace or a link's traffic detail.
 */
export function presentedContent(input: TopologySurfaceInput): PresentedContent | null {
  const t = input.snapshot;
  if (!t) return null;

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Topology',
    observations: [
      textObservation('flui.topology.view', input.state.view, 'ui'),
      textObservation('flui.topology.level', input.state.level, 'ui'),
      valueObservation('flui.topology.clusters', t.stats.totalClusters, 'api'),
      valueObservation('flui.topology.servers', t.stats.totalServers, 'api'),
      valueObservation('flui.topology.apps', t.stats.totalApps, 'api'),
    ].filter((o): o is Observation => o !== null),
  };

  const { needs } = attentionOf(t);
  const rows: SurfaceListRow[] = needs.map((item) => ({
    id: `${PROBLEMS_ID}:${item.focus.type}:${item.focus.id}`,
    ref: topologyEntityRef(item.focus, t),
    label: item.label,
    role: 'related',
  }));
  const { scopes: problemScopes } = buildSurfaceList({
    listId: PROBLEMS_ID,
    parentId: PAGE_ID,
    label: 'Needs attention',
    totalCount: needs.length,
    rows,
  });

  const scopes = [pageScope, ...problemScopes];
  const attention: AttentionTarget[] = [{ scopeId: PAGE_ID, reason: 'route' }];
  if (input.focus) {
    const ref = topologyEntityRef(input.focus, t);
    scopes.push({
      id: FOCUS_ID,
      kind: 'region',
      label: 'Selected',
      parentId: PAGE_ID,
      ...(ref ? { entities: [{ ref, role: 'selected', label: labelOf(input.focus, t) }] } : {}),
    });
    attention.splice(0, 1, { scopeId: FOCUS_ID, ...(ref ? { entityRef: ref } : {}), reason: 'selection' });
  }

  return { scopes, attention };
}

export function buildTopologySurface(
  input: TopologySurfaceInput,
  context: TopologySurfaceContext,
): SurfaceSnapshot | null {
  const content = presentedContent(input);
  if (!content) return null;
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'topology',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class TopologySurfaceRevision {
  private counter = 0;
  private lastHash = '';

  next(presented: PresentedContent | null): number {
    const hash = JSON.stringify(presented);
    if (hash !== this.lastHash) {
      this.lastHash = hash;
      this.counter += 1;
    }
    return this.counter;
  }
}
