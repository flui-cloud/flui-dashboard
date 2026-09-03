import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { TemplateResponseDto } from '../../../core/api/model/templateResponseDto';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';
const SURFACE_MAX_ROWS = 30;

/** `framework` (e.g. "nextjs") is the stable catalog identifier — the same one the page
 * itself keys `@for (template of ...; track template.framework)` on. */
export function templateEntityRef(framework: string): string {
  return `${SURFACE_NAMESPACE}://template/${framework}`;
}

type Category = 'frontend' | 'backend' | 'fullstack' | 'generic';

const PAGE_ID = 'templates-catalog';
const LIST_ID = `${PAGE_ID}:list`;

export interface TemplatesCatalogSurfaceInput {
  /** `templateService.templates()` — the full catalog, before category/search/deprecated filtering. */
  allTemplates: TemplateResponseDto[];
  /** `filteredTemplates()` — exactly what's rendered as cards right now. */
  filteredTemplates: TemplateResponseDto[];
  /** Effective UI category per template (`getCategory()`'s override applied) — how the
   * category badge on each card was actually presented, not the raw API value (§3.2 item 2). */
  categoryOf: (template: TemplateResponseDto) => Category;
  categoryFilter: '' | Category;
  /** Whether a search query is narrowing the list — never the query text itself, which is
   * a live-typed value and stays out of the snapshot entirely (playbook §5). */
  hasActiveSearch: boolean;
  /** Deep-link target from `?framework=`, only when it names a template still in the
   * rendered set — the page's one real selection concept (the ring-highlighted card). */
  highlightedFramework: string | null;
  isLoading: boolean;
  hasLoadError: boolean;
}

export interface TemplatesCatalogSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(
  key: string,
  value: string | undefined | null,
  source: ObservationSource,
): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function valueObservation(key: string, value: number, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

function pageObservations(input: TemplatesCatalogSurfaceInput): Observation[] {
  return [
    textObservation('flui.templates.category_filter', input.categoryFilter || null, 'ui'),
  ].filter((observation): observation is Observation => observation !== null);
}

function rowObservations(input: TemplatesCatalogSurfaceInput, template: TemplateResponseDto): Observation[] {
  return [
    textObservation('flui.template.category', input.categoryOf(template), 'derived'),
    valueObservation('flui.template.port', template.port, 'api'),
    textObservation('flui.template.healthcheck_path', template.healthcheckPath, 'api'),
    textObservation('flui.template.build_tool', template.buildTool, 'api'),
  ].filter((observation): observation is Observation => observation !== null);
}

function rowScope(
  input: TemplatesCatalogSurfaceInput,
  template: TemplateResponseDto,
  selected: boolean,
): SemanticScopeSnapshot {
  const ref = templateEntityRef(template.framework);
  const entities: EntityReference[] = [
    { ref, label: template.displayName, role: selected ? 'selected' : 'related' },
  ];
  return {
    id: `${LIST_ID}:row:${template.framework}`,
    parentId: LIST_ID,
    kind: 'region',
    entities,
    observations: rowObservations(input, template),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything a snapshot would express, without the revision/timestamp envelope.
 *
 * A browsable catalog, no domain entities created here yet: clicking a card either opens
 * GitHub in a new tab or navigates to the deploy wizard (`?template=`) — never selects in
 * place. Rows are therefore `role: 'related'` by default, matching the plain-list pattern
 * (§4), with one deliberate exception below.
 *
 * `highlightedFramework` (from `?framework=` on the route) is a REAL, product-intentional
 * exception, not an invented one: the page visually rings one specific card
 * (`class.ring-2`/`ring-primary` in the template) when the wizard deep-links back here. That
 * is exactly §3.2 admission criterion 3 — state required to resolve a deictic reference —
 * so, and only when the highlighted framework is actually present among the currently
 * rendered cards, that one row gets `role: 'selected'` and `attention` names it with
 * `reason: 'selection'`. If the highlighted framework has been filtered out by the user's
 * own category/search choice, or does not exist, nothing is invented: attention falls back
 * to the page itself, exactly as a list page with no selection would.
 */
export function presentedContent(input: TemplatesCatalogSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Templates',
    observations: pageObservations(input),
  };

  const all = input.filteredTemplates;
  const rows = all.slice(0, SURFACE_MAX_ROWS);
  const totalAvailable = input.allTemplates.filter((t) => !t.isDeprecated).length;
  const isFiltered = input.categoryFilter !== '' || input.hasActiveSearch;

  const listScope: SemanticScopeSnapshot = {
    id: LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    label: 'Templates',
    state: {
      loading: input.isLoading,
      ...(input.hasLoadError ? { error: true } : {}),
      empty: !input.isLoading && rows.length === 0,
    },
    completeness: {
      shown: rows.length,
      total: all.length,
      ...(isFiltered ? { filtered: true } : {}),
      ...(all.length > rows.length ? { truncated: true } : {}),
    },
  };

  const highlighted = input.highlightedFramework
    ? rows.find((t) => t.framework === input.highlightedFramework)
    : undefined;

  const scopes: SemanticScopeSnapshot[] = [
    pageScope,
    listScope,
    ...rows.map((template) => rowScope(input, template, template === highlighted)),
  ];

  const attention: AttentionTarget[] = highlighted
    ? [{ scopeId: LIST_ID, entityRef: templateEntityRef(highlighted.framework), reason: 'selection' }]
    : [{ scopeId: PAGE_ID, reason: 'route' }];

  return { scopes, attention };
}

export function buildTemplatesCatalogSurface(
  input: TemplatesCatalogSurfaceInput,
  context: TemplatesCatalogSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'templates-catalog',
      route: 'apps/templates',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/**
 * Revision moves only when presented content moves — see application-surface.ts's
 * `ApplicationSurfaceRevision` for the full rationale.
 */
export class TemplatesCatalogSurfaceRevision {
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
