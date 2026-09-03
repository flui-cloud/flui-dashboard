import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { BackupArtifactLocation, BackupJob } from '../../../model/backup.models';
import { formatBytes } from '../../../model/backup.models';
import { destinationEntityRef } from '../destinations/destination-detail-surface';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

export function jobEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://backup-job/${id}`;
}

export interface JobDetailSurfaceInput {
  job: BackupJob | null;
}

export interface JobDetailSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string | undefined | null, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function valueObservation(key: string, value: number | boolean, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

function pageObservations(j: BackupJob): Observation[] {
  return [
    textObservation('flui.backup.job.trigger_type', j.triggerType, 'api'),
    textObservation('flui.backup.job.status', j.status, 'api'),
    textObservation('flui.backup.job.velero_backup_name', j.veleroBackupName, 'api'),
    textObservation('flui.backup.job.started_at', j.startedAt, 'api'),
    textObservation('flui.backup.job.finished_at', j.finishedAt, 'api'),
    // `errorMessage` is shown on screen but is raw backend/orchestration free text — same
    // exclusion as application-surface.ts's `reconciliationError`; only its presence is safe.
    j.errorMessage ? valueObservation('flui.backup.job.has_error', true, 'api') : null,
  ].filter((observation): observation is Observation => observation !== null);
}

function artifactObservations(j: BackupJob): Observation[] {
  const a = j.artifact;
  if (!a) return [];
  return [
    textObservation('flui.backup.artifact.size', formatBytes(a.sizeBytes), 'derived'),
    a.itemCount != null ? valueObservation('flui.backup.artifact.item_count', a.itemCount, 'api') : null,
    textObservation('flui.backup.artifact.expires_at', a.expiresAt, 'api'),
  ].filter((observation): observation is Observation => observation !== null);
}

function locationRowScope(artifactScopeId: string, loc: BackupArtifactLocation): SemanticScopeSnapshot {
  const label = loc.destination?.name ?? loc.destinationId;
  const entity: EntityReference = { ref: destinationEntityRef(loc.destinationId), label, role: 'related' };
  return {
    id: `${artifactScopeId}:location:${loc.destinationId}`,
    parentId: artifactScopeId,
    kind: 'region',
    entities: [entity],
    observations: [
      textObservation('flui.backup.artifact_location.role', loc.role, 'api'),
      textObservation('flui.backup.artifact_location.state', loc.state, 'api'),
    ].filter((observation): observation is Observation => observation !== null),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

export function presentedContent(input: JobDetailSurfaceInput): PresentedContent | null {
  const j = input.job;
  if (!j) return null;

  const pageId = `backup-job-detail:${j.id}`;
  const ref = jobEntityRef(j.id);
  const entities: EntityReference[] = [{ ref, label: j.startedAt ?? j.createdAt, role: 'primary' }];

  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    entities,
    observations: pageObservations(j),
  };

  const a = j.artifact;
  const artifactId = `${pageId}:artifact`;
  const artifactScope: SemanticScopeSnapshot | null = a
    ? {
        id: artifactId,
        parentId: pageId,
        kind: 'region',
        label: 'Artifact',
        observations: artifactObservations(j),
      }
    : null;

  const locationScopes = a ? a.locations.map((loc) => locationRowScope(artifactId, loc)) : [];

  const scopes: SemanticScopeSnapshot[] = [
    pageScope,
    ...(artifactScope ? [artifactScope, ...locationScopes] : []),
  ];

  return { scopes, attention: [{ scopeId: pageId, entityRef: ref, reason: 'route' }] };
}

export function buildJobDetailSurface(
  input: JobDetailSurfaceInput,
  context: JobDetailSurfaceContext,
): SurfaceSnapshot | null {
  const j = input.job;
  const content = presentedContent(input);
  if (!j || !content) return null;

  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'backup-job-detail',
      route: `management/backup/jobs/${j.id}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class JobDetailSurfaceRevision {
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
