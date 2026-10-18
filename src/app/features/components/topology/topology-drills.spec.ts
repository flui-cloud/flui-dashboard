import { clusterCapacity, requestPath } from './topology-drills';
import { ExportPalette } from './topology-export';
import { fit, frame } from './topology-view-export';
import { topologyFixture } from './topology.fixture';

const PALETTE: ExportPalette = {
  bg: '#fff', card: '#fff', border: '#ddd', fg: '#111', muted: '#666',
  brand: '#25e', ok: '#183', warn: '#b50', err: '#d22', track: '#eee',
};

describe('cluster capacity', () => {
  const t = topologyFixture();

  it('stacks each app by what it requests on each server, then what the system holds, then the room left', () => {
    const { columns } = clusterCapacity(t, 'c-eu', null);
    const first = columns[0];
    expect(first.server.id).toBe('s-1');
    expect(first.blocks.map((b) => [b.label, b.mi])).toEqual([
      ['Web', 512],
      ['Database', 256],
      ['Tools', 256],
      ['System and other', 9000 - 1024],
    ]);
    expect(first.freeMi).toBe(15_800 - 9000);
  });

  it('shows where the next replica of the focused app would fit', () => {
    const { columns, ghostFits } = clusterCapacity(t, 'c-eu', 'a-db');
    expect(ghostFits).toBeTrue();
    expect(columns.find((c) => c.ghost)?.server.id).toBe('s-2');
  });

  it('says so when no server has room', () => {
    const full = topologyFixture();
    full.servers.forEach((s) => s.capacity && (s.capacity.requestedMemMi = s.capacity.allocatableMemMi));
    expect(clusterCapacity(full, 'c-eu', 'a-db').ghostFits).toBeFalse();
  });
});

describe('request path', () => {
  const t = topologyFixture();

  it('walks the way in to an app, with a check at each hop', () => {
    const path = requestPath(t, 'a-web')!;
    expect(path.hosts).toEqual(['shop.example.org']);
    expect(path.hops.map((h) => [h.step, h.check])).toEqual([
      ['01 · Gateway', 'fail'],
      ['02 · App', 'fail'],
      ['03 · Servers', 'ok'],
    ]);
    expect(path.hops[0].lines).toEqual(['120 req/s', '40.0% server errors']);
    expect(path.data.map((d) => [d.title, d.check, d.lines[0]])).toEqual([['Database', 'ok', ':5432']]);
  });

  it('answers nothing for an app the map no longer holds', () => {
    expect(requestPath(t, 'gone')).toBeNull();
  });
});

describe('image export', () => {
  const t = topologyFixture();

  it('stamps an exported view Masked when mask mode is on, and only then', () => {
    const on = frame('', { width: 400, height: 200 }, { title: 'Topology', subtitle: 'x', masked: true }, PALETTE);
    const off = frame('', { width: 400, height: 200 }, { title: 'Topology', subtitle: 'x', masked: false }, PALETTE);
    expect(on.svg).toContain('>Masked<');
    expect(off.svg).not.toContain('Masked');
  });

  it('escapes what it writes and frames the view with room around it', () => {
    const view = frame('<g/>', { width: 900, height: 300 }, { title: 'prod <eu> & co', subtitle: '', masked: false }, PALETTE);
    expect(view.svg).toContain('prod &#60;eu&#62; &#38; co');
    expect(view.svg).not.toContain('prod <eu>');
    expect(view.width).toBeGreaterThan(900);
    expect(view.height).toBeGreaterThan(300);
  });

  it('cuts a long name rather than letting it run out of its box', () => {
    expect(fit('control-cluster-staging-hz-master', 100, 13).endsWith('…')).toBeTrue();
    expect(fit('master', 100, 13)).toBe('master');
  });
});
