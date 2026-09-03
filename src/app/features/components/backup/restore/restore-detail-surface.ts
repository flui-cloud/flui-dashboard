import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { RestoreJob } from '../../../model/backup.models';
import { destinationEntityRef } from '../destinations/destination-detail-surface';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

export function restoreJobEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://restore-job/${id}`;
}

export interface RestoreDetailSurfaceInput {
  job: RestoreJob | null;
}

export interface RestoreDetailSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string | undefined | null, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function valueObservation(key: string, value: boolean, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

function pageObservations(r: RestoreJob): Observation[] {
  return [
    textObservation('flui.backup.restore.target_kind', r.targetKind, 'api'),
    textObservation('flui.backup.restore.target_cluster_id', r.targetClusterId, 'api'),
    textObservation('flui.backup.restore.status', r.status, 'api'),
    textObservation('flui.backup.restore.velero_restore_name', r.veleroRestoreName, 'api'),
    // `errorMessage` is shown on screen but is raw orchestration free text — same exclusion
    // as elsewhere in this producer set; only its presence is safe.
    r.errorMessage ? valueObservation('flui.backup.restore.has_error', true, 'api') : null,
  ].filter((observation): observation is Observation => observation !== null);
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

export function presentedContent(input: RestoreDetailSurfaceInput): PresentedContent | null {
  const r = input.job;
  if (!r) return null;

  const pageId = `backup-restore-detail:${r.id}`;
  const ref = restoreJobEntityRef(r.id);
  const entities: EntityReference[] = [{ ref, label: r.createdAt, role: 'primary' }];

  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    entities,
    observations: pageObservations(r),
  };

  // The source destination is a real, referenceable entity the page names by id — cross-
  // linked with the same ref destination-detail-surface.ts mints, kept as `related` since
  // the restore job (not the destination) is what this page's attention is on.
  const sourceScope: SemanticScopeSnapshot = {
    id: `${pageId}:source`,
    parentId: pageId,
    kind: 'region',
    label: 'Source',
    entities: [{ ref: destinationEntityRef(r.sourceDestinationId), role: 'related' }],
  };

  return {
    scopes: [pageScope, sourceScope],
    attention: [{ scopeId: pageId, entityRef: ref, reason: 'route' }],
  };
}

export function buildRestoreDetailSurface(
  input: RestoreDetailSurfaceInput,
  context: RestoreDetailSurfaceContext,
): SurfaceSnapshot | null {
  const r = input.job;
  const content = presentedContent(input);
  if (!r || !content) return null;

  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'backup-restore-detail',
      route: `management/backup/restore/${r.id}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class RestoreDetailSurfaceRevision {
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
