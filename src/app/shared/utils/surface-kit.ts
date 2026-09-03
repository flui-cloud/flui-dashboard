import type { Observation, ObservationSource, SemanticScopeSnapshot } from '@flui-cloud/semantic-surface';

/**
 * Shared primitives for Semantic Surface producers across this repo — see
 * `docs/agent-surface/producer-playbook.md`. Centralised for the same reason
 * vops's `surface-kit.js` is: §12.1 item 2 wants one canonical `ref` per
 * entity type, and a list page is the same three-layer shape (page → list →
 * one region per row) everywhere it appears in this product.
 */

export const SURFACE_APP_ID = 'flui-dashboard';
export const SURFACE_NAMESPACE = 'flui';

/** A list scope is capped so a huge table cannot become an unbounded dump (spec §9). */
export const SURFACE_MAX_ROWS = 25;

export function entityRef(type: string, id: string): string {
  return `${SURFACE_NAMESPACE}://${type}/${encodeURIComponent(id)}`;
}

/** Two ids composed into one percent-encoded segment — spec §5.1's `<host>:<name>` shape,
 * for entities (a provider instance, a platform component within a cluster) that are only
 * addressable by a compound key. */
export function compositeEntityRef(type: string, a: string, b: string): string {
  return entityRef(type, `${a}:${b}`);
}

export function textObservation(
  key: string,
  value: string | undefined | null,
  source: ObservationSource,
): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

export function valueObservation(
  key: string,
  value: number,
  source: ObservationSource,
  unit?: string,
): Observation {
  return { key, presentedAs: { value, ...(unit ? { unit } : {}) }, source };
}

export function boolObservation(key: string, value: boolean, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

export interface SurfaceListRow {
  /** Row scope id, unique within the list — e.g. `${listId}:${rowKey}`. */
  id: string;
  ref: string;
  label?: string;
  /** Default 'related'. Only a real, per-instance product state (a checkbox, an expanded
   * panel) earns 'selected' — never invented to make attention richer (playbook §4). */
  role?: 'related' | 'selected';
  observations?: Observation[];
}

export interface SurfaceListInput {
  listId: string;
  parentId: string;
  label?: string;
  /** Already the rows to actually render — filtered, not yet capped to {@link SURFACE_MAX_ROWS}. */
  rows: SurfaceListRow[];
  /** The unfiltered count, for `completeness.total`. */
  totalCount: number;
  filtered?: boolean;
  listObservations?: (Observation | null)[];
}

export interface SurfaceListResult {
  scopes: SemanticScopeSnapshot[];
  truncated: boolean;
}

/**
 * Builds a `list` scope plus one `region` scope per visible row, each carrying that row's
 * one entity (role 'related' unless the caller names a real selection) and observations.
 * Per-row `Observation`s live on the row's own scope, never inside the list's, because
 * `presentedAs.value` must stay a compact scalar (§4.6) — there is no way to attach one
 * observation to N entities at once.
 */
export function buildSurfaceList(input: SurfaceListInput): SurfaceListResult {
  const rows = input.rows.slice(0, SURFACE_MAX_ROWS);
  const truncated = input.rows.length > rows.length;

  const listScope: SemanticScopeSnapshot = {
    id: input.listId,
    parentId: input.parentId,
    kind: 'list',
    ...(input.label ? { label: input.label } : {}),
    ...(input.listObservations
      ? { observations: input.listObservations.filter((o): o is Observation => o !== null) }
      : {}),
    completeness: {
      shown: rows.length,
      total: input.totalCount,
      ...(input.filtered ? { filtered: true } : {}),
      ...(truncated ? { truncated: true } : {}),
    },
  };

  const rowScopes: SemanticScopeSnapshot[] = rows.map((row) => ({
    id: row.id,
    parentId: input.listId,
    kind: 'region',
    ...(row.label ? { label: row.label } : {}),
    entities: [{ ref: row.ref, ...(row.label ? { label: row.label } : {}), role: row.role ?? 'related' }],
    ...(row.observations?.length ? { observations: row.observations } : {}),
  }));

  return { scopes: [listScope, ...rowScopes], truncated };
}

/** Canonical ref for a provider-managed compute instance — shared by the Compute list,
 * Instance Detail, and any other page (e.g. VNet Detail's attached servers) that names
 * the same entity, so it keeps one ref across views (spec §12.1 item 2). */
export function instanceEntityRef(provider: string, providerId: string): string {
  return compositeEntityRef('instance', provider, providerId);
}

export function clusterEntityRef(clusterId: string): string {
  return entityRef('cluster', clusterId);
}
