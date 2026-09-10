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
  SurfaceListRow,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import type {
  PlatformUpdateOperation,
  PlatformUpdateStatus,
} from '../../service/platform-update.service';

const PAGE_ID = 'platform-updates';

/**
 * A distinct entity type from `platform-component` (`platform-components-list-surface.ts`):
 * that one names a runtime object living inside a given cluster (`clusterId` + `key`,
 * e.g. Traefik in cluster X). This one names one of the small, fixed set of *this
 * installation's own* control-plane components (`fluiApi`, `fluiWeb`, ...) — there is no
 * cluster axis, and the identity is the platform's, not the tenant's (per the brief: "una
 * versione di piattaforma è informazione della piattaforma, non del tenant").
 */
export function platformUpdateComponentEntityRef(key: string): string {
  return entityRef('platform-update-component', key);
}

export function platformUpdateOperationEntityRef(id: string): string {
  return entityRef('platform-update-operation', id);
}

export interface PlatformUpdatesSurfaceInput {
  loading: boolean;
  checking: boolean;
  /** `apiUnreachable()` — the API dropped mid-poll or the very first read failed. */
  apiUnreachable: boolean;
  status: PlatformUpdateStatus | null;
  operation: PlatformUpdateOperation | null;
  history: PlatformUpdateOperation[];
  confirming: boolean;
  acknowledged: boolean;
}

export interface PlatformUpdatesSurfaceContext {
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

function isRunning(operation: PlatformUpdateOperation | null): boolean {
  return !!operation && (operation.status === 'PENDING' || operation.status === 'IN_PROGRESS');
}

/**
 * One control-plane component, wherever it is named — the main comparison table when no
 * update is running, or the live per-component step inside `operation`. Both read the
 * same fields off the same `PlatformComponentUpdate`/`PlatformUpdateComponentProgress`
 * shape the template itself reads, never a re-derivation.
 */
function componentRow(
  listId: string,
  key: string,
  label: string,
  observations: (Observation | null)[],
): SurfaceListRow {
  return {
    id: `${listId}:${scopeIdPart(key)}`,
    ref: platformUpdateComponentEntityRef(key),
    label,
    observations: keep(observations),
  };
}

/**
 * One past (or current) update attempt, as the history table shows it.
 *
 * `errorMessage` is deliberately never carried — `platform-update-history.component.ts`
 * interpolates it raw into its "Detail" column, which is exactly the shape the playbook's
 * redaction checklist calls out: only a boolean travels, never the sentence.
 */
function operationRow(listId: string, op: PlatformUpdateOperation): SurfaceListRow {
  const movedComponents = op.components.filter((c) => c.status === 'done').length;
  const durationSeconds =
    op.startedAt && op.completedAt
      ? Math.round((Date.parse(op.completedAt) - Date.parse(op.startedAt)) / 1000)
      : null;
  return {
    id: `${listId}:${scopeIdPart(op.id)}`,
    ref: platformUpdateOperationEntityRef(op.id),
    label: `${op.fromVersion} → ${op.targetVersion}`,
    observations: keep([
      textObservation('flui.platform_update.status', op.status, 'api'),
      textObservation('flui.platform_update.from_version', op.fromVersion, 'api'),
      textObservation('flui.platform_update.target_version', op.targetVersion, 'api'),
      valueObservation('flui.platform_update.migrations', op.migrations, 'api'),
      valueObservation('flui.platform_update.moved_components', movedComponents, 'derived'),
      durationSeconds !== null
        ? valueObservation('flui.platform_update.duration_seconds', durationSeconds, 'derived', 's')
        : null,
      textObservation('flui.platform_update.started_at', op.startedAt, 'api'),
      textObservation('flui.platform_update.completed_at', op.completedAt, 'api'),
      boolObservation('flui.platform_update.failed', !!op.errorMessage, 'api'),
    ]),
  };
}

/**
 * Everything the Updates page would present, without the revision/timestamp envelope.
 *
 * WHAT IS ON SCREEN, and when: an `operation` (running or just finished) always draws its
 * own progress card, on top of everything else; the main comparison table and its
 * advisories only draw while nothing is running (`!isRunning`); the history table always
 * draws, empty or not. Each block below is gated on exactly that same condition, read off
 * `input.operation.status` — never a second "is it running" flag passed in parallel.
 *
 * ATTENTION follows what the page visually leads with: while an update is actively
 * running, that operation — not the page in the abstract — is what a person watches, so
 * `attention` names it (`reason: 'active-view'`, the reserved reason for "not because the
 * route said so, but because this is what the screen is doing right now"). Once nothing
 * is running, the page itself is what is looked at, even if a finished operation's summary
 * card is still visible above the fold.
 *
 * `checkError` (the raw sentence behind "Could not reach the release manifest") and every
 * `errorMessage` on an operation are never carried — only the derived boolean.
 */
export function presentedContent(input: PlatformUpdatesSurfaceInput): PresentedContent {
  const status = input.status;
  const operation = input.operation;
  const running = isRunning(operation);
  const checkFailed = !!status?.checkError;
  const changedCount = status?.components.filter((c) => c.changed).length ?? 0;
  const offReleaseCount =
    status?.components.filter((c) => c.installed && !!c.installedVersion && !c.installedIsRelease).length ?? 0;
  const blockerCount = status?.advisories.filter((a) => a.level === 'blocker').length ?? 0;
  const warningCount = status?.advisories.filter((a) => a.level === 'warning').length ?? 0;
  const infoCount = status?.advisories.filter((a) => a.level === 'info').length ?? 0;

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Updates',
    observations: keep([
      status ? textObservation('flui.platform_update.installed_version', status.installedVersion, 'api') : null,
      status ? textObservation('flui.platform_update.available_version', status.availableVersion, 'api') : null,
      status ? boolObservation('flui.platform_update.update_available', status.updateAvailable, 'api') : null,
      status ? boolObservation('flui.platform_update.applicable', status.applicable, 'api') : null,
      status ? textObservation('flui.platform_update.published_at', status.publishedAt, 'api') : null,
      status ? textObservation('flui.platform_update.checked_at', status.checkedAt, 'api') : null,
      status ? boolObservation('flui.platform_update.check_failed', checkFailed, 'derived') : null,
      boolObservation('flui.platform_update.checking', input.checking, 'ui'),
      status ? valueObservation('flui.platform_update.migrations', status.migrations, 'api') : null,
      status && !checkFailed && status.updateAvailable
        ? valueObservation('flui.platform_update.changed_components', changedCount, 'derived')
        : null,
      status ? valueObservation('flui.platform_update.off_release_components', offReleaseCount, 'derived') : null,
      status && status.advisories.length > 0
        ? valueObservation('flui.platform_update.advisories_blocker_count', blockerCount, 'derived')
        : null,
      status && status.advisories.length > 0
        ? valueObservation('flui.platform_update.advisories_warning_count', warningCount, 'derived')
        : null,
      status && status.advisories.length > 0
        ? valueObservation('flui.platform_update.advisories_info_count', infoCount, 'derived')
        : null,
      status && status.updateAvailable && status.notes.length > 0
        ? valueObservation('flui.platform_update.release_notes_count', status.notes.length, 'api')
        : null,
      boolObservation('flui.platform_update.confirm_dialog_open', input.confirming, 'ui'),
      input.confirming && (status?.migrations ?? 0) > 0
        ? boolObservation('flui.platform_update.migration_acknowledged', input.acknowledged, 'ui')
        : null,
    ]),
    state: {
      loading: input.loading,
      ...(input.apiUnreachable && !status
        ? { error: true, errorCode: 'flui.platform_update.load_failed' }
        : {}),
    },
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope];
  let operationScopeId: string | null = null;

  if (operation) {
    operationScopeId = `${PAGE_ID}:operation`;
    const operationScope: SemanticScopeSnapshot = {
      id: operationScopeId,
      parentId: PAGE_ID,
      kind: 'region',
      label: `${operation.fromVersion} → ${operation.targetVersion}`,
      entities: [
        {
          ref: platformUpdateOperationEntityRef(operation.id),
          label: `${operation.fromVersion} → ${operation.targetVersion}`,
          role: running ? 'primary' : 'related',
        },
      ],
      // `currentStep` and `startedAt` are deliberately absent: neither
      // `platform-update-progress.component.ts` nor this page ever reads them for the
      // live operation (only `platform-update-history.component.ts` reads `startedAt`,
      // for a *finished* operation's duration — see `operationRow` below). Carrying them
      // here would be exactly the "copied an API field nobody looks at" mistake the
      // playbook warns against, not a description of this view.
      observations: keep([
        textObservation('flui.platform_update.status', operation.status, 'api'),
        textObservation('flui.platform_update.from_version', operation.fromVersion, 'api'),
        textObservation('flui.platform_update.target_version', operation.targetVersion, 'api'),
        valueObservation('flui.platform_update.progress', operation.progress, 'api', '%'),
        valueObservation('flui.platform_update.migrations', operation.migrations, 'api'),
        boolObservation('flui.platform_update.awaiting_self_restart', operation.awaitingSelfRestart, 'api'),
        textObservation('flui.platform_update.completed_at', operation.completedAt, 'api'),
        boolObservation('flui.platform_update.failed', !!operation.errorMessage, 'api'),
      ]),
    };
    scopes.push(operationScope);

    const opComponentsId = `${operationScopeId}:components`;
    const { scopes: opComponentScopes } = buildSurfaceList({
      listId: opComponentsId,
      parentId: operationScopeId,
      label: 'Components',
      totalCount: operation.components.length,
      rows: operation.components.map((c) =>
        componentRow(opComponentsId, c.key, c.name, [
          textObservation('flui.platform_update.component_status', c.status, 'api'),
          textObservation('flui.platform_update.component_from_version', c.fromVersion, 'api'),
          textObservation('flui.platform_update.component_target_version', c.targetVersion, 'api'),
        ]),
      ),
    });
    opComponentScopes[0] = {
      ...opComponentScopes[0],
      state: { empty: operation.components.length === 0 },
    };
    scopes.push(...opComponentScopes);
  }

  if (status && !running) {
    const componentsId = `${PAGE_ID}:components`;
    const { scopes: componentScopes } = buildSurfaceList({
      listId: componentsId,
      parentId: PAGE_ID,
      label: 'Components',
      totalCount: status.components.length,
      rows: status.components.map((c) =>
        componentRow(componentsId, c.key, c.deploymentName, [
          textObservation('flui.platform_update.component_role', c.role, 'api'),
          boolObservation('flui.platform_update.component_installed', c.installed, 'api'),
          boolObservation('flui.platform_update.component_observed', c.observed, 'api'),
          textObservation('flui.platform_update.component_installed_version', c.installedVersion, 'api'),
          textObservation('flui.platform_update.component_target_version', c.targetVersion, 'api'),
          boolObservation('flui.platform_update.component_installed_is_release', c.installedIsRelease, 'api'),
          boolObservation('flui.platform_update.component_changed', c.changed, 'api'),
          boolObservation(
            'flui.platform_update.component_restarts_control_plane',
            c.restartsControlPlane,
            'api',
          ),
        ]),
      ),
    });
    componentScopes[0] = { ...componentScopes[0], state: { empty: status.components.length === 0 } };
    scopes.push(...componentScopes);
  }

  const historyId = `${PAGE_ID}:history`;
  const { scopes: historyScopes } = buildSurfaceList({
    listId: historyId,
    parentId: PAGE_ID,
    label: 'Update history',
    totalCount: input.history.length,
    rows: input.history.map((op) => operationRow(historyId, op)),
  });
  historyScopes[0] = { ...historyScopes[0], state: { empty: input.history.length === 0 } };
  scopes.push(...historyScopes);

  const attention: AttentionTarget[] =
    running && operationScopeId
      ? [{ scopeId: operationScopeId, entityRef: platformUpdateOperationEntityRef(operation!.id), reason: 'active-view' }]
      : [{ scopeId: PAGE_ID, reason: 'route' }];

  return { scopes, attention };
}

export function buildPlatformUpdatesSurface(
  input: PlatformUpdatesSurfaceInput,
  context: PlatformUpdatesSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  const truncated = content.scopes.some((scope) => scope.completeness?.truncated);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/updates',
      revision: context.revision,
      generatedAt: context.generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Revision moves only when presented content moves — playbook §6 point 1. */
export class PlatformUpdatesSurfaceRevision {
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
