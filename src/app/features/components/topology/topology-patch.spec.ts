import { applyTopologyEvent } from './topology-patch';
import { topologyFixture } from './topology.fixture';

describe('applying the live stream to the snapshot', () => {
  const t = topologyFixture();

  it('updates an app status and the stack it belongs to', () => {
    const next = applyTopologyEvent(t, {
      event: 'app.status_changed',
      data: { appId: 'a-web', status: 'running', statusReason: null },
    });
    expect(next.apps.find((a) => a.id === 'a-web')?.status).toBe('running');
    expect(next.stacks.find((s) => s.id === 'i-shop')?.status).toBe('running');
  });

  it('moves replicas when an app scales', () => {
    const replicas = [{ serverId: 's-2', count: 4 }];
    const next = applyTopologyEvent(t, {
      event: 'app.scaled',
      data: { appId: 'a-db', replicas, replicaCount: 4, scalingNote: null },
    });
    const app = next.apps.find((a) => a.id === 'a-db')!;
    expect(app.replicas).toEqual(replicas);
    expect(app.replicaCount).toBe(4);
  });

  it('adds a deployed app to its stack, and gives a new standalone app a stack of its own', () => {
    const base = t.apps[0];
    const joined = applyTopologyEvent(t, {
      event: 'app.deployed',
      data: { app: { ...base, id: 'a-cache', stackId: 'i-shop' } },
    });
    expect(joined.stacks.find((s) => s.id === 'i-shop')?.appIds).toContain('a-cache');

    const alone = applyTopologyEvent(t, {
      event: 'app.deployed',
      data: { app: { ...base, id: 'a-new', stackId: 'app:a-new', displayName: 'New' } },
    });
    expect(alone.stacks.find((s) => s.id === 'app:a-new')).toEqual(
      jasmine.objectContaining({ type: 'standalone', appIds: ['a-new'], name: 'New' }),
    );
  });

  it('removes an app, and a stack left with none', () => {
    const next = applyTopologyEvent(t, { event: 'app.removed', data: { appId: 'a-tools' } });
    expect(next.apps.some((a) => a.id === 'a-tools')).toBeFalse();
    expect(next.stacks.some((s) => s.id === 'app:a-tools')).toBeFalse();
  });

  it('updates the capacity of the servers that changed only', () => {
    const capacity = { ...t.servers[1].capacity!, usedMemPct: 70 };
    const next = applyTopologyEvent(t, {
      event: 'server.capacity',
      data: { capacities: [{ serverId: 's-2', clusterId: 'c-eu', capacity, podCount: 5 }] },
    });
    expect(next.servers[1]).toEqual(jasmine.objectContaining({ capacity, podCount: 5 }));
    expect(next.servers[0]).toBe(t.servers[0]);
  });

  it('adds and removes servers', () => {
    const added = applyTopologyEvent(t, {
      event: 'server.added',
      data: { clusterId: 'c-eu', server: { ...t.servers[0], id: 's-9' } },
    });
    expect(added.servers.map((s) => s.id)).toContain('s-9');
    const removed = applyTopologyEvent(added, { event: 'server.removed', data: { serverId: 's-9' } });
    expect(removed.servers.map((s) => s.id)).not.toContain('s-9');
  });

  it('replaces the links when they change', () => {
    const next = applyTopologyEvent(t, { event: 'links.changed', data: { links: [], clusterLinks: [] } });
    expect(next.links).toEqual([]);
  });

  it('leaves the snapshot as it is for a heartbeat or an unknown app', () => {
    expect(applyTopologyEvent(t, { event: 'heartbeat', data: { ts: 'now' } })).toBe(t);
    expect(applyTopologyEvent(t, { event: 'app.scaled', data: { appId: 'nobody' } })).toBe(t);
  });
});
