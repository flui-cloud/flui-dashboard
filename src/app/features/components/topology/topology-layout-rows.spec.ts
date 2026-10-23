import { GraphEdge, TopologyGraph, node } from './topology-graph-model';
import { rowsLayout } from './topology-layout-rows';

const edge = (from: string, to: string): GraphEdge => ({
  id: `${from}>${to}`, from, to, label: '', measured: false, failing: false, rps: null, count: 1, focus: null,
});

function shop(): TopologyGraph {
  const app = (id: string, parent: string) => node('app', id, { parent });
  return {
    level: 'fleet',
    stacked: true,
    collapsedFrom: null,
    nodes: [
      node('internet', 'internet', {}),
      node('region', 'server:a', {}),
      app('web@a', 'server:a'),
      node('region', 'server:b', {}),
      app('web@b', 'server:b'),
      app('worker@b', 'server:b'),
      app('db@b', 'server:b'),
      node('cluster', 'server:c', {}),
    ],
    edges: [
      edge('internet', 'web@a'),
      edge('internet', 'web@b'),
      edge('web@a', 'db@b'),
      edge('web@b', 'db@b'),
      edge('worker@b', 'db@b'),
    ],
  };
}

describe('rowsLayout', () => {
  it('stacks the servers one under the other, all as wide', () => {
    const l = rowsLayout(shop());
    const [a, b, c] = ['server:a', 'server:b', 'server:c'].map((id) => l.nodes.get(id)!);
    expect(a.x).toBe(b.x);
    expect(b.x).toBe(c.x);
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
    expect(l.sizes.get('server:a')!.width).toBe(l.sizes.get('server:b')!.width);
  });

  it('puts what calls on the left and data on the right, in the same columns on every server', () => {
    const l = rowsLayout(shop());
    const x = (id: string) => l.nodes.get(id)!.x;
    expect(x('web@a')).toBe(x('web@b'));
    expect(x('worker@b')).toBe(x('web@b'));
    expect(x('db@b')).toBeGreaterThan(x('web@b'));
    expect(x('internet')).toBeLessThan(x('web@a'));
  });

  it('stacks the apps of one column inside their box, which grows to hold them', () => {
    const l = rowsLayout(shop());
    expect(l.nodes.get('worker@b')!.y).toBeGreaterThan(l.nodes.get('web@b')!.y);
    expect(l.sizes.get('server:b')!.height).toBeGreaterThan(l.sizes.get('server:a')!.height);
  });

  it('keeps a loop of links from running away', () => {
    const g = shop();
    g.edges.push(edge('db@b', 'web@b'));
    expect(() => rowsLayout(g)).not.toThrow();
  });
});
