import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  CatalogListSurfaceInput,
  CatalogListSurfaceRevision,
  buildCatalogListSurface,
  catalogAppEntityRef,
  presentedContent,
} from './catalog-list-surface';

const GENERATED_AT = '2026-09-07T12:00:00.000Z';

function input(over: Partial<CatalogListSurfaceInput> = {}): CatalogListSurfaceInput {
  return {
    heroTitle: 'Deploy open-source apps in one click',
    scopedKind: null,
    hasQuery: false,
    activeCategory: null,
    activeTagCount: 0,
    showSystemApps: false,
    totalCount: 108,
    shownCount: 3,
    groups: [
      {
        kind: 'DATABASE',
        label: 'Databases',
        rows: [{ slug: 'postgres', name: 'PostgreSQL', category: 'database', installedCount: 2, updateAvailable: true }],
      },
      {
        kind: 'APPLICATION',
        label: 'Applications',
        rows: [
          { slug: 'immich', name: 'Immich', category: 'photos', installedCount: 0, updateAvailable: false },
          { slug: 'gitea', name: 'Gitea', category: 'devtools', installedCount: 1, updateAvailable: false },
        ],
      },
    ],
    isLoading: false,
    hasListError: false,
    ...over,
  };
}

function snapshotOf(over: Partial<CatalogListSurfaceInput> = {}): SurfaceSnapshot {
  return buildCatalogListSurface(input(over), { revision: 1, generatedAt: GENERATED_AT });
}

const scope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === id);
const obsOf = (s: SurfaceSnapshot, scopeId: string, key: string) =>
  scope(s, scopeId)?.observations?.find((o) => o.key === key);

describe('catalog list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('validates while loading, on the error banner, and on the empty state', () => {
    expectValidSurface(snapshotOf({ isLoading: true, groups: [], shownCount: 0 }));
    expectValidSurface(snapshotOf({ hasListError: true, groups: [], shownCount: 0 }));
    expectValidSurface(snapshotOf({ groups: [], shownCount: 0, hasQuery: true }));
  });

  it('names the page and nothing else — a card is a link, not a selection', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'catalog', reason: 'route' }]);
    expect(scope(snapshot, 'catalog:DATABASE:postgres')!.entities).toEqual([
      { ref: catalogAppEntityRef('postgres'), label: 'PostgreSQL', role: 'related' },
    ]);
  });

  it('takes its heading from the page, which really changes with ?appKind=', () => {
    expect(scope(snapshotOf(), 'catalog')!.label).toBe('Deploy open-source apps in one click');
    const scoped = snapshotOf({ heroTitle: 'Add a database', scopedKind: 'DATABASE' });
    expect(scope(scoped, 'catalog')!.label).toBe('Add a database');
    expect(obsOf(scoped, 'catalog', 'flui.catalog.scoped_kind')!.presentedAs.text).toBe('DATABASE');
  });

  it('carries what is on the screen after the filters, with both numbers, never the whole catalog', () => {
    const snapshot = snapshotOf({ hasQuery: true, activeCategory: 'database', activeTagCount: 2 });
    expect(obsOf(snapshot, 'catalog', 'flui.catalog.total')!.presentedAs.value).toBe(108);
    expect(obsOf(snapshot, 'catalog', 'flui.catalog.shown')!.presentedAs.value).toBe(3);
    expect(obsOf(snapshot, 'catalog', 'flui.catalog.tags_active')!.presentedAs.value).toBe(2);
    expect(scope(snapshot, 'catalog:APPLICATION')!.completeness).toEqual({ shown: 2, total: 2, filtered: true });
    // The rows are the two applications on the screen, not the 108 the fetch returned.
    expect(snapshot.scopes.filter((s) => s.kind === 'region').length).toBe(3);
  });

  it('claims no group at all while the page is a skeleton or a red banner', () => {
    expect(snapshotOf({ isLoading: true }).scopes.map((s) => s.id)).toEqual(['catalog']);
    expect(snapshotOf({ hasListError: true }).scopes.map((s) => s.id)).toEqual(['catalog']);
  });

  it('reports the failed fetch as a coded view error, never the backend sentence', () => {
    expect(scope(snapshotOf({ hasListError: true, shownCount: 0 }), 'catalog')!.state).toEqual({
      loading: false,
      error: true,
      errorCode: 'flui.catalog.list_failed',
      empty: false,
    });
  });

  it('marks "No apps match your filters" empty without claiming an error', () => {
    expect(scope(snapshotOf({ groups: [], shownCount: 0, hasQuery: true }), 'catalog')!.state).toEqual({
      loading: false,
      empty: true,
    });
  });

  it('carries the badges a card really shows: how many are installed, and whether one is stale', () => {
    const row = scope(snapshotOf(), 'catalog:DATABASE:postgres')!;
    expect(row.observations!.find((o) => o.key === 'flui.catalog_app.installed')!.presentedAs.value).toBe(2);
    expect(row.observations!.find((o) => o.key === 'flui.catalog_app.update_available')!.presentedAs.value).toBe(true);
  });

  it('never observes the typed query or the individual tags — only that filters are on', () => {
    const json = JSON.stringify(snapshotOf({ hasQuery: true, activeTagCount: 3 }));
    expect(json).not.toContain('query');
    expect(obsOf(JSON.parse(json) as SurfaceSnapshot, 'catalog', 'flui.catalog.searching')!.presentedAs.value).toBe(true);
  });

  it('caps a very long group and says so on the snapshot too', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      slug: `app-${i}`,
      name: `App ${i}`,
      category: 'tools',
      installedCount: 0,
      updateAvailable: false,
    }));
    const snapshot = snapshotOf({
      groups: [{ kind: 'TOOL', label: 'Tools', rows }],
      shownCount: 40,
    });
    expect(scope(snapshot, 'catalog:TOOL')!.completeness).toEqual({ shown: 25, total: 40, truncated: true });
    expect(snapshot.surface.truncated).toBe(true);
    expectValidSurface(snapshot);
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous', () => {
    const tracker = new CatalogListSurfaceRevision();
    const before = input();
    const first = buildCatalogListSurface(before, { revision: tracker.next(presentedContent(before)), generatedAt: GENERATED_AT });
    const after = input({ activeCategory: 'database' });
    const second = buildCatalogListSurface(after, {
      revision: tracker.next(presentedContent(after)),
      generatedAt: '2026-09-07T12:00:05.000Z',
    });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when nothing presented actually changed', () => {
    const tracker = new CatalogListSurfaceRevision();
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
