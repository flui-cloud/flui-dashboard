import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import { applicationEntityRef } from '../application/application-surface';
import { catalogAppEntityRef } from './catalog-list-surface';
import {
  CatalogDetailSurfaceInput,
  CatalogDetailSurfaceRevision,
  buildCatalogDetailSurface,
  presentedContent,
} from './catalog-detail-surface';

const GENERATED_AT = '2026-09-07T13:00:00.000Z';
const PAGE_ID = 'catalog-detail:immich';

function input(over: Partial<CatalogDetailSurfaceInput> = {}): CatalogDetailSurfaceInput {
  return {
    slug: 'immich',
    detail: {
      slug: 'immich',
      name: 'Immich',
      version: '1.140.0',
      license: 'AGPL-3.0',
      category: 'photos',
      alternativeCount: 2,
      tagCount: 5,
      hasWebsite: true,
      hasDocs: true,
      hasSource: true,
      promptCount: 3,
      sensitivePromptCount: 1,
      editableEnvCount: 4,
    },
    isLoading: false,
    hasDetailError: false,
    activeTab: 'description',
    instances: [
      { id: 'app-1', name: 'immich-prod', status: 'running', catalogVersion: '1.139.0' },
    ],
    updateAvailable: true,
    ...over,
  };
}

function snapshotOf(over: Partial<CatalogDetailSurfaceInput> = {}): SurfaceSnapshot {
  return buildCatalogDetailSurface(input(over), { revision: 1, generatedAt: GENERATED_AT })!;
}

const scope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === id);
const obsOf = (s: SurfaceSnapshot, scopeId: string, key: string) =>
  scope(s, scopeId)?.observations?.find((o) => o.key === key);

describe('catalog detail surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('validates with no instances, on another tab, and on the failed-load card', () => {
    expectValidSurface(snapshotOf({ instances: [], updateAvailable: false }));
    expectValidSurface(snapshotOf({ activeTab: 'configuration' }));
    expectValidSurface(snapshotOf({ detail: null, hasDetailError: true }));
  });

  it('names the catalog app the route asked for, primary, reason route', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([
      { scopeId: PAGE_ID, entityRef: catalogAppEntityRef('immich'), reason: 'route' },
    ]);
    expect(scope(snapshot, PAGE_ID)!.entities).toEqual([
      { ref: catalogAppEntityRef('immich'), label: 'Immich', role: 'primary' },
    ]);
    expect(snapshot.surface.route).toBe('apps/catalog/immich');
  });

  it('emits nothing at all while the detail is still loading — no invented empty page', () => {
    expect(buildCatalogDetailSurface(input({ detail: null, isLoading: true }), { revision: 1, generatedAt: GENERATED_AT })).toBeNull();
    expect(buildCatalogDetailSurface(input({ slug: null }), { revision: 1, generatedAt: GENERATED_AT })).toBeNull();
  });

  it('does describe the failed load, because that card is what the user is looking at', () => {
    const snapshot = snapshotOf({ detail: null, hasDetailError: true });
    expect(snapshot.scopes.map((s) => s.id)).toEqual([PAGE_ID]);
    expect(scope(snapshot, PAGE_ID)!.state).toEqual({
      loading: false,
      error: true,
      errorCode: 'flui.catalog.detail_failed',
    });
    expect(scope(snapshot, PAGE_ID)!.entities![0].ref).toBe(catalogAppEntityRef('immich'));
  });

  it('names one region for the tab the page is really on, not one per tab', () => {
    expect(scope(snapshotOf(), `${PAGE_ID}:tab:description`)).toBeTruthy();
    expect(scope(snapshotOf(), `${PAGE_ID}:tab:configuration`)).toBeUndefined();
    const configured = snapshotOf({ activeTab: 'configuration' });
    expect(configured.scopes.filter((s) => s.id.includes(':tab:')).map((s) => s.id)).toEqual([
      `${PAGE_ID}:tab:configuration`,
    ]);
  });

  it('gives every installed instance the canonical application ref, with its version and status', () => {
    const row = scope(snapshotOf(), `${PAGE_ID}:instances:app-1`)!;
    expect(row.entities).toEqual([{ ref: applicationEntityRef('app-1'), label: 'immich-prod', role: 'related' }]);
    expect(row.observations!.find((o) => o.key === 'flui.application.status')!.presentedAs.text).toBe('running');
    expect(row.observations!.find((o) => o.key === 'flui.application.catalog_version')!.presentedAs.text).toBe('1.139.0');
    expect(obsOf(snapshotOf(), PAGE_ID, 'flui.catalog_app.update_available')!.presentedAs.value).toBe(true);
  });

  it('omits the instances section the page does not draw when nothing is installed', () => {
    expect(scope(snapshotOf({ instances: [] }), `${PAGE_ID}:instances`)).toBeUndefined();
  });

  // Playbook §7: this is the redaction the census called the tightest of the round.
  it('redacts: prompt and env NAMES and defaults never travel — only how many there are', () => {
    const snapshot = snapshotOf();
    expect(obsOf(snapshot, PAGE_ID, 'flui.catalog_app.prompts')!.presentedAs.value).toBe(3);
    expect(obsOf(snapshot, PAGE_ID, 'flui.catalog_app.prompts_sensitive')!.presentedAs.value).toBe(1);
    expect(obsOf(snapshot, PAGE_ID, 'flui.catalog_app.editable_env')!.presentedAs.value).toBe(4);
    // There is no field on the input type that could carry a name or a default in the first
    // place — the redaction is structural, not a filter someone has to remember to apply.
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain('DB_PASSWORD');
    expect(json).not.toContain('default');
    expect(json).not.toContain('k8sNamespace');
  });

  it('bumps the revision on real change (a tab switch), and accepts it against the previous', () => {
    const tracker = new CatalogDetailSurfaceRevision();
    const before = input();
    const first = buildCatalogDetailSurface(before, { revision: tracker.next(presentedContent(before)), generatedAt: GENERATED_AT })!;
    const after = input({ activeTab: 'manifest' });
    const second = buildCatalogDetailSurface(after, {
      revision: tracker.next(presentedContent(after)),
      generatedAt: '2026-09-07T13:00:05.000Z',
    })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when nothing presented actually changed', () => {
    const tracker = new CatalogDetailSurfaceRevision();
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
