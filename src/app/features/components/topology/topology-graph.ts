import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyFocus, TopologyViewState } from './topology-state';
import { MAX_NODES, TopologyGraph } from './topology-graph-model';
import { appGraph, appsGraph, clusterGraph, fleetGraph, stackGraph } from './topology-graph-levels';

export * from './topology-graph-model';
export { neighbourhood, projectLit } from './topology-graph-levels';

/** The nodes in trouble, the nodes they are linked to, and the links between those. */
export function problemsAndNeighbours(graph: TopologyGraph): TopologyGraph {
  const trouble = new Set(
    graph.nodes.filter((n) => n.kind !== 'region' && (n.tone !== 'healthy' || n.problems > 0)).map((n) => n.id),
  );
  const keep = new Set(trouble);
  for (const e of graph.edges) {
    if (trouble.has(e.from)) keep.add(e.to);
    if (trouble.has(e.to)) keep.add(e.from);
  }
  // A kept app keeps the box of its cluster around it.
  for (const n of graph.nodes) if (keep.has(n.id) && n.parent) keep.add(n.parent);
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: graph.edges.filter((e) => keep.has(e.from) && keep.has(e.to)),
    filtered: true,
  };
}

/**
 * A crowded level: drawn in full when asked for, otherwise its problems and their
 * neighbours when those fit, otherwise nothing and the level above takes over.
 */
function readable(graph: TopologyGraph, all: boolean): TopologyGraph | null {
  if (graph.nodes.length <= MAX_NODES || all) return graph;
  const focused = problemsAndNeighbours(graph);
  return focused.nodes.length && focused.nodes.length <= MAX_NODES ? focused : null;
}

/** The graph a level draws, collapsing to the level above when it would be unreadable. */
export function topologyGraph(t: TopologyResponseDto, state: TopologyViewState): TopologyGraph {
  return centredGraph(t, state) ?? stackLevel(t, state) ?? clusterLevel(t, state) ?? fleetLevel(t, state);
}

function centredGraph(t: TopologyResponseDto, state: TopologyViewState): TopologyGraph | null {
  if (state.level !== 'app' || !state.app || !t.apps.some((a) => a.id === state.app)) return null;
  return appGraph(t, state.app, state.hops);
}

function stackLevel(t: TopologyResponseDto, state: TopologyViewState): TopologyGraph | null {
  if (state.level !== 'stack' || state.focus?.type !== 'stack') return null;
  return readable(stackGraph(t, state.focus.id), state.all);
}

const knownCluster = (t: TopologyResponseDto, state: TopologyViewState) =>
  !!state.cluster && t.clusters.some((c) => c.id === state.cluster);

function clusterLevel(t: TopologyResponseDto, state: TopologyViewState): TopologyGraph | null {
  if (state.level === 'fleet' || !knownCluster(t, state)) return null;
  const graph = readable(clusterGraph(t, state.cluster!), state.all);
  return graph && { ...graph, collapsedFrom: state.level === 'cluster' ? null : state.level };
}

function fleetLevel(t: TopologyResponseDto, state: TopologyViewState): TopologyGraph {
  const collapsedFrom = state.level === 'fleet' || !knownCluster(t, state) ? null : state.level;
  const byApps = state.fleetBy ? state.fleetBy === 'apps' : t.apps.length > 0 && t.apps.length <= MAX_NODES;
  const apps = byApps && t.apps.length ? readable(appsGraph(t, state.boxBy), state.all) : null;
  return { ...(apps ?? fleetGraph(t)), collapsedFrom };
}

/** What a focused element keeps lit: itself, its neighbours and the edges between them. */
export function litBy(graph: TopologyGraph, focus: TopologyFocus | null): { nodes: Set<string>; edges: Set<string> } | null {
  if (!focus) return null;
  const self = graph.nodes.find((n) => n.focus?.type === focus.type && n.focus.id === focus.id);
  const edge = graph.edges.find((e) => e.focus?.type === focus.type && e.focus.id === focus.id);
  if (edge) return { nodes: new Set([edge.from, edge.to]), edges: new Set([edge.id]) };
  if (!self) return null;
  const edges = graph.edges.filter((e) => e.from === self.id || e.to === self.id);
  return {
    nodes: new Set([self.id, ...edges.flatMap((e) => [e.from, e.to])]),
    edges: new Set(edges.map((e) => e.id)),
  };
}
