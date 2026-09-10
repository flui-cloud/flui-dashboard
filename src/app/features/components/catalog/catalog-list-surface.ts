import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  boolObservation,
  buildSurfaceList,
  entityRef,
  scopeIdPart,
  SURFACE_APP_ID,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';

const PAGE_ID = 'catalog';

/** Canonical ref for an app in the catalog, keyed on the slug the routes already use
 * (`/apps/catalog/:slug`). Shared with the catalog detail producer so the same app keeps one
 * ref across the two views (spec §12.1 item 2). It is deliberately NOT
 * `flui://application/...`: nothing is installed here — a catalog entry is an offer. */
export function catalogAppEntityRef(slug: string): string {
  return entityRef('catalog-app', slug);
}

export interface CatalogListRow {
  slug: string;
  name: string;
  category: string;
  /** The card's "Installed · N" badge. */
  installedCount: number;
  /** The card's "update available" badge. */
  updateAvailable: boolean;
}

/** The page groups its cards by kind under a heading with a count — unless `?appKind=`
 * scopes it, and then there is one flat grid. Both shapes are one group here. */
export interface CatalogListGroup {
  kind: string;
  label: string;
  rows: CatalogListRow[];
}

export interface CatalogListSurfaceInput {
  /** `heroTitle()` — the heading really changes with `?appKind=`. */
  heroTitle: string;
  scopedKind: string | null;
  /** Whether the search box holds a term, never the term itself: it is still being typed. */
  hasQuery: boolean;
  activeCategory: string | null;
  /** How many tag chips are lit. The tags themselves are the catalog's own vocabulary and
   * add nothing a consumer could act on — the count is what the page's own "N selected"
   * line says. */
  activeTagCount: number;
  showSystemApps: boolean;
  /** `catalog().length` — everything the last fetch returned, before the page's filters. */
  totalCount: number;
  /** `filteredApps().length` — what survives search, category and tags. */
  shownCount: number;
  groups: CatalogListGroup[];
  isLoading: boolean;
  /** `listError()` — the destructive banner with a Retry button. The message stays out. */
  hasListError: boolean;
}

export interface CatalogListSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

function keep(observations: (Observation | null)[]): Observation[] {
  return observations.filter((o): o is Observation => o !== null);
}

/**
 * Everything the App Catalog page would present, without the revision/timestamp envelope.
 *
 * The rows are what is on the screen AFTER the filters, never `catalog()` itself — a
 * producer that emitted the whole fetched list would be describing the store, not the page
 * (spec §1.3). `completeness` then carries both numbers, so "12 of 108, filtered" is
 * legible without the other 96 being shipped.
 *
 * No selection exists here: a card is a link, and clicking one navigates to the app's detail
 * page. `attention` names the page and nothing else (playbook §4, second case) — the
 * category chip and the tag chips are filters, not a picked entity.
 */
export function presentedContent(input: CatalogListSurfaceInput): PresentedContent {
  const filtered = input.hasQuery || input.activeCategory !== null || input.activeTagCount > 0;

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: input.heroTitle,
    observations: keep([
      textObservation('flui.catalog.scoped_kind', input.scopedKind, 'ui'),
      boolObservation('flui.catalog.searching', input.hasQuery, 'ui'),
      textObservation('flui.catalog.category', input.activeCategory, 'ui'),
      valueObservation('flui.catalog.tags_active', input.activeTagCount, 'ui'),
      boolObservation('flui.catalog.show_system_apps', input.showSystemApps, 'ui'),
      valueObservation('flui.catalog.total', input.totalCount, 'api'),
      valueObservation('flui.catalog.shown', input.shownCount, 'derived'),
    ]),
    state: {
      loading: input.isLoading,
      ...(input.hasListError ? { error: true, errorCode: 'flui.catalog.list_failed' } : {}),
      empty: !input.isLoading && !input.hasListError && input.shownCount === 0,
    },
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope];

  // Nothing below the banner is drawn while the page is loading or has failed: no group is
  // claimed then, rather than a group claimed with invented state.
  if (!input.isLoading && !input.hasListError) {
    for (const group of input.groups) {
      const { scopes: groupScopes } = buildSurfaceList({
        listId: `${PAGE_ID}:${scopeIdPart(group.kind)}`,
        parentId: PAGE_ID,
        label: group.label,
        totalCount: group.rows.length,
        filtered,
        rows: group.rows.map((row) => ({
          id: `${PAGE_ID}:${scopeIdPart(group.kind)}:${scopeIdPart(row.slug)}`,
          ref: catalogAppEntityRef(row.slug),
          label: row.name,
          observations: keep([
            textObservation('flui.catalog_app.category', row.category, 'api'),
            valueObservation('flui.catalog_app.installed', row.installedCount, 'derived'),
            boolObservation('flui.catalog_app.update_available', row.updateAvailable, 'derived'),
          ]),
        })),
      });
      scopes.push(...groupScopes);
    }
  }

  return { scopes, attention: [{ scopeId: PAGE_ID, reason: 'route' }] };
}

export function buildCatalogListSurface(
  input: CatalogListSurfaceInput,
  context: CatalogListSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  const truncated = content.scopes.some((scope) => scope.completeness?.truncated);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'apps/catalog',
      revision: context.revision,
      generatedAt: context.generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Revision moves only when presented content moves — playbook §6 point 1. */
export class CatalogListSurfaceRevision {
  private counter = 0;
  private lastHash = '';

  next(presented: PresentedContent): number {
    const hash = JSON.stringify(presented);
    if (hash !== this.lastHash) {
      this.lastHash = hash;
      this.counter += 1;
    }
    return this.counter;
  }
}
