import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { StatusTone, toneOf } from './topology-format';
import { GraphLayout, Point } from './topology-layout';

export const CHIP_W = 168;
export const CHIP_H = 34;
const CHIP_GAP = 12;
const STRIP_GAP = 56;

export interface PlacementChip {
  serverId: string;
  label: string;
  count: number;
  tone: StatusTone;
  x: number;
  y: number;
}

export interface PlacementStrip {
  appId: string;
  appName: string;
  chips: PlacementChip[];
  lines: string[];
  /** How far below the graph the strip reaches, so fitting the view keeps it in sight. */
  extra: number;
}

/**
 * The servers one app's replicas run on, as a row under the map, each tied to
 * the app by a dotted placement line when nothing stands in the way.
 */
export function placementStrip(
  t: TopologyResponseDto,
  layout: GraphLayout,
  appId: string,
  size: { width: number; height: number },
  others: { x: number; y: number; width: number; height: number }[] = [],
): PlacementStrip | null {
  const app = t.apps.find((a) => a.id === appId);
  const at = layout.nodes.get(appId);
  if (!app || !at || !app.replicas.length) return null;
  const servers = new Map(t.servers.map((s) => [s.id, s]));
  const total = app.replicas.length * CHIP_W + (app.replicas.length - 1) * CHIP_GAP;
  const centre = at.x + size.width / 2;
  const left = Math.max(0, Math.min(centre - total / 2, Math.max(0, layout.width - total)));
  const y = layout.height + STRIP_GAP;
  const from: Point = { x: centre, y: at.y + size.height };
  const chips = app.replicas.map((r, i) => {
    const server = servers.get(r.serverId);
    return {
      serverId: r.serverId,
      label: server?.nodeName ?? r.serverId,
      count: r.count,
      tone: toneOf(server?.status),
      x: left + i * (CHIP_W + CHIP_GAP),
      y,
    };
  });
  // A line that would run under another card leaves broken fragments: the strip then stands alone.
  const blocked = others.some(
    (o) => o.x < at.x + size.width && o.x + o.width > at.x && o.y >= at.y + size.height && o.y < y,
  );
  // One trunk down from the app, a bar along the strip, a short drop to each server: a tree, not a fan.
  const bus = y - 14;
  const centres = chips.map((c) => c.x + CHIP_W / 2);
  const lines = blocked
    ? []
    : [
        `M${from.x},${from.y} V${bus}`,
        ...(chips.length > 1 ? [`M${Math.min(...centres, from.x)},${bus} H${Math.max(...centres, from.x)}`] : [`M${from.x},${bus} H${centres[0]}`]),
        ...centres.map((x) => `M${x},${bus} V${y}`),
      ];
  return { appId, appName: app.displayName, chips, lines, extra: STRIP_GAP + CHIP_H + 28 };
}
