import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  boolObservation,
  buildSurfaceList,
  scopeIdPart,
  SURFACE_APP_ID,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import { applicationEntityRef } from '../application/application-surface';
import { catalogAppEntityRef } from './catalog-list-surface';

const SURFACE_ID = 'catalog-detail';

/** One already-installed instance of this catalog app, as the "Your instances" list draws it. */
export interface CatalogDetailInstance {
  id: string;
  name: string;
  status: string;
  /** The version that instance was installed from — the page prints it beside the name. */
  catalogVersion?: string;
}

export interface CatalogDetailSurfaceInput {
  /** From the route. */
  slug: string | null;
  detail: {
    slug: string;
    name: string;
    version?: string;
    license?: string;
    category: string;
    /** How many "alternative to X" chips the header draws. The names themselves are catalog
     * marketing copy and carry nothing a consumer could act on. */
    alternativeCount: number;
    tagCount: number;
    hasWebsite: boolean;
    hasDocs: boolean;
    hasSource: boolean;
    /** Configuration tab. Counts ONLY — see the redaction note on presentedContent. */
    promptCount: number;
    sensitivePromptCount: number;
    editableEnvCount: number;
  } | null;
  /** `detailLoading()` — the page is a spinner. */
  isLoading: boolean;
  /** `detailError()` — the red card. The message itself never travels. */
  hasDetailError: boolean;
  activeTab: string;
  instances: CatalogDetailInstance[];
  updateAvailable: boolean;
}

export interface CatalogDetailSurfaceContext {
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
 * Everything the catalog app detail page would present, without the revision/timestamp
 * envelope.
 *
 * PATTERN: the detail page of playbook §4 — the catalog app the route names is held in
 * `attention` with `role: 'primary'` and `reason: 'route'`, and there is no snapshot at all
 * until it is loaded (the page is a spinner and there is no entity to be looking at). The
 * one exception is the failed load: the route still names the app, and the red card IS what
 * the user is looking at, so a page scope is emitted carrying that state and nothing else.
 *
 * The instances below are `flui://application/<id>` — the same canonical ref the application
 * detail page mints, so "open the one that is failing" resolves to the real application and
 * not to some catalog-scoped alias (§12.1 item 2).
 *
 * REDACTION (playbook §7, and the reason this producer looks thinner than the page):
 * `userInputPrompts` and `editableEnv` are environment variable NAMES and their DEFAULTS —
 * the first item on the redaction checklist. Only their counts travel, plus how many prompts
 * the page itself marks sensitive. The Kubernetes namespace each instance prints is internal
 * platform metadata and stays out for the same reason. The description, the rating rows and
 * the "alternative to" names are catalog copy: a count says the page has them without
 * shipping the copy itself.
 */
export function presentedContent(input: CatalogDetailSurfaceInput): PresentedContent | null {
  if (!input.slug) return null;
  const ref = catalogAppEntityRef(input.slug);
  const pageId = `${SURFACE_ID}:${scopeIdPart(input.slug)}`;

  if (!input.detail) {
    if (!input.hasDetailError) return null;
    return {
      scopes: [
        {
          id: pageId,
          kind: 'page',
          label: input.slug,
          entities: [{ ref, label: input.slug, role: 'primary' }],
          state: { loading: false, error: true, errorCode: 'flui.catalog.detail_failed' },
        },
      ],
      attention: [{ scopeId: pageId, entityRef: ref, reason: 'route' }],
    };
  }

  const detail = input.detail;
  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    label: detail.name,
    entities: [{ ref, label: detail.name, role: 'primary' }],
    observations: keep([
      textObservation('flui.catalog_app.version', detail.version, 'api'),
      textObservation('flui.catalog_app.license', detail.license, 'api'),
      textObservation('flui.catalog_app.category', detail.category, 'api'),
      valueObservation('flui.catalog_app.alternatives', detail.alternativeCount, 'derived'),
      valueObservation('flui.catalog_app.tags', detail.tagCount, 'derived'),
      boolObservation('flui.catalog_app.has_website', detail.hasWebsite, 'api'),
      boolObservation('flui.catalog_app.has_docs', detail.hasDocs, 'api'),
      boolObservation('flui.catalog_app.has_source', detail.hasSource, 'api'),
      valueObservation('flui.catalog_app.prompts', detail.promptCount, 'api'),
      valueObservation('flui.catalog_app.prompts_sensitive', detail.sensitivePromptCount, 'api'),
      valueObservation('flui.catalog_app.editable_env', detail.editableEnvCount, 'api'),
      boolObservation('flui.catalog_app.update_available', input.updateAvailable, 'derived'),
    ]),
    state: { loading: input.isLoading },
  };

  // One region for whichever tab the page is actually on — the same pass cluster-surface and
  // application-surface take, rather than a scope per tab that is not on the screen.
  const tabScope: SemanticScopeSnapshot = {
    id: `${pageId}:tab:${scopeIdPart(input.activeTab)}`,
    parentId: pageId,
    kind: 'region',
    label: input.activeTab,
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope, tabScope];

  // The section is drawn only when there is at least one instance.
  if (input.instances.length > 0) {
    const listId = `${pageId}:instances`;
    const { scopes: instanceScopes } = buildSurfaceList({
      listId,
      parentId: pageId,
      label: 'Your instances',
      totalCount: input.instances.length,
      rows: input.instances.map((instance) => ({
        id: `${listId}:${scopeIdPart(instance.id)}`,
        ref: applicationEntityRef(instance.id),
        label: instance.name,
        observations: keep([
          textObservation('flui.application.status', instance.status, 'api'),
          textObservation('flui.application.catalog_version', instance.catalogVersion, 'api'),
        ]),
      })),
    });
    scopes.push(...instanceScopes);
  }

  return { scopes, attention: [{ scopeId: pageId, entityRef: ref, reason: 'route' }] };
}

export function buildCatalogDetailSurface(
  input: CatalogDetailSurfaceInput,
  context: CatalogDetailSurfaceContext,
): SurfaceSnapshot | null {
  const content = presentedContent(input);
  if (!content) return null;
  const truncated = content.scopes.some((scope) => scope.completeness?.truncated);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: SURFACE_ID,
      route: `apps/catalog/${input.slug}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Revision moves only when presented content moves — playbook §6 point 1. */
export class CatalogDetailSurfaceRevision {
  private counter = 0;
  private lastHash = '';

  next(presented: PresentedContent | null): number {
    const hash = JSON.stringify(presented);
    if (hash !== this.lastHash) {
      this.lastHash = hash;
      this.counter += 1;
    }
    return this.counter;
  }
}
