import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  boolObservation,
  buildSurfaceList,
  clusterEntityRef,
  entityRef,
  scopeIdPart,
  SURFACE_APP_ID,
  SurfaceListRow,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import { ConflictGroup, ContextEntry } from '../../model/operating-context.models';

const PAGE_ID = 'operating-context';

export type OperatingContextTab = 'attention' | 'holding' | 'archive';

export function contextNoteEntityRef(id: string): string {
  return entityRef('context-note', id);
}

export interface OperatingContextArchiveInput {
  loading: boolean;
  /** `archiveError()` — the sentence stays out, only whether it failed travels. */
  hasError: boolean;
  entries: ContextEntry[];
}

export interface OperatingContextSurfaceInput {
  loading: boolean;
  /** `loadError()` — the sentence stays out, only whether it failed travels. */
  hasError: boolean;
  /** `firstRun()` — nothing written yet, and no focus applied. A real empty state, not a
   * loading gap. */
  firstRun: boolean;
  focusSlug: string;
  focusClusterId: string;
  focusClusterName?: string;
  /** Same lookup the note card itself reads (`clusterNames()` on the component) — id to
   * display name, for cluster-scoped notes' "level" chip. */
  clusterNames: Record<string, string>;
  activeTab: OperatingContextTab;
  /** `readOnlyHere()` — the sandbox refuses writing here. Not an error: the view itself
   * loaded fine (playbook §6 point 2), this is a capability the fence does not grant. */
  writeRefused: boolean;
  review: ContextEntry[];
  holding: ContextEntry[];
  conflicts: ConflictGroup[];
  /** `conflictsUnread()` — the pairing of who-disagrees-with-whom failed to load, though
   * the notes themselves (above) are all present. A narrower failure than `hasError`. */
  conflictsUnread: boolean;
  archive: OperatingContextArchiveInput;
}

export interface OperatingContextSurfaceContext {
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
 * One note card, wherever it appears (the "needs a look" list, the "in force" list, a
 * conflict group, or the retired archive) — the same fields the card itself reads
 * (`context-note-card.component.ts`).
 *
 * What stays out: `writtenBy`/`confirmedBy`/`archivedBy` — each names a real person, and
 * per the playbook's own caution (§6 point 4) an unclassified identity field is not a
 * judgment call for this producer to make silently; it is presented on-screen today, but
 * whether `@Sensitivity(TENANT_IDENTITY)` actually covers it on the wire was not verified
 * in this pass, so it is left out rather than guessed. `reaches.sentence` is also left
 * out: it is client-composed prose that just re-narrates `scopeType`/`scopeRef`, already
 * carried below as structured fields.
 *
 * For a cluster-scoped note the card's own "level" chip shows the cluster's NAME
 * (`describeScope`/`clusterNames()[ref]`), never the raw id — so this reads the same
 * lookup the card reads, and only falls back to the raw id when the name is not (yet)
 * known, exactly like the card's own fallback.
 */
function rowOf(listId: string, entry: ContextEntry, clusterNames: Record<string, string>): SurfaceListRow {
  return {
    id: `${listId}:${scopeIdPart(entry.id)}`,
    ref: contextNoteEntityRef(entry.id),
    label: entry.title,
    observations: keep([
      textObservation('flui.operating_context.topic', entry.topic, 'api'),
      textObservation('flui.operating_context.body', entry.body, 'api'),
      textObservation('flui.operating_context.validity', entry.confidence, 'api'),
      textObservation('flui.operating_context.nature', entry.nature, 'api'),
      textObservation('flui.operating_context.check_kind', entry.checkedBy, 'api'),
      textObservation('flui.operating_context.scope_type', entry.scopeType, 'api'),
      entry.scopeType === 'cluster' && entry.scopeRef
        ? textObservation(
            'flui.operating_context.scope_cluster',
            clusterNames[entry.scopeRef] ?? entry.scopeRef,
            'derived',
          )
        : null,
      textObservation('flui.operating_context.updated_at', entry.updatedAt, 'api'),
      entry.archivedAt
        ? textObservation('flui.operating_context.archived_at', entry.archivedAt, 'api')
        : null,
    ]),
  };
}

/**
 * Everything the Operating Context page would present, without the revision/timestamp
 * envelope.
 *
 * This is a list page without a real selection (playbook §4, second case): clicking a
 * card acts on it in place (confirm/archive/reword), it never navigates to a "this one
 * note" view, so `attention` names only the page — never a card, even the one somebody
 * just confirmed. The "what reaches a given thing" filter narrows which notes the lists
 * below contain, but it filters, it does not select one of them, so it stays out of
 * `attention` too; when it names a real cluster (chosen from a dropdown of real clusters,
 * unlike the free-typed application slug) that cluster travels as a `related` entity on
 * the page scope, because a consumer resolving "the cluster this delivery is about" can
 * use it.
 *
 * Only the active tab's own list scope(s) are emitted — the other two tabs' notes are not
 * currently on screen, so describing their contents would be a replica of the store, not
 * of what is shown (same discipline as `settings-surface.ts`'s tab handling). The two tab
 * badge counts are the one exception: both are painted on the tab bar regardless of which
 * tab is open, so both travel as page-level observations unconditionally (once the tab
 * bar itself is on screen, i.e. not loading and not first-run).
 */
export function presentedContent(input: OperatingContextSurfaceInput): PresentedContent {
  const tabBarShown = !input.loading && !input.firstRun;
  const needsLookBadge = input.review.length + input.conflicts.length;

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'How this installation is run',
    ...(input.focusClusterId
      ? {
          entities: [
            {
              ref: clusterEntityRef(input.focusClusterId),
              ...(input.focusClusterName ? { label: input.focusClusterName } : {}),
              role: 'related' as const,
            },
          ],
        }
      : {}),
    observations: keep([
      boolObservation('flui.operating_context.first_run', input.firstRun, 'derived'),
      boolObservation(
        'flui.operating_context.focused',
        Boolean(input.focusSlug.trim() || input.focusClusterId),
        'ui',
      ),
      textObservation('flui.operating_context.focus_slug', input.focusSlug.trim() || null, 'ui'),
      textObservation('flui.operating_context.active_tab', input.activeTab, 'ui'),
      boolObservation('flui.operating_context.write_refused', input.writeRefused, 'derived'),
      tabBarShown
        ? valueObservation('flui.operating_context.needs_look_badge', needsLookBadge, 'derived')
        : null,
      tabBarShown
        ? valueObservation('flui.operating_context.holding_badge', input.holding.length, 'derived')
        : null,
    ]),
    state: {
      loading: input.loading,
      empty: input.firstRun,
      ...(input.hasError ? { error: true, errorCode: 'flui.operating_context.load_failed' } : {}),
    },
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope];

  if (tabBarShown && input.activeTab === 'attention') {
    const reviewId = `${PAGE_ID}:review`;
    const brokenCount = input.review.filter((e) => e.confidence === 'broken').length;
    const { scopes: reviewScopes } = buildSurfaceList({
      listId: reviewId,
      parentId: PAGE_ID,
      label: 'Asking to be re-read',
      totalCount: input.review.length,
      rows: input.review.map((e) => rowOf(reviewId, e, input.clusterNames)),
      listObservations: [
        valueObservation('flui.operating_context.review_broken_count', brokenCount, 'derived'),
      ],
    });
    reviewScopes[0] = { ...reviewScopes[0], state: { empty: input.review.length === 0 } };
    scopes.push(...reviewScopes);

    const conflictId = `${PAGE_ID}:conflicts`;
    const conflictRows = input.conflicts.flatMap((group) => group.entries.map((e) => rowOf(conflictId, e, input.clusterNames)));
    const { scopes: conflictScopes } = buildSurfaceList({
      listId: conflictId,
      parentId: PAGE_ID,
      label: 'Where two notes disagree',
      totalCount: conflictRows.length,
      rows: conflictRows,
    });
    conflictScopes[0] = {
      ...conflictScopes[0],
      state: input.conflictsUnread
        ? { empty: true, error: true, errorCode: 'flui.operating_context.conflicts_unread' }
        : { empty: conflictRows.length === 0 },
    };
    scopes.push(...conflictScopes);
  }

  if (tabBarShown && input.activeTab === 'holding') {
    const holdingId = `${PAGE_ID}:holding`;
    const { scopes: holdingScopes } = buildSurfaceList({
      listId: holdingId,
      parentId: PAGE_ID,
      label: 'What still holds',
      totalCount: input.holding.length,
      rows: input.holding.map((e) => rowOf(holdingId, e, input.clusterNames)),
    });
    holdingScopes[0] = { ...holdingScopes[0], state: { empty: input.holding.length === 0 } };
    scopes.push(...holdingScopes);
  }

  if (tabBarShown && input.activeTab === 'archive' && !input.writeRefused) {
    const archiveId = `${PAGE_ID}:archive`;
    const { scopes: archiveScopes } = buildSurfaceList({
      listId: archiveId,
      parentId: PAGE_ID,
      label: 'Why it used to be done this way',
      totalCount: input.archive.entries.length,
      rows: input.archive.entries.map((e) => rowOf(archiveId, e, input.clusterNames)),
    });
    archiveScopes[0] = {
      ...archiveScopes[0],
      state: {
        loading: input.archive.loading,
        empty: input.archive.entries.length === 0,
        ...(input.archive.hasError
          ? { error: true, errorCode: 'flui.operating_context.archive_load_failed' }
          : {}),
      },
    };
    scopes.push(...archiveScopes);
  }

  return { scopes, attention: [{ scopeId: PAGE_ID, reason: 'route' }] };
}

export function buildOperatingContextSurface(
  input: OperatingContextSurfaceInput,
  context: OperatingContextSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  const truncated = content.scopes.some((scope) => scope.completeness?.truncated);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/operating-context',
      revision: context.revision,
      generatedAt: context.generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Revision moves only when presented content moves — playbook §6 point 1. */
export class OperatingContextSurfaceRevision {
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
