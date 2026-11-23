import { GraphEdge, GraphNode, TopologyGraph } from './topology-graph';
import { GraphLayout, Point } from './topology-layout';
import { CHIP_H, CHIP_W, PlacementStrip } from './topology-placement';
import { ExportPalette } from './topology-export';
import { ExportHeader, esc, fit, frame, monoFamily, resolveColor } from './topology-view-export';
import { edgeLabelAt, edgeOpacity, edgePath, edgeStroke, edgeWidth } from './topology-edges';
import { toneWord } from './topology-kit';

/** The service map as it stands on screen: what is drawn, and what is faded or selected. */
export interface ServicesView {
  graph: TopologyGraph;
  layout: GraphLayout;
  strip: PlacementStrip | null;
  dimRegion: (n: GraphNode) => boolean;
  dimNode: (n: GraphNode) => boolean;
  dimEdge: (e: GraphEdge) => boolean;
  isFocused: (n: GraphNode) => boolean;
}

type Svg = { svg: string; width: number; height: number };

const TONE_KEY: Record<string, keyof ExportPalette> = {
  healthy: 'ok',
  degraded: 'warn',
  error: 'err',
};
const toneColor = (palette: ExportPalette, tone: string) => palette[TONE_KEY[tone] ?? 'muted'];
const dash = (dashed: boolean, pattern = '6 4') => (dashed ? ` stroke-dasharray="${pattern}"` : '');

/** The map as it stands, as an image: same boxes, links, selection and fading as on screen. */
export function servicesSvg(view: ServicesView, palette: ExportPalette, header: ExportHeader): Svg {
  const body = [
    ...regionsSvg(view, palette),
    ...edgesSvg(view, palette),
    ...stripSvg(view.strip, palette),
    ...nodesSvg(view, palette),
  ].join('');
  const size = { width: view.layout.width, height: view.layout.height + (view.strip?.extra ?? 0) };
  return frame(body, size, header, palette);
}

function regionsSvg(view: ServicesView, p: ExportPalette): string[] {
  return view.graph.nodes
    .filter((n) => n.kind === 'region')
    .flatMap((r) => {
      const at = view.layout.nodes.get(r.id);
      const size = view.layout.sizes.get(r.id);
      if (!at || !size) return [];
      const title = esc(fit(r.label, size.width - 140, 13));
      const stroke = view.isFocused(r) ? p.brand : p.border;
      return [
        `<g opacity="${view.dimRegion(r) ? 0.4 : 1}">` +
          `<rect x="${at.x}" y="${at.y}" width="${size.width}" height="${size.height}" rx="8" fill="${p.track}" stroke="${stroke}"${dash(r.dashed)}/>` +
          `<circle cx="${at.x + 20}" cy="${at.y + 24}" r="4" fill="${toneColor(p, r.tone)}"/>` +
          `<text x="${at.x + 32}" y="${at.y + 28}" font-size="13" font-weight="600" fill="${p.fg}">${title}` +
          `<tspan font-size="11" font-weight="400" fill="${p.muted}" dx="8">${esc(r.sub)}</tspan></text></g>`,
      ];
    });
}

function edgesSvg(view: ServicesView, p: ExportPalette): string[] {
  const { graph, layout } = view;
  const lines = graph.edges.map((e) => {
    const stroke = resolveColor(edgeStroke(e));
    return `<path d="${edgePath(graph, layout, e)}" fill="none" stroke="${stroke}" stroke-opacity="${edgeOpacity(e)}" stroke-width="${edgeWidth(e)}" opacity="${view.dimEdge(e) ? 0.12 : 1}"/>`;
  });
  const labels = graph.edges.flatMap((e) => {
    const at = edgeLabelAt(graph, layout, e);
    if (!at) return [];
    const w = e.label.length * 6.2 + 12;
    return [
      `<g opacity="${view.dimEdge(e) ? 0.12 : 1}"><rect x="${at.x - w / 2}" y="${at.y - 8}" width="${w}" height="16" rx="4" fill="${p.card}" stroke="${p.border}"/>` +
        `<text x="${at.x}" y="${at.y + 3.5}" text-anchor="middle" font-size="10" font-family="${esc(monoFamily())}" fill="${p.muted}">${esc(e.label)}</text></g>`,
    ];
  });
  return [...lines, ...labels];
}

function stripSvg(strip: PlacementStrip | null, p: ExportPalette): string[] {
  if (!strip) return [];
  const mid = CHIP_H / 2;
  const lines = strip.lines.map(
    (line) =>
      `<path d="${line}" fill="none" stroke="${p.muted}" stroke-opacity="0.6"${dash(true, '2 4')}/>`,
  );
  const chips = strip.chips.map(
    (c) =>
      `<rect x="${c.x}" y="${c.y}" width="${CHIP_W}" height="${CHIP_H}" rx="6" fill="${p.card}" stroke="${p.border}"${dash(true, '4 3')}/>` +
      `<circle cx="${c.x + 14}" cy="${c.y + mid}" r="3" fill="${toneColor(p, c.tone)}"/>` +
      `<text x="${c.x + 24}" y="${c.y + mid + 4}" font-size="11" font-family="${esc(monoFamily())}" fill="${p.fg}">${esc(fit(c.label, CHIP_W - 60, 11))}</text>` +
      `<text x="${c.x + CHIP_W - 12}" y="${c.y + mid + 4}" text-anchor="end" font-size="11" fill="${p.muted}">×${c.count}</text>`,
  );
  const first = strip.chips[0];
  const caption = esc(`${strip.appName} runs on`);
  return [
    ...lines,
    ...chips,
    `<text x="${first.x}" y="${first.y + CHIP_H + 20}" font-size="12" fill="${p.muted}">${caption}</text>`,
  ];
}

function nodeOpacity(view: ServicesView, n: GraphNode): number {
  if (view.dimNode(n)) return 0.15;
  return n.muted ? 0.75 : 1;
}

function nodesSvg(view: ServicesView, p: ExportPalette): string[] {
  return view.graph.nodes
    .filter((n) => n.kind !== 'region')
    .flatMap((n) => {
      const at = view.layout.nodes.get(n.id);
      if (!at) return [];
      const kind = n.kind === 'internet' || n.kind === 'pill' ? pillSvg : cardSvg;
      return [`<g opacity="${nodeOpacity(view, n)}">${kind(n, at, view.isFocused(n), p)}</g>`];
    });
}

function pillSvg(n: GraphNode, at: Point, focused: boolean, p: ExportPalette): string {
  const pill = n.kind === 'pill';
  const textX = pill ? at.x + 30 : at.x + n.width / 2;
  const anchor = pill ? '' : ' text-anchor="middle"';
  const dot = pill
    ? `<circle cx="${at.x + 18}" cy="${at.y + n.height / 2}" r="4" fill="${toneColor(p, n.tone)}"/>`
    : '';
  const family = pill ? ` font-family="${esc(monoFamily())}"` : '';
  return (
    `<rect x="${at.x}" y="${at.y}" width="${n.width}" height="${n.height}" rx="6" fill="${p.card}" stroke="${focused ? p.brand : p.border}"${dash(n.dashed)}/>` +
    dot +
    `<text x="${textX}" y="${at.y + n.height / 2 + 4.5}"${anchor}${family} font-size="13" font-weight="500" fill="${p.fg}">${esc(fit(n.label, n.width - 40, 13))}</text>`
  );
}

function cardStroke(n: GraphNode, focused: boolean, p: ExportPalette): string {
  if (focused) return p.brand;
  return n.center ? p.muted : p.border;
}

function cardSvg(n: GraphNode, at: Point, focused: boolean, p: ExportPalette): string {
  const top = at.y + n.height / 2 - 6;
  const bottom = top + 20;
  const right = at.x + n.width - 12;
  const replicas =
    n.replicas > 1
      ? `<text x="${right}" y="${top}" text-anchor="end" font-size="11" font-family="${esc(monoFamily())}" fill="${p.muted}">×${n.replicas}</text>`
      : '';
  const problems = n.problems
    ? `<text x="${right}" y="${bottom}" text-anchor="end" font-size="11" font-weight="500" fill="${p.err}">${n.problems}</text>`
    : '';
  const word = esc(toneWord(n.tone));
  const sub = esc(fit(n.sub, n.width - 110 - (n.problems ? 24 : 0), 11));
  return (
    `<rect x="${at.x}" y="${at.y}" width="${n.width}" height="${n.height}" rx="6" fill="${n.muted ? p.track : p.card}" stroke="${cardStroke(n, focused, p)}"${dash(n.dashed)}/>` +
    `<text x="${at.x + 12}" y="${top}" font-size="13" font-weight="600" font-family="${esc(monoFamily())}" fill="${p.fg}">${esc(fit(n.label, n.width - 56, 13))}</text>` +
    `<circle cx="${at.x + 16}" cy="${bottom - 4}" r="3.5" fill="${toneColor(p, n.tone)}"/>` +
    `<text x="${at.x + 26}" y="${bottom}" font-size="11" fill="${p.muted}"><tspan fill="${toneColor(p, n.tone)}" font-weight="500">${word}</tspan><tspan dx="8">${sub}</tspan></text>` +
    replicas +
    problems
  );
}
