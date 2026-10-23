import { TopologyGraph } from './topology-graph';
import { rowsLayout } from './topology-layout-rows';

export interface Point {
  x: number;
  y: number;
}

export interface GraphLayout {
  width: number;
  height: number;
  nodes: Map<string, Point>;
  edges: Map<string, Point[]>;
  /** Regions get their size from what they hold. */
  sizes: Map<string, { width: number; height: number }>;
}

const cache = new Map<string, GraphLayout>();
const CACHE_LIMIT = 50;

/** Identity of a graph's shape: what it holds and how it connects, never what it shows. */
export function graphDigest(graph: TopologyGraph): string {
  const byText = (a: string, b: string) => a.localeCompare(b);
  const nodes = graph.nodes.map((n) => `${n.id}:${n.width}x${n.height}:${n.parent ?? ''}`).sort(byText);
  const edges = graph.edges.map((e) => e.id).sort(byText);
  return `${graph.level}${graph.stacked ? ':rows' : ''}|${nodes.join(',')}|${edges.join(',')}`;
}

type ElkCtor = new () => { layout: (g: unknown) => Promise<ElkResult> };
interface ElkResult {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ElkResult[];
  edges?: { id: string; sections?: { startPoint: Point; endPoint: Point; bendPoints?: Point[] }[] }[];
}

/** Set on every region too: ELK does not hand spacing down to a box's children. */
const SPACING = {
  'elk.layered.spacing.nodeNodeBetweenLayers': '96',
  'elk.spacing.nodeNode': '28',
};

const BOX_TOP = 52;
const BOX_PAD = 20;
const GRID_GAP = 16;
const GRID_COLUMNS = 3;
const TOP_GRID_FROM = 4;

interface Grid {
  nodes: string[];
  columns: number;
  cell: { width: number; height: number };
  width: number;
  height: number;
}

/** A grid roughly wider than tall, never more than six across. */
function columnsFor(count: number): number {
  return Math.min(6, Math.max(GRID_COLUMNS, Math.ceil(Math.sqrt(count * 1.6))));
}

function gridOf(loose: { id: string; width: number; height: number }[], max = GRID_COLUMNS): Grid {
  const columns = Math.min(max, loose.length);
  const rows = Math.ceil(loose.length / columns);
  const cell = {
    width: Math.max(...loose.map((n) => n.width)),
    height: Math.max(...loose.map((n) => n.height)),
  };
  return {
    nodes: loose.map((n) => n.id),
    columns,
    cell,
    width: columns * cell.width + (columns - 1) * GRID_GAP,
    height: rows * cell.height + (rows - 1) * GRID_GAP,
  };
}

let elk: Promise<{ layout: (g: unknown) => Promise<ElkResult> }> | null = null;

function engine() {
  elk ??= import('elkjs/lib/elk.bundled.js').then((m) => {
    const Elk = ((m as { default?: ElkCtor }).default ?? m) as unknown as ElkCtor;
    return new Elk();
  });
  return elk;
}

/** Layered left to right, ingress first and data last, the same picture for the same data. */
export async function layoutGraph(graph: TopologyGraph): Promise<GraphLayout> {
  const key = graphDigest(graph);
  const cached = cache.get(key);
  if (cached) return cached;
  if (graph.stacked) return remember(key, rowsLayout(graph));

  const parentOf = new Map(graph.nodes.map((n) => [n.id, n.parent]));
  const edgesIn = (container: string | null) =>
    graph.edges
      .filter((e) => {
        const p = parentOf.get(e.from) ?? null;
        return p === (parentOf.get(e.to) ?? null) && p === container;
      })
      .map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] }));
  const crossing = graph.edges
    .filter((e) => (parentOf.get(e.from) ?? null) !== (parentOf.get(e.to) ?? null))
    .map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] }));
  // Apps with no link at all would stand in one tall column: they get a grid at the foot of their box instead.
  const linked = new Set(graph.edges.flatMap((e) => [e.from, e.to]));
  const grids = new Map<string, Grid>();
  for (const region of graph.nodes.filter((n) => n.kind === 'region')) {
    const loose = graph.nodes.filter((c) => c.parent === region.id && !linked.has(c.id));
    if (loose.length) grids.set(region.id, gridOf(loose));
  }
  // The same at the top: a cluster's unlinked stacks, or a fleet's unlinked clusters, once there are a few.
  const topLoose = graph.nodes.filter((n) => !n.parent && n.kind !== 'region' && !linked.has(n.id));
  const topGrid = topLoose.length >= TOP_GRID_FROM ? gridOf(topLoose, columnsFor(topLoose.length)) : null;
  const elkNode = (n: TopologyGraph['nodes'][number]): unknown => {
    if (n.kind !== 'region') return { id: n.id, width: n.width, height: n.height };
    const grid = grids.get(n.id);
    const tight = graph.nodes.filter((c) => c.parent === n.id && linked.has(c.id));
    const minWidth = Math.max(300, (grid?.width ?? 0) + 2 * BOX_PAD);
    if (!tight.length) {
      return { id: n.id, width: minWidth, height: BOX_TOP + (grid?.height ?? 0) + BOX_PAD };
    }
    const bottom = BOX_PAD + (grid ? grid.height + GRID_GAP : 0);
    return {
      id: n.id,
      layoutOptions: {
        ...SPACING,
        'elk.padding': `[top=${BOX_TOP},left=${BOX_PAD},bottom=${bottom},right=${BOX_PAD}]`,
        // Room for the box's own title and its grid, however few apps it holds.
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${minWidth}, 0)`,
      },
      children: tight.map(elkNode),
      edges: edgesIn(n.id),
    };
  };

  const result = await (await engine()).layout({
    id: 'root',
    layoutOptions: {
      ...SPACING,
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'POLYLINE',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.randomSeed': '1',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.json.edgeCoords': 'ROOT',
      'elk.json.shapeCoords': 'ROOT',
    },
    children: graph.nodes.filter((n) => !n.parent && !topGrid?.nodes.includes(n.id)).map(elkNode),
    edges: [...edgesIn(null), ...crossing],
  });

  const nodes = new Map<string, Point>();
  const sizes = new Map<string, { width: number; height: number }>();
  const edges = new Map<string, Point[]>();
  const regions = new Set(graph.nodes.filter((n) => n.kind === 'region').map((n) => n.id));
  const walk = (box: ElkResult) => {
    for (const c of box.children ?? []) {
      nodes.set(c.id!, { x: c.x ?? 0, y: c.y ?? 0 });
      if (regions.has(c.id!)) sizes.set(c.id!, { width: c.width ?? 0, height: c.height ?? 0 });
      if (c.children?.length) walk(c);
    }
    for (const e of box.edges ?? []) {
      const s = e.sections?.[0];
      edges.set(e.id, s ? [s.startPoint, ...(s.bendPoints ?? []), s.endPoint] : []);
    }
  };
  walk(result);
  for (const [regionId, grid] of grids) {
    const at = nodes.get(regionId);
    const size = sizes.get(regionId);
    if (!at || !size) continue;
    const top = at.y + size.height - BOX_PAD - grid.height;
    grid.nodes.forEach((id, i) => {
      nodes.set(id, {
        x: at.x + BOX_PAD + (i % grid.columns) * (grid.cell.width + GRID_GAP),
        y: top + Math.floor(i / grid.columns) * (grid.cell.height + GRID_GAP),
      });
    });
  }
  let width = result.width ?? 0;
  let height = result.height ?? 0;
  if (topGrid) {
    // Below what is linked, or on its own when nothing is.
    const tightCount = graph.nodes.filter((n) => !n.parent && !topGrid.nodes.includes(n.id)).length;
    const top = tightCount ? height : 24;
    topGrid.nodes.forEach((id, i) => {
      nodes.set(id, {
        x: 24 + (i % topGrid.columns) * (topGrid.cell.width + GRID_GAP),
        y: top + Math.floor(i / topGrid.columns) * (topGrid.cell.height + GRID_GAP),
      });
    });
    width = Math.max(width, 48 + topGrid.width);
    height = top + topGrid.height + 24;
  }
  return remember(key, { width, height, nodes, edges, sizes });
}

function remember(key: string, layout: GraphLayout): GraphLayout {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, layout);
  return layout;
}

/** One smooth curve, leaving and arriving level, as a service map draws its links. */
export function curve(a: Point, b: Point): string {
  const pull = Math.max(40, Math.abs(b.x - a.x) / 2);
  const dir = b.x >= a.x ? 1 : -1;
  return `M${a.x},${a.y} C${a.x + pull * dir},${a.y} ${b.x - pull * dir},${b.y} ${b.x},${b.y}`;
}

/** The routed point farthest from the straight line between the ends: the lane elk found around the nodes in the way. */
export function laneOf(routed: Point[], a: Point, b: Point): number | null {
  const mid = (a.y + b.y) / 2;
  const inner = routed.slice(1, -1);
  if (!inner.length) return null;
  const far = inner.reduce((best, p) => (Math.abs(p.y - mid) > Math.abs(best.y - mid) ? p : best), inner[0]);
  return Math.abs(far.y - mid) < 8 ? null : far.y;
}

/**
 * A link that skips a layer: it bends out to the lane, runs straight along it
 * past the nodes in the way, and bends back in. No wobble, whatever elk routed.
 */
export function detour(a: Point, b: Point, lane: number, gap = 72): string {
  const x1 = a.x + gap;
  const x2 = b.x - gap;
  if (x2 <= x1) return curve(a, b);
  const pull = gap * 0.6;
  return (
    `M${a.x},${a.y} C${a.x + pull},${a.y} ${x1 - pull},${lane} ${x1},${lane}` +
    ` L${x2},${lane}` +
    ` C${x2 + pull},${lane} ${b.x - pull},${b.y} ${b.x},${b.y}`
  );
}
