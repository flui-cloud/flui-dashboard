import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import { applicationEntityRef } from '../application/application-surface';
import { appGroupEntityRef } from '../application/applications-list-surface';
import { projectEntityRef } from './projects-surface';
import type { AppGroupView } from '../../model/application.models';
import {
  ProjectWorkloadsSection,
  ProjectWorkloadsSurfaceInput,
  ProjectWorkloadsSurfaceRevision,
  buildProjectWorkloadsSurface,
  presentedContent,
} from './project-workloads-surface';

const GENERATED_AT = '2026-09-07T11:00:00.000Z';

function group(over: Partial<AppGroupView> = {}): AppGroupView {
  return {
    id: 'grp-1',
    type: 'single',
    name: 'demo-api',
    status: 'running',
    category: 'backend',
    clusterId: 'cluster-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    components: [],
    ...over,
  } as AppGroupView;
}

function section(over: Partial<ProjectWorkloadsSection> = {}): ProjectWorkloadsSection {
  return {
    projectId: 'p-1',
    name: 'Acme',
    slug: 'acme',
    summary: '1 application',
    collapsed: false,
    groups: [group()],
    ...over,
  };
}

function input(over: Partial<ProjectWorkloadsSurfaceInput> = {}): ProjectWorkloadsSurfaceInput {
  return {
    sections: [section()],
    projectCount: 1,
    isLoading: false,
    isRefreshing: false,
    canManage: true,
    hasSearch: false,
    kindFilter: '',
    includeSystem: false,
    hideEmpty: false,
    createOpen: false,
    editing: null,
    pendingProjectDelete: null,
    pendingAppDelete: null,
    ...over,
  };
}

function snapshotOf(over: Partial<ProjectWorkloadsSurfaceInput> = {}): SurfaceSnapshot {
  return buildProjectWorkloadsSurface(input(over), { revision: 1, generatedAt: GENERATED_AT });
}

const scope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === id);
const obsOf = (s: SurfaceSnapshot, scopeId: string, key: string) =>
  scope(s, scopeId)?.observations?.find((o) => o.key === key);

describe('project workloads surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('validates with nothing loaded, with nothing to show, and with every overlay open', () => {
    expectValidSurface(snapshotOf({ sections: [], projectCount: 0, isLoading: true }));
    expectValidSurface(snapshotOf({ sections: [], projectCount: 3, hideEmpty: true }));
    expectValidSurface(
      snapshotOf({
        createOpen: true,
        editing: { id: 'p-1', name: 'Acme' },
        pendingAppDelete: { id: 'app-4', name: 'demo-api' },
        pendingProjectDelete: { id: 'p-1', name: 'Acme' },
      }),
    );
  });

  it('names only the page when nothing is open — clicking a row navigates, it does not select', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'project-workloads', reason: 'route' }]);
    expect(scope(snapshot, 'project-workloads:section:p-1:grp-1')!.entities).toEqual([
      { ref: appGroupEntityRef('grp-1'), label: 'demo-api', role: 'related' },
    ]);
  });

  it('marks an empty page empty rather than dropping the state the user is looking at', () => {
    const snapshot = snapshotOf({ sections: [], projectCount: 0, isLoading: true });
    expect(scope(snapshot, 'project-workloads')!.state).toEqual({ loading: true, empty: true });
    expect(snapshot.scopes.map((s) => s.id)).toEqual(['project-workloads']);
  });

  it('gives the unassigned section no project entity — those workloads belong to no project', () => {
    const snapshot = snapshotOf({
      sections: [section({ projectId: null, name: 'Unassigned', slug: undefined, groups: [group({ id: 'grp-9' })] })],
    });
    const list = scope(snapshot, 'project-workloads:section:__unassigned')!;
    expect(list.entities).toBeUndefined();
    expect(list.label).toBe('Unassigned');
    expect(scope(snapshot, 'project-workloads:section:__unassigned:grp-9')!.entities![0].ref).toBe(
      appGroupEntityRef('grp-9'),
    );
  });

  it('claims no rows for a collapsed section, and says why instead of pretending it is empty', () => {
    const snapshot = snapshotOf({ sections: [section({ collapsed: true, groups: [group(), group({ id: 'grp-2' })] })] });
    const list = scope(snapshot, 'project-workloads:section:p-1')!;
    expect(list.completeness).toEqual({ shown: 0, total: 2, filtered: true });
    expect(list.state).toEqual({ loading: false, empty: false });
    expect(
      list.observations!.find((o) => o.key === 'flui.project_workloads.section_collapsed')!.presentedAs.value,
    ).toBe(true);
    expect(scope(snapshot, 'project-workloads:section:p-1:grp-1')).toBeUndefined();
  });

  it('carries the summary line the header prints, and the section slug beside it', () => {
    const list = scope(snapshotOf(), 'project-workloads:section:p-1')!;
    expect(list.observations!.find((o) => o.key === 'flui.project_workloads.section_summary')!.presentedAs.text).toBe(
      '1 application',
    );
    expect(list.observations!.find((o) => o.key === 'flui.project.slug')!.presentedAs.text).toBe('acme');
  });

  it('counts system workloads as a filter, because the page hides them unless asked', () => {
    expect(scope(snapshotOf(), 'project-workloads:section:p-1')!.completeness!.filtered).toBe(true);
    expect(scope(snapshotOf({ includeSystem: true }), 'project-workloads:section:p-1')!.completeness!.filtered).toBeUndefined();
  });

  it('never observes the search term itself, only that one is active', () => {
    const snapshot = snapshotOf({ hasSearch: true });
    expect(obsOf(snapshot, 'project-workloads', 'flui.project_workloads.searching')!.presentedAs.value).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('search_term');
  });

  // Playbook §4, sixth case: the ladder is written down and tested, not left to whichever
  // branch happens to run last.
  it('ranks the create form below the rename form, both below either dialog, project delete on top', () => {
    expect(snapshotOf({ createOpen: true }).attention).toEqual([
      { scopeId: 'project-workloads:create', reason: 'active-view' },
    ]);
    expect(snapshotOf({ createOpen: true, editing: { id: 'p-1', name: 'Acme' } }).attention).toEqual([
      { scopeId: 'project-workloads:edit', entityRef: projectEntityRef('p-1'), reason: 'selection' },
    ]);
    expect(
      snapshotOf({
        createOpen: true,
        editing: { id: 'p-1', name: 'Acme' },
        pendingAppDelete: { id: 'app-4', name: 'demo-api' },
      }).attention,
    ).toEqual([
      { scopeId: 'project-workloads:delete-workload', entityRef: applicationEntityRef('app-4'), reason: 'overlay' },
    ]);
    expect(
      snapshotOf({
        createOpen: true,
        editing: { id: 'p-1', name: 'Acme' },
        pendingAppDelete: { id: 'app-4', name: 'demo-api' },
        pendingProjectDelete: { id: 'p-1', name: 'Acme' },
      }).attention,
    ).toEqual([
      { scopeId: 'project-workloads:delete-project', entityRef: projectEntityRef('p-1'), reason: 'overlay' },
    ]);
  });

  it('keeps the whole page inside the schema ceiling, and says it truncated when it does', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      section({
        projectId: `p-${i}`,
        name: `Project ${i}`,
        slug: `project-${i}`,
        groups: Array.from({ length: 14 }, (__, j) => group({ id: `grp-${i}-${j}`, name: `app-${i}-${j}` })),
      }),
    );
    const snapshot = snapshotOf({ sections: many, projectCount: 20 });
    expect(snapshot.scopes.length).toBeLessThanOrEqual(200);
    expect(scope(snapshot, 'project-workloads:section:p-0')!.completeness).toEqual({
      shown: 10,
      total: 14,
      filtered: true,
      truncated: true,
    });
    expect(obsOf(snapshot, 'project-workloads', 'flui.project_workloads.sections_shown')!.presentedAs.value).toBe(12);
    expect(obsOf(snapshot, 'project-workloads', 'flui.project_workloads.sections_total')!.presentedAs.value).toBe(20);
    expect(snapshot.surface.truncated).toBe(true);
    expectValidSurface(snapshot);
  });

  it('redacts: nothing but status, category and a component count leaves a workload row', () => {
    const json = JSON.stringify(
      snapshotOf({
        sections: [
          section({
            groups: [
              group({
                url: 'https://demo-api.example.com',
                catalogInstallId: 'INSTALL-SECRET',
                components: [{ id: 'c1', name: 'api', slug: 'api' } as never],
              }),
            ],
          }),
        ],
      }),
    );
    expect(json).not.toContain('demo-api.example.com');
    expect(json).not.toContain('INSTALL-SECRET');
    expect(json).not.toContain('clusterId');
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous', () => {
    const tracker = new ProjectWorkloadsSurfaceRevision();
    const before = input();
    const first = buildProjectWorkloadsSurface(before, {
      revision: tracker.next(presentedContent(before)),
      generatedAt: GENERATED_AT,
    });
    const after = input({ pendingProjectDelete: { id: 'p-1', name: 'Acme' } });
    const second = buildProjectWorkloadsSurface(after, {
      revision: tracker.next(presentedContent(after)),
      generatedAt: '2026-09-07T11:00:05.000Z',
    });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when nothing presented actually changed', () => {
    const tracker = new ProjectWorkloadsSurfaceRevision();
    expect(tracker.next(presentedContent(input()))).toBe(tracker.next(presentedContent(input())));
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    expect(validateSurfaceSemantics(stale, { previousSnapshot: first })).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });
});
