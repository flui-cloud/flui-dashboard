import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { ConnectedRepository } from '../../service/repository.service';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';
const SURFACE_MAX_ROWS = 20;

/** Same ref this repo would carry anywhere else it is referenced (e.g. the deploy wizard,
 * §12.1 item 2: a single canonical ref per entity across views). */
export function repositoryEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://repository/${id}`;
}

export type RepositoriesPageState =
  | 'initializing'
  | 'refused'
  | 'not-configured-admin'
  | 'not-configured-user'
  | 'misconfigured-admin'
  | 'misconfigured-user'
  | 'not-connected'
  | 'connected';

export interface RepositoriesListSurfaceInput {
  pageState: RepositoriesPageState;
  authMethod?: string;
  gitHubUsername?: string;
  allRepos: ConnectedRepository[];
  connectedCount: number;
  autoDeployCount: number;
  /** Import Repositories modal — real checkbox multi-select, but over GitHub candidates
   * that are not yet Flui domain entities (no stable `flui://` ref exists for them until
   * import completes). Modeled as an overlay with a count, never as entity refs — see the
   * producer report for the full reasoning. */
  importModalOpen: boolean;
  importSelectedCount: number;
  /** The delete-confirmation dialog names one specific, already-domain repository — the
   * "opened finding" pattern from the spec's own Annex A.2. */
  deleteModalOpen: boolean;
  repoToDelete: ConnectedRepository | null;
}

export interface RepositoriesListSurfaceContext {
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

function valueObservation(
  key: string,
  value: number | boolean,
  source: ObservationSource,
): Observation {
  return { key, presentedAs: { value }, source };
}

function pageObservations(input: RepositoriesListSurfaceInput): Observation[] {
  const observations: (Observation | null)[] = [
    textObservation('flui.repositories.setup_state', input.pageState, 'ui'),
  ];
  if (input.pageState === 'connected') {
    observations.push(
      textObservation('flui.repositories.auth_method', input.authMethod, 'api'),
      textObservation('flui.repositories.github_username', input.gitHubUsername, 'api'),
      valueObservation('flui.repositories.total', input.allRepos.length, 'derived'),
      valueObservation('flui.repositories.connected_count', input.connectedCount, 'derived'),
      valueObservation('flui.repositories.auto_deploy_count', input.autoDeployCount, 'derived'),
    );
  }
  return observations.filter((observation): observation is Observation => observation !== null);
}

function rowObservations(repo: ConnectedRepository): Observation[] {
  return [
    textObservation('flui.repository.language', repo.language, 'api'),
    textObservation('flui.repository.branch', repo.branch, 'api'),
    valueObservation('flui.repository.connected', repo.connected, 'api'),
    valueObservation('flui.repository.webhook_enabled', repo.webhookEnabled, 'api'),
    valueObservation('flui.repository.auto_deploy_enabled', repo.autoDeployEnabled, 'api'),
  ].filter((observation): observation is Observation => observation !== null);
}

function rowScope(listId: string, repo: ConnectedRepository): SemanticScopeSnapshot {
  const ref = repositoryEntityRef(repo.id);
  const entities: EntityReference[] = [{ ref, label: repo.fullName, role: 'related' }];
  return {
    id: `${listId}:row:${repo.id}`,
    parentId: listId,
    kind: 'region',
    entities,
    observations: rowObservations(repo),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

const PAGE_ID = 'repositories';
const LIST_ID = `${PAGE_ID}:list`;
const IMPORT_OVERLAY_ID = `${PAGE_ID}:import`;
const DELETE_OVERLAY_ID = `${PAGE_ID}:delete`;

/**
 * Everything a snapshot would express, without the revision/timestamp envelope.
 *
 * This page has no single "detail" entity — it is a management page over a funnel (GitHub
 * not connected / misconfigured / connected) plus a list, exactly like Applications List.
 * The main "Imported Repositories" list has no selection either: each row acts through its
 * own "Deploy"/"Remove" button, never a checkbox — so it gets the same plain-list pattern
 * (§4), every row `role: 'related'`.
 *
 * Two real overlays DO carry attention-worthy state, and both are modeled honestly rather
 * than ignored:
 *  - the delete-confirmation dialog names one specific, already-imported repository — the
 *    closest match in this codebase to Annex A.2's "opened finding" (`role: 'selected'`,
 *    `attention` reason `'overlay'`, ranked above the page's own `'route'` claim per §4.1's
 *    default ordering);
 *  - the "Import Repositories" modal has a REAL checkbox multi-select, but over GitHub
 *    candidates that do not yet have a Flui `ref` — they only become a domain
 *    `ConnectedRepository` once import succeeds. Minting a ref for them (e.g. from GitHub's
 *    own numeric id) would misuse the `flui://` namespace for a non-Flui identity and would
 *    let "restart this one" resolve onto something not yet actionable through any Flui
 *    tool. It is presented only as a count on a bare overlay scope, not as entities.
 *
 * If both overlays were somehow open at once (the UI does not offer a path to this — the
 * delete dialog is only reachable from the connected repo list, behind the import modal
 * visually), the delete overlay wins: it names a real, actionable entity, the import
 * overlay does not.
 */
export function presentedContent(input: RepositoriesListSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Repositories',
    observations: pageObservations(input),
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope];
  let attention: AttentionTarget[] = [{ scopeId: PAGE_ID, reason: 'route' }];

  if (input.pageState === 'connected') {
    const all = input.allRepos;
    const rows = all.slice(0, SURFACE_MAX_ROWS);
    const listScope: SemanticScopeSnapshot = {
      id: LIST_ID,
      parentId: PAGE_ID,
      kind: 'list',
      label: 'Imported Repositories',
      state: { loading: false, empty: rows.length === 0 },
      completeness: {
        shown: rows.length,
        total: all.length,
        ...(all.length > rows.length ? { truncated: true } : {}),
      },
    };
    scopes.push(listScope, ...rows.map((repo) => rowScope(LIST_ID, repo)));
  }

  if (input.importModalOpen) {
    scopes.push({
      id: IMPORT_OVERLAY_ID,
      parentId: PAGE_ID,
      kind: 'overlay',
      label: 'Import Repositories',
      observations: [valueObservation('flui.repositories.import_selected_count', input.importSelectedCount, 'ui')],
    });
    attention = [{ scopeId: IMPORT_OVERLAY_ID, reason: 'overlay' }];
  }

  // Delete-confirm wins over the import overlay when both are somehow open — see the
  // reasoning above presentedContent().
  if (input.deleteModalOpen && input.repoToDelete) {
    const ref = repositoryEntityRef(input.repoToDelete.id);
    scopes.push({
      id: DELETE_OVERLAY_ID,
      parentId: PAGE_ID,
      kind: 'overlay',
      label: 'Remove Repository',
      entities: [{ ref, label: input.repoToDelete.fullName, role: 'selected' }],
    });
    attention = [{ scopeId: DELETE_OVERLAY_ID, entityRef: ref, reason: 'overlay' }];
  }

  return { scopes, attention };
}

export function buildRepositoriesListSurface(
  input: RepositoriesListSurfaceInput,
  context: RepositoriesListSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'repositories',
      route: 'apps/repositories',
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
export class RepositoriesListSurfaceRevision {
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
