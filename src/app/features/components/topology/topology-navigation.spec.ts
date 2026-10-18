import { destinationsFor } from './topology-navigation';
import { topologyFixture } from './topology.fixture';

describe('where topology elements lead', () => {
  const t = topologyFixture();

  it('opens a cluster on its overview, with its tabs and the Flui network when it is held', () => {
    const d = destinationsFor({ type: 'cluster', id: 'c-asia' }, t, false);
    expect(d.open?.commands).toEqual(['/cluster', 'c-asia', 'overview']);
    expect(d.quick.map((q) => q.label)).toEqual(['Nodes', 'Network', 'Monitoring', 'Flui network']);
  });

  it('opens a server on its instance page, by provider and provider id', () => {
    const d = destinationsFor({ type: 'server', id: 's-1' }, t, false);
    expect(d.open?.commands).toEqual(['/infrastructure/compute', 'hetzner', '481']);
  });

  it('offers no deep link for a server Flui holds no record of', () => {
    expect(destinationsFor({ type: 'server', id: 'node:c-asia:abc' }, t, false).open).toBeNull();
  });

  it('opens a composed stack on its recap and a standalone one on the app', () => {
    expect(destinationsFor({ type: 'stack', id: 'i-shop' }, t, false).open).toEqual({
      label: 'Open stack',
      commands: ['/apps/recap', 'a-web'],
      queryParams: { from: 'applications' },
    });
    expect(destinationsFor({ type: 'stack', id: 'app:a-tools' }, t, false).open?.commands).toEqual([
      '/apps/applications', 'a-tools', 'overview',
    ]);
  });

  it('opens an app with its working tabs one click away', () => {
    const d = destinationsFor({ type: 'app', id: 'a-web' }, t, false);
    expect(d.open?.commands).toEqual(['/apps/applications', 'a-web', 'overview']);
    expect(d.quick.map((q) => q.commands[2])).toEqual(['logs', 'resources', 'configuration', 'gateway']);
  });

  it('opens a gateway link on the route, and nothing for a declared link', () => {
    expect(destinationsFor({ type: 'link', id: 'l-in' }, t, false).open?.commands).toEqual([
      '/apps/applications', 'a-web', 'gateway',
    ]);
    expect(destinationsFor({ type: 'link', id: 'l-db' }, t, false).open).toBeNull();
  });

  it('gives a guest only the pages the demo fills with the same examples', () => {
    const server = destinationsFor({ type: 'server', id: 's-1' }, t, true);
    expect(server.open).toEqual({ label: 'Open server', commands: ['/infrastructure/compute', 'hetzner', '481'] });
    expect(server.quick).toEqual([]);
    for (const focus of [
      { type: 'cluster' as const, id: 'c-eu' },
      { type: 'app' as const, id: 'a-web' },
      { type: 'stack' as const, id: 'i-shop' },
      { type: 'link' as const, id: 'l-in' },
    ]) {
      expect(destinationsFor(focus, t, true).open).toBeNull();
      expect(destinationsFor(focus, t, true).quick).toEqual([]);
    }
  });

  it('offers the views inside Topology to everyone, guests included', () => {
    const labels = (f: { type: 'app' | 'cluster' | 'link'; id: string }, guest: boolean) =>
      destinationsFor(f, t, guest).drills.map((d) => d.label);
    expect(labels({ type: 'app', id: 'a-web' }, true)).toEqual(['Service map', 'On servers', 'Request path', 'Capacity']);
    expect(labels({ type: 'app', id: 'a-db' }, false)).toEqual(['Service map', 'On servers', 'Capacity']);
    expect(labels({ type: 'cluster', id: 'c-eu' }, true)).toEqual(['Capacity']);
    expect(destinationsFor({ type: 'link', id: 'l-in' }, t, true).drills[0].state).toEqual({
      drill: 'path',
      focus: { type: 'app', id: 'a-web' },
    });
  });

  it('leads nowhere for an element the snapshot does not hold', () => {
    expect(destinationsFor({ type: 'app', id: 'gone' }, t, false)).toEqual({ open: null, quick: [], drills: [] });
  });
});
