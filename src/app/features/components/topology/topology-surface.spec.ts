import {
  expectDeterministicDigest,
  expectValidSurface,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';
import {
  TopologySurfaceInput,
  TopologySurfaceRevision,
  buildTopologySurface,
  presentedContent,
} from './topology-surface';
import { DEFAULT_TOPOLOGY_STATE } from './topology-state';
import { topologyFixture } from './topology.fixture';

function input(over: Partial<TopologySurfaceInput> = {}): TopologySurfaceInput {
  return { snapshot: topologyFixture(), state: DEFAULT_TOPOLOGY_STATE, focus: null, ...over };
}

function snapshotOf(over: Partial<TopologySurfaceInput> = {}, revision = 1) {
  return buildTopologySurface(input(over), { revision, generatedAt: '2026-10-17T15:00:00.000Z' })!;
}

describe('topology surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
    expectValidSurface(snapshotOf({ focus: { type: 'server', id: 's-1' } }));
  });

  it('renders a byte-identical digest across two calls with the same input', () => {
    expectDeterministicDigest(snapshotOf({ focus: { type: 'app', id: 'a-web' } }));
  });

  it('invents nothing before the snapshot has loaded', () => {
    expect(buildTopologySurface(input({ snapshot: null }), { revision: 1, generatedAt: 'x' })).toBeNull();
  });

  it('points attention at the page when nothing is selected', () => {
    expect(snapshotOf().attention).toEqual([{ scopeId: 'topology', reason: 'route' }]);
  });

  it('points attention at the selected element, by the ref of the page it opens', () => {
    const s = snapshotOf({ focus: { type: 'server', id: 's-1' } });
    expect(s.attention).toEqual([
      { scopeId: 'topology:focus', entityRef: 'flui://instance/hetzner%3A481', reason: 'selection' },
    ]);
    expect(snapshotOf({ focus: { type: 'app', id: 'a-web' } }).attention[0].entityRef).toBe(
      'flui://application/a-web',
    );
  });

  it('lists what needs attention as related, never selected', () => {
    const problems = snapshotOf().scopes.filter((s) => s.parentId === 'topology:problems');
    expect(problems.map((p) => p.label)).toEqual(['Web', 'eu-worker-1', 'edge-asia']);
  });

  it('never carries a route host, a namespace or a provider resource id in clear text', () => {
    const json = JSON.stringify(snapshotOf({ focus: { type: 'link', id: 'l-in' } }));
    expect(json).not.toContain('shop.example.org');
    expect(json).not.toContain('acme-shop');
    expect(json).not.toContain('"481"');
  });

  it('advances the revision only when what is presented changes', () => {
    const tracker = new TopologySurfaceRevision();
    const r1 = tracker.next(presentedContent(input()));
    expect(tracker.next(presentedContent(input()))).toBe(r1);
    expect(tracker.next(presentedContent(input({ focus: { type: 'app', id: 'a-db' } })))).toBe(r1 + 1);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = snapshotOf({ focus: { type: 'app', id: 'a-db' } }, first.surface.revision);
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });
});
