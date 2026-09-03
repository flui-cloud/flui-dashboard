import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { BackupPolicy } from '../../../model/backup.models';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

const PAGE_ID = 'backup-policies';
const LIST_ID = 'backup-policies:list';
const MAX_ROWS = 50;

export function policyEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://backup-policy/${id}`;
}

export interface PolicyRow {
  policy: BackupPolicy;
  /** The same `clusterName(p.clusterId)` lookup the row template renders. */
  clusterName: string;
}

export interface PoliciesListSurfaceInput {
  /** Already filtered by the page's own cluster dropdown — the same `filtered()` the
   * template renders (anti-drift, §3.4), not the unfiltered service signal. */
  rows: PolicyRow[];
  totalPolicies: number;
  clusterFilterName: string | null;
  loading: boolean;
}

export interface PoliciesListSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string | undefined | null, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function rowObservations({ policy, clusterName }: PolicyRow): Observation[] {
  return [
    textObservation('flui.backup.policy.cluster', clusterName, 'derived'),
    textObservation('flui.backup.policy.profile', policy.profile, 'api'),
    textObservation('flui.backup.policy.schedule', policy.cronSchedule || 'on-demand', 'api'),
    textObservation('flui.backup.policy.status', policy.status, 'api'),
  ].filter((observation): observation is Observation => observation !== null);
}

function rowScope(row: PolicyRow): SemanticScopeSnapshot {
  const entity: EntityReference = { ref: policyEntityRef(row.policy.id), label: row.policy.name, role: 'related' };
  return {
    id: `${LIST_ID}:${row.policy.id}`,
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

export function presentedContent(input: PoliciesListSurfaceInput): PresentedContent {
  const all = input.rows;
  const rows = all.slice(0, MAX_ROWS);

  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Backup policies',
  };

  const filterObservation = textObservation('flui.backup.policies.cluster_filter', input.clusterFilterName, 'ui');

  const listScope: SemanticScopeSnapshot = {
    id: LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    ...(filterObservation ? { observations: [filterObservation] } : {}),
    completeness: {
      shown: rows.length,
      total: input.totalPolicies,
      ...(input.clusterFilterName ? { filtered: true } : {}),
    },
    state: { loading: input.loading, empty: rows.length === 0 },
  };

  return {
    scopes: [pageScope, listScope, ...rows.map(rowScope)],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildPoliciesListSurface(
  input: PoliciesListSurfaceInput,
  context: PoliciesListSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/backup/policies',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class PoliciesListSurfaceRevision {
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
