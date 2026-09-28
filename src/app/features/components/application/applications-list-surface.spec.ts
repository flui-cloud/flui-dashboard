import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  ApplicationsListSurfaceInput,
  ApplicationsListSurfaceRevision,
  appGroupEntityRef,
  buildApplicationsListSurface,
  presentedContent,
} from './applications-list-surface';
import { AppGroupView } from '../../model/application.models';

function group(over: Partial<AppGroupView> = {}): AppGroupView {
  return {
    id: 'g1',
    type: 'standalone' as AppGroupView['type'],
    name: 'billing-api',
    status: 'running' as AppGroupView['status'],
    category: 'user' as AppGroupView['category'],
    clusterId: 'cluster-1',
    createdAt: '2026-08-20T09:12:00.000Z',
    components: [],
    ...over,
  };
}

function input(over: Partial<ApplicationsListSurfaceInput> = {}): ApplicationsListSurfaceInput {
  return {
    kind: 'APPLICATION' as ApplicationsListSurfaceInput['kind'],
    filteredGroups: [group()],
    totalForKind: 1,
    runningCount: 1,
    failedCount: 0,
    attentionCount: 0,
    noBackupCount: 0,
    filters: { search: '', view: 'all', cluster: '', project: '' },
    activeFiltersCount: 0,
    isInitialLoading: false,
    hasLoadError: false,
    ...over,
  };
}

function snapshotOf(over: Partial<ApplicationsListSurfaceInput> = {}): SurfaceSnapshot {
  return buildApplicationsListSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
}

const pageScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.kind === 'page')!;
const listScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.kind === 'list')!;
const rowScopes = (snapshot: SurfaceSnapshot) => snapshot.scopes.filter((s) => s.kind === 'region');
const observation = (snapshot: SurfaceSnapshot, key: string) =>
  pageScope(snapshot).observations?.find((o) => o.key === key);

describe('applications list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new ApplicationsListSurfaceRevision();
    const first = buildApplicationsListSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-08-20T09:13:00.000Z' });
    const second = buildApplicationsListSurface(
      input({ failedCount: 1 }),
      { revision: tracker.next(presentedContent(input({ failedCount: 1 }))), generatedAt: '2026-08-20T09:14:00.000Z' },
    );
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when only an unpresented input field changes', () => {
    // `filters.search` is never read by presentedContent — it is a live-typed value, kept
    // out on purpose (see the note in applications-list-surface.ts).
    const tracker = new ApplicationsListSurfaceRevision();
    const a = input({ filters: { search: '', view: 'all', cluster: '', project: '' } });
    const b = input({ filters: { search: 'billing', view: 'all', cluster: '', project: '' } });
    const r1 = tracker.next(presentedContent(a));
    const r2 = tracker.next(presentedContent(b));
    expect(r2).toBe(r1);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });

  it('SELECTION MODEL: no entity is ever primary or selected — every row is related, and attention names only the page', () => {
    const snapshot = snapshotOf({ filteredGroups: [group({ id: 'g1' }), group({ id: 'g2', name: 'worker' })] });
    expect(snapshot.attention).toEqual([{ scopeId: `apps-list:APPLICATION`, reason: 'route' }]);
    for (const row of rowScopes(snapshot)) {
      expect(row.entities?.every((e) => e.role === 'related')).toBe(true);
    }
  });

  it('one region scope per rendered row, entity ref namespaced as app-group (a recap group, not a single application)', () => {
    const snapshot = snapshotOf({ filteredGroups: [group({ id: 'g1', name: 'billing-api' })] });
    const rows = rowScopes(snapshot);
    expect(rows.length).toBe(1);
    expect(rows[0].entities).toEqual([{ ref: appGroupEntityRef('g1'), label: 'billing-api', role: 'related' }]);
    expect(rows[0].id).toBe('apps-list:APPLICATION:list:row:g1');
    expect(rows[0].parentId).toBe('apps-list:APPLICATION:list');
  });

  it('caps row scopes at the budget and declares truncation honestly', () => {
    const many = Array.from({ length: 25 }, (_, i) => group({ id: `g${i}`, name: `app-${i}` }));
    const snapshot = snapshotOf({ filteredGroups: many, totalForKind: 25 });
    expect(rowScopes(snapshot).length).toBe(20);
    expect(listScope(snapshot).completeness).toEqual({ shown: 20, total: 25, truncated: true });
  });

  it('declares filtered when a filter narrows the rendered set, distinct from the unfiltered kind total', () => {
    const snapshot = snapshotOf({
      filteredGroups: [group()],
      totalForKind: 9,
      activeFiltersCount: 1,
      filters: { search: '', view: 'attention', cluster: '', project: 'proj-1' },
    });
    expect(listScope(snapshot).completeness).toEqual({ shown: 1, total: 1, filtered: true });
    expect(observation(snapshot, 'flui.applications.total')?.presentedAs.value).toBe(9);
    expect(observation(snapshot, 'flui.applications.filter_view')?.presentedAs.text).toBe('attention');
    expect(observation(snapshot, 'flui.applications.filter_cluster')).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain('proj-1');
  });

  it('presents the attention and no-backup counts, and no backup count when the backup read did not answer', () => {
    const counted = snapshotOf({ attentionCount: 2, noBackupCount: 3 });
    expect(observation(counted, 'flui.applications.attention_count')?.presentedAs.value).toBe(2);
    expect(observation(counted, 'flui.applications.no_backup_count')?.presentedAs.value).toBe(3);
    expect(observation(snapshotOf({ noBackupCount: null }), 'flui.applications.no_backup_count')).toBeUndefined();
  });

  it('never presents the live-typed search box, only committed select filters', () => {
    const json = JSON.stringify(snapshotOf({ filters: { search: 'do-not-leak-this', view: 'all', cluster: '', project: '' } }));
    expect(json).not.toContain('do-not-leak-this');
  });

  it('distinguishes loading, error and empty on the list scope, not on the page', () => {
    expect(listScope(snapshotOf({ isInitialLoading: true, filteredGroups: [] })).state)
      .toEqual({ loading: true, empty: false });
    expect(listScope(snapshotOf({ hasLoadError: true, filteredGroups: [] })).state)
      .toEqual({ loading: false, error: true, empty: true });
    expect(listScope(snapshotOf({ filteredGroups: [] })).state)
      .toEqual({ loading: false, empty: true });
    expect(pageScope(snapshotOf()).state).toBeUndefined();
  });

  it('redacts: no cluster id, project id or raw domain identifiers beyond the entity ref reach the snapshot', () => {
    const g = group({ id: 'g1', clusterId: 'cluster-secret-uuid', projectId: 'proj-secret-uuid' });
    const json = JSON.stringify(snapshotOf({ filteredGroups: [g] }));
    expect(json).not.toContain('cluster-secret-uuid');
    expect(json).not.toContain('proj-secret-uuid');
  });
});
