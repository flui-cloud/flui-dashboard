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
import { applicationEntityRef } from '../application/application-surface';

const SURFACE_ID = 'catalog-install';

/** Canonical ref for one catalog install — the thing `/apps/catalog/installs/:id` is about.
 * Distinct from the applications it creates, which keep their own `flui://application/<id>`. */
export function catalogInstallEntityRef(id: string): string {
  return entityRef('catalog-install', id);
}

export interface CatalogInstallComponentRow {
  id: string;
  name: string;
  status: string;
  isPrimary: boolean;
}

export interface CatalogInstallSurfaceInput {
  /** From the route. */
  installId: string | null;
  install: {
    id: string;
    slug: string;
    displayName: string;
    /** PENDING · INSTALLING · RUNNING · FAILED — the badge at the top of the page. */
    status: string;
    /** The page says "endpoint provisioning was skipped" and offers the manual panel. */
    skipEndpoint: boolean;
    /** Whether an endpoint was provisioned at all. The FQDN itself never travels — see the
     * note on presentedContent. */
    hasEndpoint: boolean;
    /** `errorMessage` is set. The sentence stays out; that it exists is the fact. */
    hasError: boolean;
  } | null;
  isLoading: boolean;
  /** The page's own "Install not found." card. */
  hasLoadError: boolean;
  /** `progressPct()` — 0 unless the install is still running. */
  progressPct: number;
  /** `readiness()` of the matched endpoint: 'ready' · 'failed' · 'pending'… null when the
   * install has no endpoint to be ready. */
  endpointState: string | null;
  endpointReady: boolean;
  components: CatalogInstallComponentRow[];
  /** How many connect cards the page draws — a composed install can bundle several. */
  databaseComponentCount: number;
}

export interface CatalogInstallSurfaceContext {
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
 * Everything the catalog install page would present, without the revision/timestamp
 * envelope. Detail-page pattern (playbook §4): the install is `role: 'primary'` and holds
 * `attention` with `reason: 'route'`; no snapshot exists until it has loaded, except for the
 * "Install not found." card, which is itself what the user is looking at.
 *
 * REDACTION — the tightest on this round, and two separate calls:
 *  1. `connInfo` never travels in any form. The page draws a connect card with the
 *     coordinates of every bundled database; that is credential material, not metadata, and
 *     the input type above has no field that could carry it. Only how many such cards are on
 *     the screen is said.
 *  2. `resolvedFqdn` does not travel either, and the reason is playbook §6 point 4 rather
 *     than taste: `CatalogInstallResponseDto` in flui-core carries NO `@Sensitivity` on that
 *     field, so it is an unclassified network identifier that passes the masking interceptor
 *     in the clear whatever the user's mask toggle says. That is a hole to close in the DTO,
 *     not one for a producer to route around — so this producer says whether an endpoint
 *     exists and whether it is ready, and leaves the name of the host to the day the field is
 *     classified.
 *
 * The install's `errorMessage` and the progress step label are backend prose and stay out;
 * the status, the percentage and a boolean carry the same news without it.
 */
export function presentedContent(input: CatalogInstallSurfaceInput): PresentedContent | null {
  if (!input.installId) return null;
  const ref = catalogInstallEntityRef(input.installId);
  const pageId = `${SURFACE_ID}:${scopeIdPart(input.installId)}`;

  if (!input.install) {
    if (!input.hasLoadError) return null;
    return {
      scopes: [
        {
          id: pageId,
          kind: 'page',
          label: 'Install',
          entities: [{ ref, role: 'primary' }],
          state: { loading: false, error: true, errorCode: 'flui.catalog_install.not_found' },
        },
      ],
      attention: [{ scopeId: pageId, entityRef: ref, reason: 'route' }],
    };
  }

  const install = input.install;
  const running = install.status === 'INSTALLING' || install.status === 'PENDING';
  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    label: install.displayName,
    entities: [{ ref, label: install.displayName, role: 'primary' }],
    observations: keep([
      textObservation('flui.catalog_install.slug', install.slug, 'api'),
      textObservation('flui.catalog_install.status', install.status, 'api'),
      // Only while the bar is on the screen: a percentage under a finished install would be
      // an observation of something the page is not showing.
      running ? valueObservation('flui.catalog_install.progress', input.progressPct, 'api', '%') : null,
      boolObservation('flui.catalog_install.has_error', install.hasError, 'api'),
      boolObservation('flui.catalog_install.skip_endpoint', install.skipEndpoint, 'api'),
      boolObservation('flui.catalog_install.has_endpoint', install.hasEndpoint, 'api'),
      input.endpointState ? textObservation('flui.catalog_install.endpoint_state', input.endpointState, 'api') : null,
      input.endpointState ? boolObservation('flui.catalog_install.endpoint_ready', input.endpointReady, 'derived') : null,
      valueObservation('flui.catalog_install.database_components', input.databaseComponentCount, 'derived'),
    ]),
    state: { loading: input.isLoading },
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope];

  if (input.components.length > 0) {
    const listId = `${pageId}:components`;
    const { scopes: componentScopes } = buildSurfaceList({
      listId,
      parentId: pageId,
      label: 'Components',
      totalCount: input.components.length,
      rows: input.components.map((component) => ({
        id: `${listId}:${scopeIdPart(component.id)}`,
        ref: applicationEntityRef(component.id),
        label: component.name,
        observations: keep([
          textObservation('flui.application.status', component.status, 'api'),
          boolObservation('flui.application.primary_component', component.isPrimary, 'api'),
        ]),
      })),
    });
    scopes.push(...componentScopes);
  }

  return { scopes, attention: [{ scopeId: pageId, entityRef: ref, reason: 'route' }] };
}

export function buildCatalogInstallSurface(
  input: CatalogInstallSurfaceInput,
  context: CatalogInstallSurfaceContext,
): SurfaceSnapshot | null {
  const content = presentedContent(input);
  if (!content) return null;
  const truncated = content.scopes.some((scope) => scope.completeness?.truncated);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: SURFACE_ID,
      route: `apps/catalog/installs/${input.installId}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Revision moves only when presented content moves — playbook §6 point 1. */
export class CatalogInstallSurfaceRevision {
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
