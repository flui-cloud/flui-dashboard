import { MAX_NODES, isFailing, litBy, neighbourhood, projectLit, topologyGraph } from './topology-graph';
import { graphDigest } from './topology-layout';
import { DEFAULT_TOPOLOGY_STATE, TopologyViewState } from './topology-state';
import { topologyFixture } from './topology.fixture';

const state = (over: Partial<TopologyViewState>): TopologyViewState => ({
  ...DEFAULT_TOPOLOGY_STATE,
  view: 'services',
  ...over,
});

function withCrossLink() {
  const t = topologyFixture();
  t.links.push({
    id: 'a-web-asia>a-db', from: { kind: 'app', appId: 'a-web-asia' }, to: { kind: 'app', appId: 'a-db' },
    source: 'env-reference', label: ':5432', crossCluster: true, viaTunnel: false, routeHost: null, routePath: null, targetPort: null,
    traffic: { measured: false, rps: null, errorPct: null },
  });
  return t;
}

/** A fleet with more apps than one map can hold, all quiet and unlinked. */
function large<T extends ReturnType<typeof topologyFixture>>(t: T): T {
  const base = t.apps.find((a) => a.id === 'a-tools')!;
  for (let i = 0; i < MAX_NODES; i++) t.apps.push({ ...base, id: `quiet-${i}`, stackId: 'app:a-tools' });
  return t;
}

describe('the service map graph', () => {
  it('draws a small fleet as every app, each inside the box of its cluster', () => {
    const g = topologyGraph(withCrossLink(), state({ level: 'fleet' }));
    expect(g.nodes.filter((n) => n.kind === 'region').map((n) => n.id)).toEqual(['region:c-eu', 'region:c-asia']);
    expect(g.nodes.filter((n) => n.kind === 'app').map((n) => [n.id, n.parent])).toEqual([
      ['a-web', 'region:c-eu'],
      ['a-db', 'region:c-eu'],
      ['a-tools', 'region:c-eu'],
      ['a-web-asia', 'region:c-asia'],
    ]);
    expect(g.nodes[0].id).toBe('internet');
    expect(g.edges.map((e) => `${e.from}>${e.to}`).sort()).toEqual(['a-web-asia>a-db', 'a-web>a-db', 'internet>a-web']);
    expect(g.nodes.find((n) => n.id === 'region:c-asia')?.dashed).toBeTrue();
  });

  it('draws a cluster with no app as a plain cluster node, not an empty box', () => {
    const t = withCrossLink();
    t.apps = t.apps.filter((a) => a.clusterId !== 'c-asia');
    t.links = t.links.filter((l) => !l.crossCluster);
    const g = topologyGraph(t, state({ level: 'fleet' }));
    expect(g.nodes.find((n) => n.id === 'c-asia')?.kind).toBe('cluster');
  });

  it('boxes the apps by project on request, with a box for the apps in none', () => {
    const g = topologyGraph(withCrossLink(), state({ level: 'fleet', boxBy: 'project' }));
    expect(g.nodes.filter((n) => n.kind === 'region').map((n) => [n.id, n.label])).toEqual([
      ['region:p-shop', 'Shop'],
      ['region:no-project', 'No project'],
    ]);
    expect(g.nodes.filter((n) => n.parent === 'region:p-shop').map((n) => n.id)).toEqual(['a-web', 'a-db']);
    expect(g.nodes.find((n) => n.id === 'a-web-asia')?.sub).toBe('edge-asia');
  });

  it('draws a selected project alone: its apps, their boxes and the Internet reaching them', () => {
    const g = topologyGraph(withCrossLink(), state({ level: 'fleet', project: 'p-shop' }));
    expect(g.nodes.map((n) => n.id)).toEqual(['internet', 'region:c-eu', 'a-web', 'a-db']);
    expect(g.edges.map((e) => e.id).sort()).toEqual(['a-web>a-db', 'internet>a-web']);
  });

  it('draws a selected project alone when boxed by server, without the servers it does not use', () => {
    const g = topologyGraph(withCrossLink(), state({ level: 'fleet', boxBy: 'server', project: 'p-shop' }));
    expect(g.nodes.filter((n) => n.kind === 'region').map((n) => n.id)).toEqual(['server:s-1', 'server:s-2']);
    expect(g.nodes.some((n) => n.id.startsWith('a-tools') || n.id.startsWith('a-web-asia'))).toBeFalse();
  });

  it('keeps lit, for a project filter, its apps and where they run', () => {
    const t = withCrossLink();
    const g = topologyGraph(t, state({ level: 'fleet' }));
    const lit = projectLit(t, g, 'p-shop');
    expect(['a-web', 'a-db', 'region:c-eu'].every((id) => lit.has(id))).toBeTrue();
    expect(lit.has('a-tools')).toBeFalse();
    expect(lit.has('a-web-asia')).toBeFalse();
  });

  describe('boxed by server', () => {
    const byServer = (t = withCrossLink()) => topologyGraph(t, state({ level: 'fleet', boxBy: 'server' }));

    it('opens boxed by cluster unless asked', () => {
      expect(DEFAULT_TOPOLOGY_STATE.boxBy).toBe('cluster');
    });

    it('draws a box per server, named by its cluster, place and size', () => {
      const g = byServer();
      expect(g.nodes.filter((n) => n.kind === 'region').map((n) => [n.id, n.label, n.sub])).toEqual([
        ['server:s-1', 'eu-worker-1', 'prod-eu · fsn1 · cpx41'],
        ['server:s-2', 'eu-arm-1', 'prod-eu · nbg1 · cax31'],
        ['server:node:c-asia:abc', 'asia-1', 'edge-asia · contabo'],
      ]);
    });

    it('draws an app once on every server that runs a copy of it, with the copies there', () => {
      const g = byServer();
      expect(g.nodes.filter((n) => n.focus?.type === 'app' && n.focus.id === 'a-web').map((n) => [n.id, n.parent, n.replicas])).toEqual([
        ['a-web@s-1', 'server:s-1', 2],
        ['a-web@s-2', 'server:s-2', 1],
      ]);
    });

    it('reaches every copy of an app with its links', () => {
      expect(byServer().edges.map((e) => `${e.from}>${e.to}`).sort()).toEqual([
        'a-web-asia@node:c-asia:abc>a-db@s-1',
        'a-web@s-1>a-db@s-1',
        'a-web@s-2>a-db@s-1',
        'internet>a-web@s-1',
        'internet>a-web@s-2',
      ]);
    });

    it('draws a server with no app as a plain node, not an empty box', () => {
      const t = withCrossLink();
      t.servers.push({ ...t.servers[0], id: 's-3', nodeName: 'eu-worker-2', region: 'hel1' });
      const empty = byServer(t).nodes.find((n) => n.id === 'server:s-3');
      expect([empty?.kind, empty?.sub]).toEqual(['cluster', 'prod-eu · hel1 · cpx41 · no apps']);
    });

    it('lights every copy of a selected app', () => {
      const lit = litBy(byServer(), { type: 'app', id: 'a-web' });
      expect(['a-web@s-1', 'a-web@s-2', 'a-db@s-1', 'internet'].every((id) => lit?.nodes.has(id))).toBeTrue();
    });

    it('keeps lit, for a project filter, every copy and the servers holding them', () => {
      const t = withCrossLink();
      const lit = projectLit(t, byServer(t), 'p-shop');
      expect(['a-web@s-2', 'server:s-2', 'a-db@s-1', 'server:s-1'].every((id) => lit.has(id))).toBeTrue();
      expect(lit.has('a-tools@s-1')).toBeFalse();
    });
  });

  describe('the apps Flui runs for itself', () => {
    /** Three platform apps on the Asia cluster, two of them published and linked to each other. */
    function withPlatform() {
      const t = withCrossLink();
      const base = t.apps.find((a) => a.id === 'a-tools')!;
      const platform = (id: string, displayName: string, status = 'running') => ({
        ...base, id, displayName, clusterId: 'c-asia', kind: 'system', projectId: null, stackId: `app:${id}`, status,
      } as typeof base);
      t.apps.push(platform('flui-system/flui-api', 'Flui API'), platform('flui-system/postgres', 'PostgreSQL'), platform('flui-control/loki', 'Loki', 'warning'));
      const link = (id: string, from: string | null, to: string) => ({
        id, from: from ? { kind: 'app', appId: from } : { kind: 'internet' }, to: { kind: 'app', appId: to },
        source: from ? 'env-reference' : 'gateway-route', label: ':5432', crossCluster: false, viaTunnel: false,
        routeHost: null, routePath: null, targetPort: null, traffic: { measured: true, rps: 2, errorPct: 0 },
      } as (typeof t.links)[number]);
      t.links.push(link('in-api', null, 'flui-system/flui-api'), link('api-db', 'flui-system/flui-api', 'flui-system/postgres'));
      return t;
    }

    it('draws them as one quiet platform node in their cluster box, with their count', () => {
      const g = topologyGraph(withPlatform(), state({ level: 'fleet' }));
      expect(g.nodes.some((n) => n.id.startsWith('flui-'))).toBeFalse();
      const platform = g.nodes.find((n) => n.id === 'platform:c-asia')!;
      expect(platform).toEqual(jasmine.objectContaining({
        kind: 'platform', label: 'Flui platform', sub: '3 apps', parent: 'region:c-asia', muted: true, tone: 'degraded', problems: 1,
      }));
      expect(platform.focus).toEqual({ type: 'platform', id: 'c-asia' });
      expect(platform.drill).toEqual(jasmine.objectContaining({ level: 'cluster', cluster: 'c-asia' }));
    });

    it('routes their links to the platform node and drops the ones among them', () => {
      const g = topologyGraph(withPlatform(), state({ level: 'fleet' }));
      const ids = g.edges.map((e) => e.id);
      expect(ids).toContain('internet>platform:c-asia');
      expect(ids.some((id) => id.includes('flui-system'))).toBeFalse();
      expect(g.edges.some((e) => e.from === e.to)).toBeFalse();
    });

    it('keeps one platform node per cluster in the Platform box when grouped by project', () => {
      const g = topologyGraph(withPlatform(), state({ level: 'fleet', boxBy: 'project' }));
      const platform = g.nodes.find((n) => n.id === 'platform:c-asia')!;
      expect(platform.parent).toBe('region:platform');
      expect(platform.sub).toBe('edge-asia · 3 apps');
      expect(g.nodes.find((n) => n.id === 'a-tools')?.parent).toBe('region:no-project');
    });

    it('draws them, boxed by server, only on the servers they run on', () => {
      const t = withPlatform();
      for (const a of t.apps.filter((x) => x.kind === 'system')) {
        a.replicas = a.displayName === 'Loki' ? [] : [{ serverId: 'node:c-asia:abc', count: 1 }];
      }
      const g = topologyGraph(t, state({ level: 'fleet', boxBy: 'server' }));
      const platforms = g.nodes.filter((n) => n.kind === 'platform');
      expect(platforms.map((n) => [n.id, n.parent, n.sub])).toEqual([
        ['platform:c-asia@node:c-asia:abc', 'server:node:c-asia:abc', '2 apps'],
      ]);
      expect(g.edges.map((e) => e.id)).toContain('internet>platform:c-asia@node:c-asia:abc');
    });

    it('still draws each of them at the cluster level', () => {
      const t = withPlatform();
      t.stacks.push(
        ...t.apps.filter((a) => a.kind === 'system').map((a) => ({
          id: a.stackId, clusterId: a.clusterId, name: a.displayName, type: 'standalone', primaryAppId: a.id, appIds: [a.id], status: a.status,
        } as (typeof t.stacks)[number])),
      );
      const g = topologyGraph(t, state({ level: 'cluster', cluster: 'c-asia' }));
      expect(g.nodes.map((n) => n.label)).toEqual(jasmine.arrayContaining(['Flui API', 'PostgreSQL', 'Loki']));
      expect(g.nodes.some((n) => n.kind === 'platform')).toBeFalse();
    });
  });

  it('draws a small fleet by cluster when asked to', () => {
    const g = topologyGraph(withCrossLink(), state({ level: 'fleet', fleetBy: 'clusters' }));
    expect(g.nodes.some((n) => n.kind === 'region')).toBeFalse();
    expect(g.nodes.map((n) => n.id)).toContain('c-eu');
  });

  it('opens a large fleet by app in full, offering its problems and their neighbours', () => {
    const g = topologyGraph(large(withCrossLink()), state({ level: 'fleet', fleetBy: 'apps' }));
    expect(g.level).toBe('fleet');
    expect(g.filtered).toBeFalsy();
    expect(g.filterable).toBeTrue();
    expect(g.nodes.length).toBeGreaterThan(MAX_NODES);
    expect(g.nodes.some((n) => n.id.startsWith('quiet-'))).toBeTrue();
  });

  it('narrows a large fleet by app to its problems and their neighbours when asked to, in their cluster boxes', () => {
    const g = topologyGraph(large(withCrossLink()), state({ level: 'fleet', fleetBy: 'apps', problems: true }));
    expect(g.filtered).toBeTrue();
    expect(g.filterable).toBeFalsy();
    expect(g.nodes.some((n) => n.id.startsWith('quiet-'))).toBeFalse();
    const app = g.nodes.find((n) => n.kind === 'app')!;
    expect(g.nodes.some((n) => n.id === app.parent)).toBeTrue();
  });

  it('draws a large healthy fleet by app in full, with nothing to narrow to', () => {
    const t = large(withCrossLink());
    t.stacks.forEach((s) => (s.status = 'running'));
    t.apps.forEach((a) => (a.status = 'running'));
    t.links.forEach((l) => (l.traffic = { measured: false, rps: null, errorPct: null }));
    const g = topologyGraph(t, state({ level: 'fleet', fleetBy: 'apps', problems: true }));
    expect(g.filtered).toBeFalsy();
    expect(g.filterable).toBeFalsy();
    expect(g.nodes.some((n) => n.kind === 'region')).toBeTrue();
  });

  it('keeps a fleet drawn by cluster sparse: clusters, the Internet when traffic is measured, and links between clusters', () => {
    const g = topologyGraph(large(withCrossLink()), state({ level: 'fleet', fleetBy: 'clusters' }));
    expect(g.nodes.map((n) => n.id)).toEqual(['internet', 'c-eu', 'c-asia']);
    expect(g.edges.map((e) => [e.from, e.to, e.measured])).toEqual([
      ['internet', 'c-eu', true],
      ['c-asia', 'c-eu', false],
    ]);
    expect(g.nodes.find((n) => n.id === 'c-asia')?.dashed).toBeTrue();
  });

  it('draws a cluster as its stacks, ingress as a badge, and the other clusters as pills', () => {
    const g = topologyGraph(withCrossLink(), state({ level: 'cluster', cluster: 'c-eu' }));
    expect(g.nodes.map((n) => [n.kind, n.id])).toEqual([
      ['stack', 'i-shop'],
      ['stack', 'app:a-tools'],
      ['pill', 'pill:c-asia'],
    ]);
    expect(g.edges.some((e) => e.from === 'internet')).toBeFalse();
    const shop = g.nodes[0];
    expect(shop.ingress).toBe(120);
    expect(shop.ingressFailing).toBeTrue();
    expect(shop.dots).toEqual(['error', 'healthy']);
    expect(g.edges.map((e) => [e.from, e.to])).toEqual([['pill:c-asia', 'i-shop']]);
  });

  it('draws a stack as its apps and their neighbours, with the Internet entering', () => {
    const g = topologyGraph(withCrossLink(), state({ level: 'stack', cluster: 'c-eu', focus: { type: 'stack', id: 'i-shop' } }));
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['a-db', 'a-web', 'a-web-asia', 'internet'].sort());
    const ingress = g.edges.find((e) => e.from === 'internet')!;
    expect(ingress).toEqual(jasmine.objectContaining({ to: 'a-web', measured: true, failing: true, label: 'HTTPS' }));
    expect(g.edges.find((e) => e.to === 'a-db' && e.from === 'a-web')?.measured).toBeFalse();
  });

  it('animates nothing that is not measured', () => {
    for (const level of ['fleet', 'cluster', 'stack'] as const) {
      const g = topologyGraph(withCrossLink(), state({ level, cluster: 'c-eu', focus: { type: 'stack', id: 'i-shop' } }));
      for (const edge of g.edges.filter((e) => e.measured)) expect(edge.rps).not.toBeNull();
    }
  });

  it('calls a bundle failing by its traffic, not by one bad route among many', () => {
    const t = topologyFixture();
    t.links.push({
      ...t.links[0], id: 'internet>a-tools', to: { kind: 'app', appId: 'a-tools' },
      traffic: { measured: true, rps: 2000, errorPct: 0 },
    });
    const fleet = topologyGraph(large(t), state({ level: 'fleet', fleetBy: 'clusters' }));
    expect(fleet.edges.find((e) => e.from === 'internet')?.failing).toBeFalse();
    expect(isFailing(t.links[0])).toBeTrue();
  });

  function crowded(healthy: boolean) {
    const t = topologyFixture();
    const base = t.stacks[1];
    if (healthy) {
      t.stacks.forEach((s) => (s.status = 'running'));
      t.apps.forEach((a) => (a.status = 'running'));
    }
    for (let i = 0; i < MAX_NODES; i++) {
      t.stacks.push({ ...base, id: `app:x-${i}`, appIds: [] });
    }
    return t;
  }

  it('shows only the problems and their neighbours when a level is crowded', () => {
    const g = topologyGraph(crowded(false), state({ level: 'cluster', cluster: 'c-eu' }));
    expect(g.level).toBe('cluster');
    expect(g.filtered).toBeTrue();
    expect(g.nodes.map((n) => n.id)).toContain('i-shop');
    expect(g.nodes.some((n) => n.id.startsWith('app:x-'))).toBeFalse();
  });

  it('draws the crowded level in full when asked to', () => {
    const g = topologyGraph(crowded(false), state({ level: 'cluster', cluster: 'c-eu', all: true }));
    expect(g.filtered).toBeFalsy();
    expect(g.nodes.length).toBeGreaterThan(MAX_NODES);
  });

  it('collapses to the level above when a crowded level has no problem to show', () => {
    const g = topologyGraph(crowded(true), state({ level: 'cluster', cluster: 'c-eu' }));
    expect(g.level).toBe('fleet');
    expect(g.collapsedFrom).toBe('cluster');
  });

  it('keeps lit what a selection touches, and nothing else', () => {
    const g = topologyGraph(withCrossLink(), state({ level: 'stack', cluster: 'c-eu', focus: { type: 'stack', id: 'i-shop' } }));
    const lit = litBy(g, { type: 'app', id: 'a-db' })!;
    expect([...lit.nodes].sort()).toEqual(['a-db', 'a-web', 'a-web-asia']);
    expect(litBy(g, null)).toBeNull();
  });

  it('gives the same digest to the same graph, whatever the order it arrives in', () => {
    const g = topologyGraph(withCrossLink(), state({ level: 'fleet' }));
    const shuffled = { ...g, nodes: [...g.nodes].reverse(), edges: [...g.edges].reverse() };
    expect(graphDigest(shuffled)).toBe(graphDigest(g));
  });

  describe('centred on one app', () => {
    it('draws its direct neighbours across clusters, and the Internet only when it reaches the app itself', () => {
      const g = topologyGraph(withCrossLink(), state({ level: 'app', app: 'a-db', cluster: 'c-eu' }));
      expect(g.level).toBe('app');
      expect(g.nodes.map((n) => n.id).sort()).toEqual(['a-db', 'a-web', 'a-web-asia']);
      expect(g.nodes.find((n) => n.id === 'a-db')?.center).toBeTrue();
      expect(g.nodes.find((n) => n.id === 'a-web-asia')?.sub).toBe('edge-asia');
      expect(g.edges.map((e) => `${e.from}>${e.to}`).sort()).toEqual(['a-web-asia>a-db', 'a-web>a-db']);
    });

    it('takes one more step on request, and the Internet is never a way through', () => {
      const t = withCrossLink();
      expect([...neighbourhood(t, 'a-db', 2)].sort()).toEqual(['a-db', 'a-web', 'a-web-asia', 'internet']);
      expect([...neighbourhood(t, 'a-web', 2)]).not.toContain('a-tools');
      const g = topologyGraph(t, state({ level: 'app', app: 'a-db', hops: 2 }));
      expect(g.nodes[0].id).toBe('internet');
      expect(g.edges.some((e) => e.from === 'internet' && e.to === 'a-web')).toBeTrue();
    });

    it('drills from any app node to the map centred on it', () => {
      const g = topologyGraph(topologyFixture(), state({ level: 'stack', cluster: 'c-eu', focus: { type: 'stack', id: 'i-shop' } }));
      expect(g.nodes.find((n) => n.id === 'a-db')?.drill).toEqual(
        jasmine.objectContaining({ level: 'app', app: 'a-db', cluster: 'c-eu' }),
      );
    });

    it('falls back to the fleet when the app is gone', () => {
      expect(topologyGraph(topologyFixture(), state({ level: 'app', app: 'gone' })).level).toBe('fleet');
    });
  });
});
