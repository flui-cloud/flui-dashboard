import { Params } from '@angular/router';

export type TopologyView = 'services' | 'infrastructure';
export type TopologyLevel = 'fleet' | 'cluster' | 'stack' | 'app';
export type TopologyHops = 1 | 2;
export type TopologyFleetBy = 'apps' | 'clusters';
export type TopologyBoxBy = 'cluster' | 'project';
export type TopologyColorBy = 'memory' | 'cpu' | 'pods' | 'network';
export type TopologyGroupBy = 'cluster' | 'provider';
export type TopologyEntityType = 'cluster' | 'server' | 'stack' | 'app' | 'link';
export type TopologyDrill = 'capacity' | 'path';

export interface TopologyFocus {
  type: TopologyEntityType;
  id: string;
}

export interface TopologyViewState {
  view: TopologyView;
  level: TopologyLevel;
  cluster: string | null;
  /** The app the `app` level is centred on, kept apart from the selection so a click only selects. */
  app: string | null;
  hops: TopologyHops;
  /** Draw a crowded level in full instead of only its problems and their neighbours. */
  all: boolean;
  /** The fleet drawn by app opens in full; this narrows it to its problems and their neighbours. */
  problems: boolean;
  /** How the fleet level is drawn. */
  fleetBy: TopologyFleetBy;
  /** The boxes the apps view draws: their clusters, or their projects. */
  boxBy: TopologyBoxBy;
  /** Only one project's apps stay lit, in both lenses. */
  project: string | null;
  focus: TopologyFocus | null;
  colorBy: TopologyColorBy;
  groupBy: TopologyGroupBy;
  list: boolean;
  drill: TopologyDrill | null;
}

export const DEFAULT_TOPOLOGY_STATE: TopologyViewState = {
  view: 'services',
  level: 'fleet',
  cluster: null,
  app: null,
  hops: 1,
  all: false,
  problems: false,
  fleetBy: 'apps',
  boxBy: 'cluster',
  project: null,
  focus: null,
  colorBy: 'memory',
  groupBy: 'cluster',
  list: false,
  drill: null,
};

const VIEWS: readonly TopologyView[] = ['services', 'infrastructure'];
const LEVELS: readonly TopologyLevel[] = ['fleet', 'cluster', 'stack', 'app'];
const COLORS: readonly TopologyColorBy[] = ['memory', 'cpu', 'pods', 'network'];
const GROUPS: readonly TopologyGroupBy[] = ['cluster', 'provider'];
const DRILLS: readonly TopologyDrill[] = ['capacity', 'path'];
const TYPES: readonly TopologyEntityType[] = ['cluster', 'server', 'stack', 'app', 'link'];

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** `type:id`. The id may itself hold colons (`app:<uuid>` stacks, synthetic servers). */
export function parseFocus(raw: unknown): TopologyFocus | null {
  if (typeof raw !== 'string') return null;
  const split = raw.indexOf(':');
  if (split <= 0 || split === raw.length - 1) return null;
  const type = raw.slice(0, split);
  if (!(TYPES as readonly string[]).includes(type)) return null;
  return { type: type as TopologyEntityType, id: raw.slice(split + 1) };
}

export function formatFocus(focus: TopologyFocus): string {
  return `${focus.type}:${focus.id}`;
}

export function parseTopologyState(params: Params): TopologyViewState {
  const d = DEFAULT_TOPOLOGY_STATE;
  return {
    view: oneOf(params['view'], VIEWS, d.view),
    level: oneOf(params['level'], LEVELS, d.level),
    cluster: typeof params['cluster'] === 'string' && params['cluster'] ? params['cluster'] : null,
    app: typeof params['app'] === 'string' && params['app'] ? params['app'] : null,
    hops: params['hops'] === '2' ? 2 : 1,
    all: params['all'] === '1',
    problems: params['problems'] === '1',
    fleetBy: params['fleet'] === 'clusters' ? 'clusters' : 'apps',
    boxBy: params['box'] === 'project' ? 'project' : 'cluster',
    project: typeof params['project'] === 'string' && params['project'] ? params['project'] : null,
    focus: parseFocus(params['focus']),
    colorBy: oneOf(params['colorBy'], COLORS, d.colorBy),
    groupBy: oneOf(params['groupBy'], GROUPS, d.groupBy),
    list: params['list'] === '1',
    drill: (DRILLS as readonly string[]).includes(params['drill']) ? (params['drill'] as TopologyDrill) : null,
  };
}

/** Only what differs from the default goes in the address, so a shared link stays short. */
export function topologyQueryParams(state: TopologyViewState): Params {
  const d = DEFAULT_TOPOLOGY_STATE;
  const params: Params = {};
  if (state.view !== d.view) params['view'] = state.view;
  if (state.level !== d.level) params['level'] = state.level;
  if (state.cluster) params['cluster'] = state.cluster;
  if (state.app) params['app'] = state.app;
  if (state.hops !== d.hops) params['hops'] = String(state.hops);
  if (state.all) params['all'] = '1';
  if (state.problems) params['problems'] = '1';
  if (state.fleetBy !== d.fleetBy) params['fleet'] = state.fleetBy;
  if (state.boxBy !== d.boxBy) params['box'] = state.boxBy;
  if (state.project) params['project'] = state.project;
  if (state.focus) params['focus'] = formatFocus(state.focus);
  if (state.colorBy !== d.colorBy) params['colorBy'] = state.colorBy;
  if (state.groupBy !== d.groupBy) params['groupBy'] = state.groupBy;
  if (state.list) params['list'] = '1';
  if (state.drill) params['drill'] = state.drill;
  return params;
}
