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

  it('keeps lit, for a project filter, its apps and where they run', () => {
    const t = withCrossLink();
    const g = topologyGraph(t, state({ level: 'fleet' }));
    const lit = projectLit(t, g, 'p-shop');
    expect(['a-web', 'a-db', 'region:c-eu'].every((id) => lit.has(id))).toBeTrue();
    expect(lit.has('a-tools')).toBeFalse();
    expect(lit.has('a-web-asia')).toBeFalse();
  });

  it('draws platform apps quieter, and boxes them as Platform when grouped by project', () => {
    const t = withCrossLink();
    const base = t.apps.find((a) => a.id === 'a-tools')!;
    t.apps.push({ ...base, id: 'flui-control/loki', displayName: 'Loki', kind: 'system', projectId: null, stackId: 'app:loki' });
    const byCluster = topologyGraph(t, state({ level: 'fleet' }));
    expect(byCluster.nodes.find((n) => n.id === 'flui-control/loki')?.muted).toBeTrue();
    expect(byCluster.nodes.find((n) => n.id === 'a-tools')?.muted).toBeFalse();
    const byProject = topologyGraph(t, state({ level: 'fleet', boxBy: 'project' }));
    expect(byProject.nodes.find((n) => n.id === 'flui-control/loki')?.parent).toBe('region:platform');
    expect(byProject.nodes.find((n) => n.id === 'a-tools')?.parent).toBe('region:no-project');
  });

  it('draws a small fleet by cluster when asked to', () => {
    const g = topologyGraph(withCrossLink(), state({ level: 'fleet', fleetBy: 'clusters' }));
    expect(g.nodes.some((n) => n.kind === 'region')).toBeFalse();
    expect(g.nodes.map((n) => n.id)).toContain('c-eu');
  });

  it('draws a large fleet by app when asked to: its problems and their neighbours first, in their cluster boxes', () => {
    const g = topologyGraph(large(withCrossLink()), state({ level: 'fleet', fleetBy: 'apps' }));
    expect(g.filtered).toBeTrue();
    expect(g.nodes.some((n) => n.id.startsWith('quiet-'))).toBeFalse();
    const app = g.nodes.find((n) => n.kind === 'app')!;
    expect(g.nodes.some((n) => n.id === app.parent)).toBeTrue();
  });

  it('keeps a large fleet sparse: clusters, the Internet when traffic is measured, and links between clusters', () => {
    const g = topologyGraph(large(withCrossLink()), state({ level: 'fleet' }));
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
    const fleet = topologyGraph(large(t), state({ level: 'fleet' }));
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
