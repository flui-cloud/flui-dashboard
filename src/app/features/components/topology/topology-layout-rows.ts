import type { TopologyGraph } from './topology-graph-model';
import type { GraphLayout, Point } from './topology-layout';

const MARGIN = 24;
const BOX_TOP = 52;
const BOX_PAD = 20;
const ROW_GAP = 24;
const STACK_GAP = 16;
const COLUMN_GAP = 64;
const INTERNET_GAP = 96;
const MIN_BOX_WIDTH = 300;

/** How many links still lie ahead of each node: data at 0, what calls it one more each step back. */
function depths(graph: TopologyGraph): Map<string, number> {
  const depth = new Map(graph.nodes.map((n) => [n.id, 0]));
  let passes = graph.nodes.length;
  while (passes-- > 0) {
    let moved = false;
    for (const e of graph.edges) {
      const next = (depth.get(e.to) ?? 0) + 1;
      if (next > (depth.get(e.from) ?? 0)) {
        depth.set(e.from, next);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return depth;
}

/**
 * Boxes stacked one under the other, all as wide, and inside them the same
 * columns: what is called from the Internet on the left, data on the right. A
 * link between two boxes then runs a short way down to the next column.
 */
export function rowsLayout(graph: TopologyGraph): GraphLayout {
  const depth = depths(graph);
  const rows = graph.nodes.filter((n) => !n.parent && n.kind !== 'internet');
  const inside = graph.nodes.filter((n) => n.parent);
  const used = [...new Set(inside.map((n) => depth.get(n.id) ?? 0))].sort((a, b) => b - a);
  const columnOf = new Map(used.map((d, i) => [d, i]));
  const cell = {
    width: Math.max(0, ...inside.map((n) => n.width)),
    height: Math.max(0, ...inside.map((n) => n.height)),
  };
  const internet = graph.nodes.find((n) => n.kind === 'internet');
  const left = MARGIN + (internet ? internet.width + INTERNET_GAP : 0);
  const columnsWidth = used.length * cell.width + Math.max(0, used.length - 1) * COLUMN_GAP;
  const boxWidth = Math.max(MIN_BOX_WIDTH, columnsWidth + 2 * BOX_PAD);

  const nodes = new Map<string, Point>();
  const sizes = new Map<string, { width: number; height: number }>();
  let y = MARGIN;
  for (const row of rows) {
    nodes.set(row.id, { x: left, y });
    if (row.kind !== 'region') {
      y += row.height + ROW_GAP;
      continue;
    }
    const filled = new Map<number, number>();
    for (const n of inside.filter((c) => c.parent === row.id)) {
      const column = columnOf.get(depth.get(n.id) ?? 0) ?? 0;
      const slot = filled.get(column) ?? 0;
      filled.set(column, slot + 1);
      nodes.set(n.id, {
        x: left + BOX_PAD + column * (cell.width + COLUMN_GAP),
        y: y + BOX_TOP + slot * (cell.height + STACK_GAP),
      });
    }
    const tallest = Math.max(1, ...filled.values());
    const height = BOX_TOP + tallest * cell.height + (tallest - 1) * STACK_GAP + BOX_PAD;
    sizes.set(row.id, { width: boxWidth, height });
    y += height + ROW_GAP;
  }
  const height = Math.max(y - ROW_GAP, MARGIN) + MARGIN;
  if (internet) nodes.set(internet.id, { x: MARGIN, y: (height - internet.height) / 2 });
  return { width: left + boxWidth + MARGIN, height, nodes, sizes, edges: new Map() };
}
