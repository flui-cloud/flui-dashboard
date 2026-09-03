import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { RestoreJob } from '../../../model/backup.models';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

const PAGE_ID = 'backup-restore';
const LIST_ID = 'backup-restore:list';
const MAX_ROWS = 50;

export function restoreJobEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://restore-job/${id}`;
}

export interface RestoreListSurfaceInput {
  restoreJobs: RestoreJob[];
}

export interface RestoreListSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string | undefined | null, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function rowObservations(r: RestoreJob): Observation[] {
  return [
    textObservation('flui.backup.restore.target_kind', r.targetKind, 'api'),
    textObservation('flui.backup.restore.status', r.status, 'api'),
    textObservation('flui.backup.restore.created_at', r.createdAt, 'api'),
  ].filter((observation): observation is Observation => observation !== null);
}

function rowScope(r: RestoreJob): SemanticScopeSnapshot {
  const entity: EntityReference = { ref: restoreJobEntityRef(r.id), label: r.createdAt, role: 'related' };
  return {
    id: `${LIST_ID}:${r.id}`,
    parentId: LIST_ID,
    kind: 'region',
    entities: [entity],
    observations: rowObservations(r),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

export function presentedContent(input: RestoreListSurfaceInput): PresentedContent {
  const all = input.restoreJobs;
  const rows = all.slice(0, MAX_ROWS);

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Restore jobs',
  };

  const listScope: SemanticScopeSnapshot = {
    id: LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
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

export function buildRestoreListSurface(
  input: RestoreListSurfaceInput,
  context: RestoreListSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/backup/restore',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class RestoreListSurfaceRevision {
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
