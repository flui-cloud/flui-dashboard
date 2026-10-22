import { attentionOf } from './topology-attention.component';
import { topologyFixture } from './topology.fixture';

describe('attentionOf', () => {
  it('leaves platform apps out of the spread, since every cluster runs them', () => {
    const t = topologyFixture();
    const [first, second] = t.clusters;
    const platform = { ...t.apps[0], kind: 'system' as const, groupKey: 'system/upgrade', displayName: 'system-upgrade-controller' };
    const snapshot = {
      ...t,
      apps: [...t.apps, { ...platform, id: 'p-1', clusterId: first.id }, { ...platform, id: 'p-2', clusterId: second.id }],
    };
    expect(attentionOf(snapshot).spread.map((s) => s.label)).not.toContain('system-upgrade-controller');
  });
});
