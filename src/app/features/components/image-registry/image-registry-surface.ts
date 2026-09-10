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

const PAGE_ID = 'image-registry';
const LIST_ID = `${PAGE_ID}:images`;
const CONFIRM_ID = `${PAGE_ID}:confirm`;

/** Canonical ref for a built image, on its own id — never on `imageRef`, which is a registry
 * path and is not what a Flui tool addresses. */
export function imageEntityRef(id: string): string {
  return entityRef('image', id);
}

export interface ImageRegistryRow {
  id: string;
  /** `truncateRef(img.imageRef)` — the LAST path segment, which is all the table prints.
   * The full `ghcr.io/<org>/<repo>` reference stays out: `ImageResponseDto` in flui-core
   * carries no `@Sensitivity` on `imageRef`, so it is an unclassified registry/org identifier
   * (playbook §6 point 4), and the table does not show it either. */
  displayRef: string;
  /** The 7 characters the table prints, not the full sha. */
  commitShortSha: string;
  branch: string;
  tagCount: number;
  isCurrentlyDeployed: boolean;
  createdAt: string;
}

export interface ImageRegistrySurfaceInput {
  /** `filteredImages()` — the rows on the screen, after both filter boxes. */
  rows: ImageRegistryRow[];
  /** `service.images().length` — everything the last load returned. */
  totalCount: number;
  hasSearch: boolean;
  hasTagFilter: boolean;
  isLoading: boolean;
  /** The muted "this is not part of the trial" notice. Deliberately not an error — see
   * presentedContent. */
  refused: boolean;
  /** `service.errorMessage()` — the destructive box. The message itself stays out. */
  hasError: boolean;
  /** The confirm dialog, and which image it is about. */
  confirm: { kind: 'deploy' | 'delete'; imageId: string; label: string } | null;
  actionBusy: boolean;
}

export interface ImageRegistrySurfaceContext {
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
 * Everything the Image Registry page would present, without the revision/timestamp envelope.
 *
 * A plain list page (playbook §4, second case): the table has no checkbox and no selected
 * row — each row acts through its own Deploy/Delete button — so `attention` names only the
 * page, until the confirm dialog opens. That dialog IS a real, per-instance selection of one
 * image, so it takes attention with `reason: 'overlay'` and the image `role: 'selected'`,
 * the same reading `repositories-list-surface.ts` took for its own delete confirmation.
 *
 * The refusal notice is NOT `state.error`. The page draws it in muted grey with an info
 * icon, and its own comment says it is "said in the fence's own words and not painted as a
 * fault" — a capability that is not part of this plan is not a view that failed. It travels
 * as an observation; only a real load failure sets `state.error`, and then as a code, never
 * as the backend's sentence.
 */
export function presentedContent(input: ImageRegistrySurfaceInput): PresentedContent {
  const filtered = input.hasSearch || input.hasTagFilter;

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Image Registry',
    observations: keep([
      valueObservation('flui.image_registry.total', input.totalCount, 'api'),
      valueObservation('flui.image_registry.shown', input.rows.length, 'derived'),
      boolObservation('flui.image_registry.searching', input.hasSearch, 'ui'),
      boolObservation('flui.image_registry.tag_filtered', input.hasTagFilter, 'ui'),
      boolObservation('flui.image_registry.refused', input.refused, 'api'),
    ]),
  };

  const { scopes: listScopes } = buildSurfaceList({
    listId: LIST_ID,
    parentId: PAGE_ID,
    label: 'Images',
    totalCount: input.rows.length,
    filtered,
    rows: input.rows.map((row) => ({
      id: `${LIST_ID}:${scopeIdPart(row.id)}`,
      ref: imageEntityRef(row.id),
      label: row.displayRef,
      role: input.confirm?.imageId === row.id ? ('selected' as const) : ('related' as const),
      observations: keep([
        textObservation('flui.image.branch', row.branch, 'api'),
        textObservation('flui.image.commit', row.commitShortSha, 'api'),
        valueObservation('flui.image.tags', row.tagCount, 'derived'),
        boolObservation('flui.image.deployed', row.isCurrentlyDeployed, 'api'),
        textObservation('flui.image.created_at', row.createdAt, 'api'),
      ]),
    })),
  });
  listScopes[0] = {
    ...listScopes[0],
    state: {
      loading: input.isLoading,
      ...(input.hasError ? { error: true, errorCode: 'flui.image_registry.load_failed' } : {}),
      empty: !input.isLoading && input.rows.length === 0,
    },
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope, ...listScopes];
  let attention: AttentionTarget[] = [{ scopeId: PAGE_ID, reason: 'route' }];

  if (input.confirm) {
    const ref = imageEntityRef(input.confirm.imageId);
    scopes.push({
      id: CONFIRM_ID,
      parentId: PAGE_ID,
      kind: 'overlay',
      label: input.confirm.kind === 'deploy' ? 'Deploy Image' : 'Delete Image',
      entities: [{ ref, label: input.confirm.label, role: 'selected' }],
      observations: [
        textObservation('flui.image_registry.confirm_action', input.confirm.kind, 'ui')!,
        boolObservation('flui.image_registry.action_busy', input.actionBusy, 'ui'),
      ],
    });
    attention = [{ scopeId: CONFIRM_ID, entityRef: ref, reason: 'overlay' }];
  }

  return { scopes, attention };
}

export function buildImageRegistrySurface(
  input: ImageRegistrySurfaceInput,
  context: ImageRegistrySurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  const truncated = content.scopes.some((scope) => scope.completeness?.truncated);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'apps/image-registry',
      revision: context.revision,
      generatedAt: context.generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Revision moves only when presented content moves — playbook §6 point 1. */
export class ImageRegistrySurfaceRevision {
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
