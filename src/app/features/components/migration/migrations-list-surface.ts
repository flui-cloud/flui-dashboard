import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { MigrationRow } from '../../service/migration.service';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

const PAGE_ID = 'migrations';
const LIST_ID = 'migrations:list';
const MAX_ROWS = 50;

/** Composite identity — the same three migration tables (app/db/full) share no id
 * space, so `type` disambiguates within one percent-encoded segment (§5.1). */
export function migrationEntityRef(row: Pick<MigrationRow, 'type' | 'id'>): string {
  return `${SURFACE_NAMESPACE}://migration/${row.type}:${row.id}`;
}

export interface MigrationsListSurfaceInput {
  migrations: MigrationRow[];
  loading: boolean;
  hasLoadError: boolean;
}

export interface MigrationsListSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string | undefined | null, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function rowObservations(row: MigrationRow): Observation[] {
  return [
    textObservation('flui.migration.type', row.type, 'api'),
    textObservation('flui.migration.status', row.status, 'api'),
    textObservation('flui.migration.cutover_mode', row.cutoverMode, 'api'),
    textObservation('flui.migration.target_cluster_id', row.targetClusterId, 'api'),
    // `errorMessage` is shown on screen but is raw orchestration free text — same
    // exclusion as the backup producers; only its presence is safe.
    row.errorMessage ? { key: 'flui.migration.has_error', presentedAs: { value: true }, source: 'api' as const } : null,
  ].filter((observation): observation is Observation => observation !== null);
}

function rowScope(row: MigrationRow): SemanticScopeSnapshot {
  const entity: EntityReference = { ref: migrationEntityRef(row), role: 'related' };
  return {
    id: `${LIST_ID}:${row.type}:${row.id}`,
    parentId: LIST_ID,
    kind: 'region',
    entities: [entity],
    observations: rowObservations(row),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * A row here is clicked only through inline action buttons (cutover/abort/destroy) — no
 * row opens a detail route — so this is the list-without-selection pattern (§4, pattern
 * 2): attention names only the page, every row is `related`, never `primary`.
 */
export function presentedContent(input: MigrationsListSurfaceInput): PresentedContent {
  const all = input.migrations;
  const rows = all.slice(0, MAX_ROWS);

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Migrations',
    ...(input.hasLoadError ? { state: { error: true } } : {}),
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
    state: { loading: input.loading, empty: rows.length === 0 },
  };

  return {
    scopes: [pageScope, listScope, ...rows.map(rowScope)],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildMigrationsListSurface(
  input: MigrationsListSurfaceInput,
  context: MigrationsListSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/migrations',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class MigrationsListSurfaceRevision {
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
