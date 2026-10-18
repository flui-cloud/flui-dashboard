import { TopologyAppDto } from '../../../core/api/model/topologyAppDto';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyServerDto } from '../../../core/api/model/topologyServerDto';
import { TopologyColorBy, TopologyFocus, TopologyGroupBy } from './topology-state';

export const FULL_PCT = 90;

export type NetworkKind = 'flui' | 'flui-waiting' | 'private' | 'public';

export interface Tile {
  server: TopologyServerDto;
  /** Short name: the node name without its cluster's prefix. */
  label: string;
  value: number | null;
  valueText: string;
  network: NetworkKind;
  /** Replicas of the focused app here, 0 when none or nothing is focused. */
  replicas: number;
  dimmed: boolean;
  focused: boolean;
}

export type TileDensity = 'card' | 'medium' | 'compact';

export interface TileGroup {
  key: string;
  name: string;
  meta: string;
  density: TileDensity;
  columns: number;
  tiles: Tile[];
  replicas: number;
  dimmed: boolean;
  clusterId: string | null;
}

export function networkOf(server: TopologyServerDto): NetworkKind {
  if (server.fluiNetwork === 'active') return 'flui';
  if (server.fluiNetwork === 'pending' || server.fluiNetwork === 'stale') return 'flui-waiting';
  return server.privateNetwork ? 'private' : 'public';
}

export function valueOf(server: TopologyServerDto, colorBy: TopologyColorBy): number | null {
  if (colorBy === 'pods' || colorBy === 'network') return server.podCount;
  const capacity = server.capacity;
  if (!capacity) return null;
  return colorBy === 'cpu' ? capacity.usedCpuPct : capacity.usedMemPct;
}

function valueText(server: TopologyServerDto, colorBy: TopologyColorBy): string {
  if (colorBy === 'network') return NETWORK_SHORT[networkOf(server)];
  const value = valueOf(server, colorBy);
  if (value === null) return '—';
  return colorBy === 'pods' ? `${value}` : `${Math.round(value)}%`;
}

const NETWORK_SHORT: Record<NetworkKind, string> = {
  flui: 'Flui',
  'flui-waiting': 'Wait',
  private: 'Private',
  public: 'Public',
};

export const NETWORK_LABEL: Record<NetworkKind, string> = {
  flui: 'On the Flui network',
  'flui-waiting': 'Flui network not answering',
  private: 'Provider private network only',
  public: 'Public address only',
};

/** The name without what every server of its cluster shares in front. */
export function shortName(name: string, siblings: string[]): string {
  if (siblings.length < 2) return name;
  let prefix = siblings[0];
  for (const other of siblings) {
    while (prefix && !other.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  const cut = prefix.lastIndexOf('-') + 1;
  const short = name.slice(cut);
  if (short.length >= 2 && !/^\d+$/.test(short)) return short;
  return name.split('-').slice(-2).join('-');
}

/**
 * Most fleets have a handful of servers: those get a card each, with room for
 * the whole name. Only a crowded group shrinks to a compact tile.
 */
export function densityOf(count: number): TileDensity {
  if (count <= 6) return 'card';
  return count <= 20 ? 'medium' : 'compact';
}

const MAX_COLUMNS: Record<TileDensity, number> = { card: 3, medium: 6, compact: 99 };

/** Columns that keep a group roughly wider than tall. */
export function columnsFor(count: number): number {
  return Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * 1.6))));
}

function replicasOn(apps: TopologyAppDto[] | undefined, serverId: string): number {
  return (apps ?? []).reduce((sum, a) => sum + (a.replicas.find((r) => r.serverId === serverId)?.count ?? 0), 0);
}

export function tileGroups(
  t: TopologyResponseDto,
  colorBy: TopologyColorBy,
  groupBy: TopologyGroupBy,
  focus: TopologyFocus | null,
  project: string | null = null,
): TileGroup[] {
  const focused = focus?.type === 'app' ? t.apps.find((a) => a.id === focus.id) : undefined;
  // A selected app wins; otherwise a project filter lights every server its apps run on.
  let members: TopologyAppDto[] = [];
  if (focused) members = [focused];
  else if (project) members = t.apps.filter((a) => a.projectId === project);
  const app = members.length ? members : undefined;
  const focusCluster = focus?.type === 'cluster' ? focus.id : null;
  const clusterName = new Map(t.clusters.map((c) => [c.id, c.name]));
  const keyOf = (s: TopologyServerDto) => (groupBy === 'provider' ? s.provider : s.clusterId);

  const buckets = new Map<string, TopologyServerDto[]>();
  for (const server of t.servers) {
    buckets.set(keyOf(server), [...(buckets.get(keyOf(server)) ?? []), server]);
  }

  return [...buckets.entries()].map(([key, servers]) => {
    const names = servers.map((s) => s.nodeName);
    const tiles = servers.map<Tile>((server) => {
      const replicas = replicasOn(app, server.id);
      return {
        server,
        label: shortName(server.nodeName, names),
        value: valueOf(server, colorBy),
        valueText: valueText(server, colorBy),
        network: networkOf(server),
        replicas,
        focused: focus?.type === 'server' && focus.id === server.id,
        dimmed:
          (!!app && replicas === 0) ||
          (!!focusCluster && server.clusterId !== focusCluster) ||
          (focus?.type === 'server' && focus.id !== server.id),
      };
    });
    const memory = servers
      .map((s) => s.capacity?.usedMemPct)
      .filter((m): m is number => typeof m === 'number');
    const average = memory.length
      ? `avg ${Math.round(memory.reduce((a, b) => a + b, 0) / memory.length)}%`
      : 'no usage data';
    const replicas = tiles.reduce((sum, tile) => sum + tile.replicas, 0);
    const density = densityOf(servers.length);
    return {
      key,
      name: groupBy === 'provider' ? key : (clusterName.get(key) ?? key),
      meta: `${servers.length} server${servers.length === 1 ? '' : 's'} · ${average}`,
      density,
      columns: Math.min(MAX_COLUMNS[density], columnsFor(servers.length)),
      tiles,
      replicas,
      clusterId: groupBy === 'cluster' ? key : null,
      dimmed: (!!app && replicas === 0) || (!!focusCluster && groupBy === 'cluster' && key !== focusCluster),
    };
  });
}

export interface SpreadRow {
  clusterId: string;
  cluster: string;
  segments: { serverId: string; label: string; count: number; piled: boolean }[];
  replicas: number;
  piledOn: string | null;
}

/**
 * Where a focused app's replicas sit, cluster by cluster, and where more than
 * half of a cluster's replicas pile on one server.
 */
export function replicaSpread(t: TopologyResponseDto, appId: string): SpreadRow[] {
  const app = t.apps.find((a) => a.id === appId);
  if (!app) return [];
  const group = t.apps.filter((a) => a.groupKey === app.groupKey);
  const server = new Map(t.servers.map((s) => [s.id, s]));
  return group.map((member) => {
    const total = member.replicaCount;
    const segments = member.replicas.map((r) => ({
      serverId: r.serverId,
      label: server.get(r.serverId)?.nodeName ?? r.serverId,
      count: r.count,
      piled: total >= 2 && r.count > total / 2,
    }));
    const piled = segments.find((s) => s.piled);
    return {
      clusterId: member.clusterId,
      cluster: t.clusters.find((c) => c.id === member.clusterId)?.name ?? '',
      segments,
      replicas: total,
      piledOn: piled ? piled.label : null,
    };
  });
}

export interface FullestRow {
  server: TopologyServerDto;
  /** The name without the part every server of its cluster shares. */
  label: string;
  value: number;
  cluster: string;
}

export function fullestServers(
  t: TopologyResponseDto,
  colorBy: TopologyColorBy,
  limit = 7,
): FullestRow[] {
  const by = colorBy === 'network' ? 'memory' : colorBy;
  const siblings = (clusterId: string) => t.servers.filter((s) => s.clusterId === clusterId).map((s) => s.nodeName);
  return t.servers
    .map((server) => ({
      server,
      label: shortName(server.nodeName, siblings(server.clusterId)),
      value: valueOf(server, by),
      cluster: t.clusters.find((c) => c.id === server.clusterId)?.name ?? '',
    }))
    .filter((row): row is FullestRow => row.value !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export interface ClusterConnection {
  clusterId: string;
  name: string;
  kind: 'tunnel' | 'public-address' | 'off';
  crossProvider: boolean;
  appLinks: number;
}

/** How the control reaches each other cluster, and how many app links cross to it. */
export function clusterConnections(t: TopologyResponseDto): {
  control: { id: string; name: string; provider: string } | null;
  connections: ClusterConnection[];
} {
  const control = t.clusters.find((c) => c.type === 'control') ?? null;
  const appLinks = (id: string) =>
    t.clusterLinks
      .filter((l) => l.fromClusterId === id || l.toClusterId === id)
      .reduce((sum, l) => sum + l.linkCount, 0);
  return {
    control: control ? { id: control.id, name: control.name, provider: control.provider } : null,
    connections: t.clusters
      .filter((c) => c.id !== control?.id)
      .map((c) => ({
        clusterId: c.id,
        name: c.name,
        kind: c.overlay,
        crossProvider: !!control && control.provider !== c.provider,
        appLinks: appLinks(c.id),
      })),
  };
}
