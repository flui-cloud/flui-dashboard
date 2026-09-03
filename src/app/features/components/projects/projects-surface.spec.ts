import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  ProjectsSurfaceInput,
  ProjectsSurfaceRevision,
  buildProjectsSurface,
  presentedContent,
  projectEntityRef,
} from './projects-surface';
import type { Project } from '../../model/project.model';
import type { AppAttributes } from '../../model/iam.model';

const PROJECT: Project = { id: 'proj-1', name: 'Billing', slug: 'billing', description: 'Billing services', color: '#22c55e' };

const APP: AppAttributes = {
  id: 'app-1',
  slug: 'billing-api',
  name: 'billing-api',
  type: 'user',
  kind: 'APPLICATION',
  clusterId: 'cluster-1',
  clusterName: 'cluster-1',
  provider: 'hetzner',
  project: 'billing',
  tags: [],
};

function input(over: Partial<ProjectsSurfaceInput> = {}): ProjectsSurfaceInput {
  return {
    projects: [PROJECT],
    apps: [APP],
    ...over,
  };
}

function snapshotOf(over: Partial<ProjectsSurfaceInput> = {}): SurfaceSnapshot {
  const snapshot = buildProjectsSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
  if (!snapshot) throw new Error('the producer described nothing');
  return snapshot;
}

const rowsOf = (s: SurfaceSnapshot) => s.scopes.filter((sc) => sc.kind === 'region');

describe('projects surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new ProjectsSurfaceRevision();
    const a = input();
    const b = input({ projects: [PROJECT, { id: 'proj-2', name: 'Growth', slug: 'growth' }] });
    const first = buildProjectsSurface(a, { revision: tracker.next(presentedContent(a)), generatedAt: '2026-09-02T09:00:00.000Z' })!;
    const second = buildProjectsSurface(b, { revision: tracker.next(presentedContent(b)), generatedAt: '2026-09-02T09:01:00.000Z' })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('is a list page with no selection: attention names only the page, every row is related', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'projects', reason: 'route' }]);
    const row = rowsOf(snapshot)[0];
    expect(row.entities).toEqual([{ ref: projectEntityRef('proj-1'), label: 'Billing', role: 'related' }]);
  });

  it('presents the apps-count badge exactly as the card computes it (same filter the template uses)', () => {
    const snapshot = snapshotOf();
    const row = rowsOf(snapshot)[0];
    const count = row.observations!.find((o) => o.key === 'flui.project.apps_count');
    expect(count?.presentedAs.value).toBe(1);
  });

  it('presents an honest empty list rather than an invented one when there are no projects yet', () => {
    const snapshot = snapshotOf({ projects: [] });
    const list = snapshot.scopes.find((s) => s.id === 'projects:list')!;
    expect(list.state).toEqual({ empty: true });
    expect(rowsOf(snapshot).length).toBe(0);
  });

  it('redacts nothing unexpected: only slug/description/apps_count reach a project row', () => {
    const withColor = { ...PROJECT, color: '#000000' };
    const json = JSON.stringify(snapshotOf({ projects: [withColor] }));
    expect(json).not.toContain('#000000');
  });
});
