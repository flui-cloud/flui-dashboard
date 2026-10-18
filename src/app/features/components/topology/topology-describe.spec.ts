import { describeFocus } from './topology-describe';
import { topologyFixture } from './topology.fixture';

describe('the inspector', () => {
  const section = (focus: Parameters<typeof describeFocus>[0], title: string) =>
    describeFocus(focus, topologyFixture())!.sections.find((s) => s.title === title);

  it('lists what a cluster lets in from the Internet, without saying to whom', () => {
    const open = section({ type: 'cluster', id: 'c-eu' }, 'Open to the Internet')!;
    expect(open.rows.map((r) => [r.label, r.detail])).toEqual([
      [':443 · HTTPS', 'from anywhere'],
      [':22 · SSH', 'from 1 range'],
    ]);
  });

  it('says so when Flui manages no firewall for a cluster, instead of an empty list', () => {
    const view = describeFocus({ type: 'cluster', id: 'c-asia' }, topologyFixture())!;
    expect(view.facts).toContain({ label: 'Firewall', value: 'None managed by Flui' });
    expect(view.sections.some((s) => s.title === 'Open to the Internet')).toBeFalse();
  });

  it('shows where an app is reached from the Internet and the port each route delivers to', () => {
    const routes = section({ type: 'app', id: 'a-web' }, 'Reachable from the Internet')!;
    expect(routes.rows.map((r) => [r.label, r.detail, r.focus])).toEqual([
      ['https://shop.example.org/api', '→ :3000 · 120 req/s', { type: 'link', id: 'l-in' }],
    ]);
    expect(routes.rows[0].tone).toBe('error');
  });

  it('lists who calls an app beside what it calls', () => {
    expect(section({ type: 'app', id: 'a-db' }, 'Called by')!.rows.map((r) => r.label)).toEqual(['Web']);
    expect(section({ type: 'app', id: 'a-db' }, 'Reachable from the Internet')).toBeUndefined();
  });
});
