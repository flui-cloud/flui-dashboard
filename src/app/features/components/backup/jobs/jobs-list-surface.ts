import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { BackupJob } from '../../../model/backup.models';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

const PAGE_ID = 'backup-jobs';
const LIST_ID = 'backup-jobs:list';
const MAX_ROWS = 50;

export function jobEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://backup-job/${id}`;
}

export interface JobsListSurfaceInput {
  jobs: BackupJob[];
  /** Name of the cluster selected in the page's own filter, or null when none is picked
   * yet — the page shows no rows at all until one is (`clusterFilter` in the template). */
  clusterFilterName: string | null;
}

export interface JobsListSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string | undefined | null, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function rowObservations(j: BackupJob): Observation[] {
  return [
    textObservation('flui.backup.job.trigger_type', j.triggerType, 'api'),
    textObservation('flui.backup.job.status', j.status, 'api'),
    textObservation('flui.backup.job.started_at', j.startedAt, 'api'),
    textObservation('flui.backup.job.velero_backup_name', j.veleroBackupName, 'api'),
  ].filter((observation): observation is Observation => observation !== null);
}

function rowScope(j: BackupJob): SemanticScopeSnapshot {
  const entity: EntityReference = { ref: jobEntityRef(j.id), label: j.startedAt ?? j.createdAt, role: 'related' };
  return {
    id: `${LIST_ID}:${j.id}`,
    parentId: LIST_ID,
    kind: 'region',
    entities: [entity],
    observations: rowObservations(j),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

export function presentedContent(input: JobsListSurfaceInput): PresentedContent {
  const all = input.clusterFilterName ? input.jobs : [];
  const rows = all.slice(0, MAX_ROWS);

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Backup jobs',
  };

  const filterObservation = textObservation('flui.backup.jobs.cluster_filter', input.clusterFilterName, 'ui');

  const listScope: SemanticScopeSnapshot = {
    id: LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    ...(filterObservation ? { observations: [filterObservation] } : {}),
    completeness: {
      shown: rows.length,
      total: all.length,
      ...(all.length > rows.length ? { truncated: true } : {}),
    },
    state: { empty: rows.length === 0 },
  };

  return {
    scopes: [pageScope, listScope, ...rows.map(rowScope)],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildJobsListSurface(input: JobsListSurfaceInput, context: JobsListSurfaceContext): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/backup/jobs',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class JobsListSurfaceRevision {
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
