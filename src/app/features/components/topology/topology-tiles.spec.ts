import {
  clusterConnections,
  columnsFor,
  densityOf,
  fullestServers,
  networkOf,
  replicaSpread,
  shortName,
  tileGroups,
} from './topology-tiles';
import { tileLook } from './topology-tile';
import { topologyFixture } from './topology.fixture';

describe('the server tile map', () => {
  const t = topologyFixture();

  it('groups servers by cluster with a short name, a count and the average memory', () => {
    const [eu, asia] = tileGroups(t, 'memory', 'cluster', null);
    expect(eu.name).toBe('prod-eu');
    expect(eu.meta).toBe('2 servers · avg 74%');
    expect(eu.tiles.map((x) => x.label)).toEqual(['worker-1', 'arm-1']);
    expect(eu.tiles[0].valueText).toBe('92%');
    expect(asia.meta).toBe('1 server · no usage data');
  });

  it('groups by provider on demand', () => {
    expect(tileGroups(t, 'memory', 'provider', null).map((g) => g.name)).toEqual(['hetzner', 'contabo']);
  });

  it('lights the servers that run the focused app, with their replica count, and dims the rest', () => {
    const [eu, asia] = tileGroups(t, 'memory', 'cluster', { type: 'app', id: 'a-web' });
    expect(eu.tiles.map((x) => [x.replicas, x.dimmed])).toEqual([[2, false], [1, false]]);
    expect(eu.replicas).toBe(3);
    expect(asia.dimmed).toBeTrue();
    expect(asia.tiles[0].dimmed).toBeTrue();
  });

  it('dims the other clusters when one is focused', () => {
    const [eu, asia] = tileGroups(t, 'memory', 'cluster', { type: 'cluster', id: 'c-asia' });
    expect(eu.dimmed).toBeTrue();
    expect(asia.dimmed).toBeFalse();
  });

  it('turns a tile red from 90% and leaves no value grey', () => {
    const [eu, asia] = tileGroups(t, 'memory', 'cluster', null);
    expect(tileLook(eu.tiles[0], 'memory', 0).background).toBe('hsl(var(--destructive))');
    expect(tileLook(eu.tiles[1], 'memory', 0).background).toContain('--brand');
    expect(tileLook(asia.tiles[0], 'memory', 0).background).toBe('hsl(var(--muted))');
  });

  it('never paints red when coloring by replicas', () => {
    const [eu] = tileGroups(t, 'pods', 'cluster', null);
    expect(tileLook(eu.tiles[0], 'pods', 3).background).toContain('--brand');
  });

  it('shortens names only by what every sibling shares', () => {
    expect(shortName('flui-worker-1', ['flui-worker-1', 'flui-arm-1'])).toBe('worker-1');
    expect(shortName('solo', ['solo'])).toBe('solo');
    expect(shortName('asia-node-1', ['asia-node-1', 'asia-node-2'])).toBe('node-1');
  });

  it('gives a group of few servers cards, a crowded one compact tiles', () => {
    expect([1, 6, 7, 20, 21].map(densityOf)).toEqual(['card', 'card', 'medium', 'medium', 'compact']);
    const [eu] = tileGroups(t, 'memory', 'cluster', null);
    expect(eu.density).toBe('card');
    expect(eu.columns).toBe(2);
  });

  it('keeps groups wider than tall', () => {
    expect([1, 2, 6, 18].map(columnsFor)).toEqual([1, 2, 4, 6]);
  });
});

describe('the network mode', () => {
  const t = topologyFixture();

  it('names how each server is connected', () => {
    expect(t.servers.map(networkOf)).toEqual(['flui', 'flui-waiting', 'public']);
    expect(networkOf({ ...t.servers[2], privateNetwork: true })).toBe('private');
  });

  it('colors tiles by network, not by load', () => {
    const [eu] = tileGroups(t, 'network', 'cluster', null);
    expect(eu.tiles[0].valueText).toBe('Flui');
    expect(tileLook(eu.tiles[0], 'network', 0).border).toBe('hsl(var(--ok))');
    expect(tileLook(eu.tiles[1], 'network', 0).border).toBe('hsl(var(--warn))');
  });

  it('describes how the control reaches every other cluster', () => {
    const fleet = topologyFixture();
    fleet.clusters.push({ ...fleet.clusters[0], id: 'c-ctl', name: 'control', type: 'control' });
    fleet.clusterLinks = [{ fromClusterId: 'c-asia', toClusterId: 'c-eu', linkCount: 2, rps: null, viaTunnel: false }];
    const { control, connections } = clusterConnections(fleet);
    expect(control?.name).toBe('control');
    expect(connections).toEqual([
      { clusterId: 'c-eu', name: 'prod-eu', kind: 'tunnel', crossProvider: false, appLinks: 2 },
      { clusterId: 'c-asia', name: 'edge-asia', kind: 'public-address', crossProvider: true, appLinks: 2 },
    ]);
  });
});

describe('the panels under the map', () => {
  const t = topologyFixture();

  it('reads the spread of an app across every cluster it runs in, and flags a pile', () => {
    const rows = replicaSpread(t, 'a-web');
    expect(rows.map((r) => [r.cluster, r.replicas, r.piledOn])).toEqual([
      ['prod-eu', 3, 'eu-worker-1'],
      ['edge-asia', 1, null],
    ]);
  });

  it('does not call two replicas on two servers a pile', () => {
    const fleet = topologyFixture();
    fleet.apps[0].replicas = [{ serverId: 's-1', count: 2 }, { serverId: 's-2', count: 2 }];
    fleet.apps[0].replicaCount = 4;
    expect(replicaSpread(fleet, 'a-web')[0].piledOn).toBeNull();
  });

  it('lists the fullest servers by the current color, memory when coloring by network', () => {
    expect(fullestServers(t, 'memory').map((r) => r.server.id)).toEqual(['s-1', 's-2']);
    expect(fullestServers(t, 'network').map((r) => r.value)).toEqual([92, 55]);
  });

  it('lights, for a project filter, the servers its apps run on with their replica count', () => {
    const t = topologyFixture();
    const tiles = tileGroups(t, 'memory', 'cluster', null, 'p-shop').flatMap((g) => g.tiles);
    const shop = t.apps.filter((a) => a.projectId === 'p-shop');
    for (const tile of tiles) {
      const count = shop.reduce((n, a) => n + (a.replicas.find((r) => r.serverId === tile.server.id)?.count ?? 0), 0);
      expect(tile.replicas).toBe(count);
      expect(tile.dimmed).toBe(count === 0);
    }
  });

  it('names each fullest server without the part its cluster servers share, so two never read the same', () => {
    const t = topologyFixture();
    t.servers = t.servers.map((s, i) => ({ ...s, clusterId: 'c-eu', nodeName: `control-cluster-staging-hz-${i ? 'worker-1' : 'master'}` }));
    const labels = fullestServers(t, 'memory').map((r) => r.label);
    expect(labels).toContain('master');
    expect(labels).toContain('worker-1');
    expect(fullestServers(t, 'pods')[0].value).toBe(3);
  });
});
