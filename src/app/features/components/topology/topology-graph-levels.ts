import { TopologyAppDto } from '../../../core/api/model/topologyAppDto';
import { TopologyLinkDto } from '../../../core/api/model/topologyLinkDto';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyServerDto } from '../../../core/api/model/topologyServerDto';
import { StatusTone, categoryLabel, toneOf } from './topology-format';
import { TopologyViewState } from './topology-state';
import {
  GraphNode,
  INTERNET,
  TopologyGraph,
  appNode,
  bundle,
  bundleAcross,
  endsWithin,
  internetNode,
  node,
  sumRps,
  weightedErrorPct,
  FAILING_ERROR_PCT,
} from './topology-graph-model';

export function fleetGraph(t: TopologyResponseDto): TopologyGraph {
  const apps = new Map(t.apps.map((a) => [a.id, a]));
  const nodes: GraphNode[] = t.clusters.map((c) =>
    node('cluster', c.id, {
      label: c.name,
      sub: `${c.provider} · ${c.region} · ${c.counts.apps} apps`,
      tone: toneOf(c.status),
      focus: { type: 'cluster', id: c.id },
      drill: { level: 'cluster', cluster: c.id },
      dashed: c.overlay === 'public-address',
      problems: c.counts.errors + c.counts.warnings,
    }),
  );
  const ingress = t.links.filter((l) => l.from.kind === 'internet' && l.traffic.measured);
  const edges = bundle(ingress, (appId, internet) => (internet ? INTERNET : apps.get(appId ?? '')?.clusterId ?? null), apps);
  const crossLinks = t.links.filter((l) => l.crossCluster);
  edges.push(...bundle(crossLinks, (appId) => apps.get(appId ?? '')?.clusterId ?? null, apps));
  if (ingress.length) nodes.unshift(internetNode());
  return { level: 'fleet', nodes, edges, collapsedFrom: null };
}

/**
 * Every app, inside a box for its cluster, the Internet reaching the ones
 * it reaches. What a fleet of a few servers looks like; past the node limit the
 * fleet is drawn by cluster instead.
 */
export function appsGraph(t: TopologyResponseDto, boxBy: TopologyViewState['boxBy'] = 'cluster'): TopologyGraph {
  if (boxBy === 'server') return serversGraph(t);
  const apps = new Map(t.apps.map((a) => [a.id, a]));
  const nodes = boxBy === 'project' ? projectBoxes(t) : clusterBoxes(t);
  const endOf = (id: string | undefined, internet: boolean): string | null => {
    if (internet) return INTERNET;
    const app = apps.get(id ?? '');
    return app ? drawnAs(app) : null;
  };
  const edges = bundle(t.links, endOf, apps);
  if (edges.some((e) => e.from === INTERNET)) nodes.unshift(internetNode());
  return { level: 'fleet', nodes, edges, collapsedFrom: null };
}

/**
 * Every server in a box, with the apps that have a copy on it: an app running
 * on three servers is drawn three times, and a link reaches each of its copies.
 */
function serversGraph(t: TopologyResponseDto): TopologyGraph {
  const apps = new Map(t.apps.map((a) => [a.id, a]));
  const copies = new Map<string, string[]>();
  const nodes = t.servers.flatMap((s) => serverBox(t, s, copies));
  const endsOf = (id: string | undefined, internet: boolean): string[] =>
    internet ? [INTERNET] : (copies.get(id ?? '') ?? []);
  const edges = bundleAcross(t.links, endsOf, apps);
  if (edges.some((e) => e.from === INTERNET)) nodes.unshift(internetNode());
  return { level: 'fleet', nodes, edges, collapsedFrom: null };
}

function serverBox(t: TopologyResponseDto, s: TopologyServerDto, copies: Map<string, string[]>): GraphNode[] {
  const on = t.apps.filter((a) => copiesOn(a, s.id) > 0);
  const where = [clusterNameOf(t, s.clusterId), s.region ?? s.provider, s.serverType].filter(Boolean).join(' · ');
  const common = { label: s.nodeName, tone: toneOf(s.status), focus: { type: 'server' as const, id: s.id } };
  if (!on.length) return [node('cluster', `server:${s.id}`, { ...common, sub: `${where} · no apps` })];
  const box = node('region', `server:${s.id}`, { ...common, sub: where, problems: troubled(on) });
  const copy = (n: GraphNode, of: TopologyAppDto[]): GraphNode => {
    const id = `${n.id}@${s.id}`;
    for (const a of of) copies.set(a.id, [...(copies.get(a.id) ?? []), id]);
    return { ...n, id, parent: box.id };
  };
  const users = on
    .filter((a) => a.kind !== 'system')
    .map((a) => copy({ ...appNode(a, stackOrCategory(t, a)), replicas: copiesOn(a, s.id) }, [a]));
  const system = on.filter((a) => a.kind === 'system');
  const platforms = system.length ? [copy(platformNode(t, s.clusterId, false, system), system)] : [];
  return [box, ...users, ...platforms];
}

const copiesOn = (a: TopologyAppDto, serverId: string) =>
  a.replicas.filter((r) => r.serverId === serverId).reduce((n, r) => n + r.count, 0);

/** Under each app, its stack when it shares one, else what kind of app it is. */
function stackOrCategory(t: TopologyResponseDto, a: TopologyAppDto): string {
  const stack = t.stacks.find((s) => s.id === a.stackId);
  return stack && stack.appIds.length > 1 && stack.name !== a.displayName ? stack.name : categoryLabel(a.category);
}

const clusterNameOf = (t: TopologyResponseDto, id: string) => t.clusters.find((c) => c.id === id)?.name ?? '';
const troubled = (apps: TopologyAppDto[]) => apps.filter((a) => a.status === 'error' || a.status === 'warning').length;

function projectBoxes(t: TopologyResponseDto): GraphNode[] {
  const boxes = [
    ...(t.projects ?? []).map((p) => ({ id: p.id, name: p.name })),
    { id: NO_PROJECT, name: 'No project' },
    { id: PLATFORM, name: 'Platform' },
  ];
  const boxOf = (a: TopologyAppDto) => (a.kind === 'system' ? PLATFORM : (a.projectId ?? NO_PROJECT));
  return boxes.flatMap((box) => {
    const own = t.apps.filter((a) => boxOf(a) === box.id);
    if (!own.length) return [];
    const region = node('region', `region:${box.id}`, {
      label: box.name,
      sub: `${own.length} app${own.length === 1 ? '' : 's'}`,
      tone: worstTone(own.map((a) => toneOf(a.status))),
      problems: troubled(own),
    });
    const users = own.filter((a) => a.kind !== 'system').map((a) => appNode(a, clusterNameOf(t, a.clusterId)));
    const platforms = [...new Set(own.filter((a) => a.kind === 'system').map((a) => a.clusterId))].map((clusterId) =>
      platformNode(t, clusterId, true),
    );
    return [region, ...[...users, ...platforms].map((n) => ({ ...n, parent: region.id }))];
  });
}

function clusterBoxes(t: TopologyResponseDto): GraphNode[] {
  return t.clusters.flatMap((c) => {
    const own = t.apps.filter((a) => a.clusterId === c.id);
    const common = {
      label: c.name,
      tone: toneOf(c.status),
      focus: { type: 'cluster' as const, id: c.id },
      drill: { level: 'cluster' as const, cluster: c.id },
      dashed: c.overlay === 'public-address',
      problems: c.counts.errors + c.counts.warnings,
    };
    if (!own.length) return [node('cluster', c.id, { ...common, sub: `${c.provider} · ${c.region} · no apps` })];
    const region = node('region', `region:${c.id}`, { ...common, sub: `${c.provider} · ${c.region}` });
    const users = own.filter((a) => a.kind !== 'system').map((a) => appNode(a, stackOrCategory(t, a)));
    const platform = own.some((a) => a.kind === 'system') ? [platformNode(t, c.id, false)] : [];
    return [region, ...[...users, ...platform].map((n) => ({ ...n, parent: region.id }))];
  });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const platformNodeId = (clusterId: string) => `platform:${clusterId}`;

/** Where an app is drawn on the fleet map: on its own, or inside its cluster's platform node. */
const drawnAs = (a: TopologyAppDto) => (a.kind === 'system' ? platformNodeId(a.clusterId) : a.id);

/**
 * The apps Flui runs on one cluster, drawn as one node: they are the platform
 * the user's apps stand on, and a dozen of them would crowd the map. The
 * cluster level still draws each one.
 */
function platformNode(
  t: TopologyResponseDto,
  clusterId: string,
  named: boolean,
  own = t.apps.filter((a) => a.clusterId === clusterId && a.kind === 'system'),
): GraphNode {
  const count = plural(own.length, 'app');
  return node('platform', platformNodeId(clusterId), {
    label: 'Flui platform',
    sub: named ? `${clusterNameOf(t, clusterId)} · ${count}` : count,
    tone: worstTone(own.map((a) => toneOf(a.status))),
    focus: { type: 'platform', id: clusterId },
    drill: { view: 'services', level: 'cluster', cluster: clusterId, focus: null },
    category: 'infra',
    problems: troubled(own),
    muted: true,
  });
}

const NO_PROJECT = 'no-project';
const PLATFORM = 'platform';
const TONE_ORDER: StatusTone[] = ['error', 'degraded', 'pending', 'healthy'];
function worstTone(tones: StatusTone[]): StatusTone {
  return TONE_ORDER.find((t) => tones.includes(t)) ?? 'healthy';
}

/** The ids a project filter keeps lit: its apps, the boxes holding them, and the stacks and clusters they run in. */
export function projectLit(t: TopologyResponseDto, graph: TopologyGraph, projectId: string): Set<string> {
  const own = t.apps.filter((a) => a.projectId === projectId);
  const ids = new Set<string>(own.flatMap((a) => [a.id, a.stackId, a.clusterId, `region:${a.clusterId}`, `region:${projectId}`, `pill:${a.clusterId}`]));
  const ownIds = new Set(own.map((a) => a.id));
  for (const n of graph.nodes) {
    if (n.kind === 'internet') ids.add(n.id);
    if (n.focus?.type === 'app' && ownIds.has(n.focus.id)) {
      ids.add(n.id);
      if (n.parent) ids.add(n.parent);
    }
  }
  return ids;
}

export function clusterGraph(t: TopologyResponseDto, clusterId: string): TopologyGraph {
  const apps = new Map(t.apps.map((a) => [a.id, a]));
  const stacks = t.stacks.filter((s) => s.clusterId === clusterId);
  const stackOf = new Map(t.apps.map((a) => [a.id, a.stackId]));
  const nodes: GraphNode[] = stacks.map((s) => {
    const members = s.appIds.map((id) => apps.get(id)).filter((a): a is TopologyAppDto => !!a);
    return node('stack', s.id, {
      label: s.name,
      sub: `${members.length} app${members.length === 1 ? '' : 's'} · ×${members.reduce((n, a) => n + a.replicaCount, 0)}`,
      tone: toneOf(s.status),
      focus: { type: 'stack', id: s.id },
      drill: { level: 'stack', cluster: clusterId, focus: { type: 'stack', id: s.id } },
      dots: members.map((a) => toneOf(a.status)),
      problems: members.filter((a) => a.status === 'error' || a.status === 'warning').length,
    });
  });
  // Ingress is a badge on each stack here, not an edge: thirteen lines from one
  // node is the hairball the cluster level exists to avoid.
  for (const n of nodes) {
    const ingress = t.links.filter(
      (l) => l.from.kind === 'internet' && stackOf.get(l.to.appId ?? '') === n.id,
    );
    n.ingress = sumRps(ingress);
    n.ingressFailing = ingress.length > 0 && weightedErrorPct(ingress) >= FAILING_ERROR_PCT;
  }
  const touching = t.links.filter((l) => {
    if (l.from.kind === 'internet') return false;
    const ends = [l.from.appId, l.to.appId].map((id) => apps.get(id ?? '')?.clusterId);
    return ends.includes(clusterId);
  });
  const others = new Set<string>();
  const endOf = (appId: string | undefined, internet: boolean): string | null => {
    if (internet) return INTERNET;
    const app = apps.get(appId ?? '');
    if (!app) return null;
    if (app.clusterId === clusterId) return stackOf.get(app.id) ?? null;
    others.add(app.clusterId);
    return `pill:${app.clusterId}`;
  };
  const edges = bundle(touching, endOf, apps);
  for (const id of [...others].sort((a, b) => a.localeCompare(b))) {
    const c = t.clusters.find((x) => x.id === id);
    if (!c) continue;
    nodes.push(node('pill', `pill:${id}`, {
      label: c.name, sub: c.provider, tone: toneOf(c.status), focus: { type: 'cluster', id },
      drill: { level: 'cluster', cluster: id, focus: null }, dashed: c.overlay === 'public-address',
    }));
  }
  return { level: 'cluster', nodes, edges, collapsedFrom: null };
}

export function stackGraph(t: TopologyResponseDto, stackId: string): TopologyGraph {
  const apps = new Map(t.apps.map((a) => [a.id, a]));
  const stack = t.stacks.find((s) => s.id === stackId);
  const inside = new Set(stack?.appIds ?? []);
  const touching = t.links.filter((l) => inside.has(l.to.appId ?? '') || inside.has(l.from.appId ?? ''));
  const neighbours = new Set(
    touching.flatMap((l) => [l.from.appId, l.to.appId]).filter((id): id is string => !!id && !inside.has(id)),
  );
  const clusterName = (id: string) => t.clusters.find((c) => c.id === id)?.name ?? '';
  const nodes = [...inside, ...neighbours]
    .map((id) => apps.get(id))
    .filter((a): a is TopologyAppDto => !!a)
    .map((a) => appNode(a, inside.has(a.id) ? categoryLabel(a.category) : clusterName(a.clusterId)));
  const edges = bundle(touching, endsWithin(apps), apps);
  if (edges.some((e) => e.from === INTERNET)) nodes.unshift(internetNode());
  return { level: 'stack', nodes, edges, collapsedFrom: null };
}

/**
 * Every app within `hops` links of one, whichever way the links point. The
 * Internet counts as one more end, never as a way through to other apps.
 */
export function neighbourhood(t: TopologyResponseDto, appId: string, hops: number): Set<string> {
  const reached = new Set([appId]);
  let frontier = [appId];
  for (let step = 0; step < hops && frontier.length; step++) {
    frontier = oneStep(t, new Set(frontier), reached);
  }
  return reached;
}

/** The apps one link away from `frontier` not yet reached; they are added to `reached`. */
function oneStep(t: TopologyResponseDto, frontier: Set<string>, reached: Set<string>): string[] {
  const next: string[] = [];
  const reach = (here: string, there: string) => {
    if (here === INTERNET || !frontier.has(here) || reached.has(there)) return;
    reached.add(there);
    next.push(there);
  };
  for (const l of t.links) {
    const a = l.from.kind === 'internet' ? INTERNET : l.from.appId;
    const b = l.to.appId;
    if (!a || !b) continue;
    reach(a, b);
    reach(b, a);
  }
  return next;
}

/** One app in the middle: who calls it on the left, what it depends on to the right. */
export function appGraph(t: TopologyResponseDto, appId: string, hops: number): TopologyGraph {
  const apps = new Map(t.apps.map((a) => [a.id, a]));
  const centre = apps.get(appId)!;
  const inside = neighbourhood(t, appId, hops);
  const subOf = (a: TopologyAppDto) =>
    a.clusterId === centre.clusterId ? stackOrCategory(t, a) : clusterNameOf(t, a.clusterId);
  const nodes = [...inside]
    .map((id) => apps.get(id))
    .filter((a): a is TopologyAppDto => !!a)
    .map((a) => appNode(a, subOf(a), a.id === appId));
  const endOf = (l: TopologyLinkDto) => (l.from.kind === 'internet' ? INTERNET : (l.from.appId ?? ''));
  const touching = t.links.filter((l) => inside.has(l.to.appId ?? '') && inside.has(endOf(l)));
  const edges = bundle(touching, endsWithin(inside), apps);
  if (edges.some((e) => e.from === INTERNET)) nodes.unshift(internetNode());
  return { level: 'app', nodes, edges, collapsedFrom: null };
}
