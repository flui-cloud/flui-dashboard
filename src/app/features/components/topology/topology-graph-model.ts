import { TopologyAppDto } from '../../../core/api/model/topologyAppDto';
import { TopologyLinkDto } from '../../../core/api/model/topologyLinkDto';
import { StatusTone, toneOf } from './topology-format';
import { TopologyFocus, TopologyViewState } from './topology-state';

export const FAILING_ERROR_PCT = 5;
/** Above this many nodes a level collapses to the one above it. */
export const MAX_NODES = 40;

export type GraphNodeKind = 'internet' | 'cluster' | 'pill' | 'stack' | 'app' | 'platform' | 'region';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  sub: string;
  tone: StatusTone;
  width: number;
  height: number;
  focus: TopologyFocus | null;
  /** Where a double click leads: one level down. */
  drill: Partial<TopologyViewState> | null;
  dashed: boolean;
  dots: StatusTone[];
  replicas: number;
  category: string | null;
  problems: number;
  /** Requests per second coming in from the Internet, when measured. */
  ingress: number | null;
  ingressFailing: boolean;
  /** The app the `app` level is drawn around. */
  center: boolean;
  /** The region (a cluster drawn as a box) this node sits in. */
  parent: string | null;
  /** One of the apps Flui itself runs: drawn quieter than the user's. */
  muted: boolean;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  measured: boolean;
  failing: boolean;
  rps: number | null;
  count: number;
  focus: TopologyFocus | null;
}

export interface TopologyGraph {
  level: TopologyViewState['level'];
  nodes: GraphNode[];
  edges: GraphEdge[];
  collapsedFrom: TopologyViewState['level'] | null;
  /** Too many to draw: only the problems and what they touch are shown. */
  filtered?: boolean;
  /** Crowded but drawn in full: its problems and their neighbours can be shown instead. */
  filterable?: boolean;
}

const SIZE: Record<GraphNodeKind, [number, number]> = {
  internet: [128, 44],
  cluster: [232, 84],
  pill: [168, 40],
  stack: [216, 76],
  app: [196, 64],
  platform: [196, 64],
  region: [0, 0],
};

export const INTERNET = 'internet';

export function node(kind: GraphNodeKind, id: string, over: Partial<GraphNode>): GraphNode {
  const [width, height] = SIZE[kind];
  return {
    id, kind, label: '', sub: '', tone: 'healthy', width, height, focus: null, drill: null,
    dashed: false, dots: [], replicas: 0, category: null, problems: 0,
    ingress: null, ingressFailing: false, center: false, parent: null, muted: false, ...over,
  };
}

export function isFailing(link: TopologyLinkDto, target?: TopologyAppDto): boolean {
  return (link.traffic.errorPct ?? 0) >= FAILING_ERROR_PCT || target?.status === 'error';
}

export function internetNode(): GraphNode {
  return node('internet', INTERNET, { label: 'Internet', sub: 'through the gateway' });
}

/** A bundle fails when its traffic does, not when one route of many does. */
export function weightedErrorPct(links: TopologyLinkDto[]): number {
  const measured = links.filter((l) => l.traffic.measured && l.traffic.rps);
  const total = measured.reduce((s, l) => s + (l.traffic.rps ?? 0), 0);
  if (!total) return 0;
  return measured.reduce((s, l) => s + (l.traffic.rps ?? 0) * (l.traffic.errorPct ?? 0), 0) / total;
}

export function sumRps(links: TopologyLinkDto[]): number | null {
  const measured = links.filter((l) => l.traffic.measured && l.traffic.rps !== null);
  return measured.length ? measured.reduce((s, l) => s + (l.traffic.rps ?? 0), 0) : null;
}

function bundleLabel(fromInternet: boolean, single: TopologyLinkDto | null, count: number): string {
  if (fromInternet) return count === 1 ? 'HTTPS' : `HTTPS · ${count} routes`;
  return single ? single.label : `${count} links`;
}

/** The end an app belongs to when it is one of `ids`; the Internet is always its own end. */
export function endsWithin(ids: { has(id: string): boolean }) {
  return (id: string | undefined, internet: boolean): string | null => {
    if (internet) return INTERNET;
    return id && ids.has(id) ? id : null;
  };
}

/** Edges grouped by the pair of nodes their ends belong to. */
export function bundle(
  links: TopologyLinkDto[],
  endOf: (appId: string | undefined, internet: boolean) => string | null,
  apps: Map<string, TopologyAppDto>,
): GraphEdge[] {
  return bundleAcross(
    links,
    (appId, internet) => {
      const end = endOf(appId, internet);
      return end ? [end] : [];
    },
    apps,
  );
}

/** {@link bundle} for an app drawn more than once: a link joins every node of one end to every node of the other. */
export function bundleAcross(
  links: TopologyLinkDto[],
  endsOf: (appId: string | undefined, internet: boolean) => string[],
  apps: Map<string, TopologyAppDto>,
): GraphEdge[] {
  const groups = new Map<string, TopologyLinkDto[]>();
  for (const link of links) {
    for (const from of endsOf(link.from.appId, link.from.kind === 'internet')) {
      for (const to of endsOf(link.to.appId, false)) {
        if (from === to) continue;
        const key = `${from}>${to}`;
        groups.set(key, [...(groups.get(key) ?? []), link]);
      }
    }
  }
  return [...groups.entries()].map(([key, group]) => {
    const [from, to] = key.split('>');
    const rps = sumRps(group);
    const single = group.length === 1 ? group[0] : null;
    return {
      id: key,
      from,
      to,
      label: bundleLabel(from === INTERNET, single, group.length),
      measured: rps !== null,
      failing: single
        ? isFailing(single, apps.get(single.to.appId ?? ''))
        : weightedErrorPct(group) >= FAILING_ERROR_PCT,
      rps,
      count: group.length,
      focus: single ? { type: 'link', id: single.id } : null,
    };
  });
}


export function appNode(a: TopologyAppDto, sub: string, center = false): GraphNode {
  return node('app', a.id, {
    label: a.displayName,
    sub,
    tone: toneOf(a.status),
    focus: { type: 'app', id: a.id },
    drill: { view: 'services', level: 'app', app: a.id, cluster: a.clusterId, focus: { type: 'app', id: a.id } },
    replicas: a.replicaCount,
    category: a.category,
    center,
    muted: a.kind === 'system',
  });
}
