import {
  DEFAULT_TOPOLOGY_STATE,
  parseFocus,
  parseTopologyState,
  topologyQueryParams,
} from './topology-state';

describe('topology state in the address', () => {
  it('reads defaults from an empty address', () => {
    expect(parseTopologyState({})).toEqual(DEFAULT_TOPOLOGY_STATE);
  });

  it('round-trips every field', () => {
    const state = {
      view: 'services' as const,
      level: 'app' as const,
      cluster: 'c-1',
      app: 'a-7',
      hops: 2 as const,
      all: true,
      problems: true,
      fleetBy: 'apps' as const,
      boxBy: 'project' as const,
      project: 'p-1',
      focus: { type: 'stack' as const, id: 'app:3f2a' },
      colorBy: 'pods' as const,
      groupBy: 'provider' as const,
      list: true,
      drill: 'capacity' as const,
    };
    expect(parseTopologyState(topologyQueryParams(state))).toEqual(state);
  });

  it('reads the server boxes from the address', () => {
    expect(parseTopologyState({ box: 'server' }).boxBy).toBe('server');
    expect(topologyQueryParams({ ...DEFAULT_TOPOLOGY_STATE, boxBy: 'server' })).toEqual({ box: 'server' });
    expect(parseTopologyState({ box: 'rack' }).boxBy).toBe('cluster');
  });

  it('writes only what differs from the default, so a shared link stays short', () => {
    expect(topologyQueryParams(DEFAULT_TOPOLOGY_STATE)).toEqual({});
    expect(
      topologyQueryParams({ ...DEFAULT_TOPOLOGY_STATE, focus: { type: 'app', id: 'a1' } }),
    ).toEqual({ focus: 'app:a1' });
  });

  it('opens on the service map, every app drawn, unless the address says otherwise', () => {
    expect(DEFAULT_TOPOLOGY_STATE.view).toBe('services');
    expect(DEFAULT_TOPOLOGY_STATE.fleetBy).toBe('apps');
    expect(parseTopologyState({ view: 'infrastructure', fleet: 'clusters' })).toEqual(
      jasmine.objectContaining({ view: 'infrastructure', fleetBy: 'clusters' }),
    );
    expect(topologyQueryParams({ ...DEFAULT_TOPOLOGY_STATE, view: 'infrastructure', fleetBy: 'clusters' })).toEqual({
      view: 'infrastructure',
      fleet: 'clusters',
    });
  });

  it('opens the fleet by app in full, and keeps the narrowing to problems in the address', () => {
    expect(DEFAULT_TOPOLOGY_STATE.problems).toBeFalse();
    expect(parseTopologyState({ problems: '1' }).problems).toBeTrue();
    expect(topologyQueryParams({ ...DEFAULT_TOPOLOGY_STATE, problems: true })).toEqual({ problems: '1' });
  });

  it('keeps ids that hold colons', () => {
    expect(parseFocus('server:node:c1:abc')).toEqual({ type: 'server', id: 'node:c1:abc' });
  });

  it('ignores values it does not know, instead of breaking the page', () => {
    expect(parseFocus('planet:x')).toBeNull();
    expect(parseFocus('app:')).toBeNull();
    expect(parseTopologyState({ view: 'galaxy', colorBy: 'gold' })).toEqual(DEFAULT_TOPOLOGY_STATE);
  });
});
