import { GraphEdge, TopologyGraph } from './topology-graph';
import { GraphLayout, Point, curve, detour, laneOf } from './topology-layout';

/** Where an edge leaves and arrives: the facing sides of its two nodes, halfway up. */
function edgeEnds(graph: TopologyGraph, layout: GraphLayout, edge: GraphEdge): { start: Point; end: Point } | null {
  const from = graph.nodes.find((n) => n.id === edge.from);
  const to = graph.nodes.find((n) => n.id === edge.to);
  const a = layout.nodes.get(edge.from);
  const b = layout.nodes.get(edge.to);
  if (!from || !to || !a || !b) return null;
  const forward = b.x >= a.x + from.width;
  return {
    start: { x: forward ? a.x + from.width : a.x, y: a.y + from.height / 2 },
    end: { x: forward ? b.x : b.x + to.width, y: b.y + to.height / 2 },
  };
}

export function edgePath(graph: TopologyGraph, layout: GraphLayout, edge: GraphEdge): string {
  const ends = edgeEnds(graph, layout, edge);
  if (!ends) return '';
  const lane = laneOf(layout.edges.get(edge.id) ?? [], ends.start, ends.end);
  return lane === null ? curve(ends.start, ends.end) : detour(ends.start, ends.end, lane);
}

export function edgeLabelAt(graph: TopologyGraph, layout: GraphLayout, edge: GraphEdge): Point | null {
  if (!edge.label) return null;
  const ends = edgeEnds(graph, layout, edge);
  if (!ends) return null;
  // The Internet's fan is labelled only where it is small; at the fleet and cluster levels the inspector says it.
  if (edge.from === 'internet') {
    return graph.level === 'fleet' || graph.level === 'cluster' ? null : { x: ends.end.x - 52, y: ends.end.y };
  }
  const lane = laneOf(layout.edges.get(edge.id) ?? [], ends.start, ends.end);
  return { x: (ends.start.x + ends.end.x) / 2, y: lane ?? (ends.start.y + ends.end.y) / 2 };
}

export function edgeStroke(edge: GraphEdge): string {
  if (edge.failing) return 'hsl(var(--destructive) / 0.8)';
  return edge.measured ? 'hsl(var(--brand) / 0.4)' : 'hsl(var(--muted-foreground) / 0.35)';
}

/** Thin by default; traffic thickens a line a little, never past 1.5 px. */
export function edgeWidth(edge: GraphEdge): number {
  if (!edge.measured) return 1;
  return 1 + Math.min(0.5, Math.log10((edge.rps ?? 0) + 1) * 0.2);
}
