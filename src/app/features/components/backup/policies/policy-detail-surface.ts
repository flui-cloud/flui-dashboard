import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { BackupPolicy, BackupPolicyDestination } from '../../../model/backup.models';
import { destinationEntityRef } from '../destinations/destination-detail-surface';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

export function policyEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://backup-policy/${id}`;
}

export interface PolicyDetailSurfaceInput {
  policy: BackupPolicy | null;
}

export interface PolicyDetailSurfaceContext {
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

function pageObservations(p: BackupPolicy): Observation[] {
  return [
    textObservation('flui.backup.policy.status', p.status, 'api'),
    textObservation('flui.backup.policy.profile', p.profile, 'api'),
    textObservation('flui.backup.policy.scope', p.scope, 'api'),
    textObservation('flui.backup.policy.schedule', p.cronSchedule || 'on-demand', 'api'),
    valueObservation('flui.backup.policy.retention_days', p.retentionDays, 'api'),
    p.retentionMaxCopies != null
      ? valueObservation('flui.backup.policy.retention_max_copies', p.retentionMaxCopies, 'api')
      : null,
    valueObservation('flui.backup.policy.includes_pvc_data', p.includePvcs, 'api'),
  ].filter((observation): observation is Observation => observation !== null);
}

function destinationRowScope(policyPageId: string, d: BackupPolicyDestination): SemanticScopeSnapshot {
  const label = d.destination?.name ?? d.destinationId;
  const entity: EntityReference = { ref: destinationEntityRef(d.destinationId), label, role: 'related' };
  return {
    id: `${policyPageId}:destinations:${d.destinationId}`,
    parentId: `${policyPageId}:destinations`,
    kind: 'region',
    entities: [entity],
    observations: [
      textObservation('flui.backup.policy_destination.role', d.role, 'api'),
      textObservation('flui.backup.policy_destination.replication_status', d.lastReplicationStatus, 'api'),
    ].filter((observation): observation is Observation => observation !== null),
  };
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

export function presentedContent(input: PolicyDetailSurfaceInput): PresentedContent | null {
  const p = input.policy;
  if (!p) return null;

  const pageId = `backup-policy-detail:${p.id}`;
  const ref = policyEntityRef(p.id);
  const entities: EntityReference[] = [{ ref, label: p.name, role: 'primary' }];

  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    label: p.name,
    entities,
    observations: pageObservations(p),
  };

  const destinationsListId = `${pageId}:destinations`;
  const destinationsListScope: SemanticScopeSnapshot = {
    id: destinationsListId,
    parentId: pageId,
    kind: 'list',
    label: 'Destinations',
    completeness: { shown: p.destinations.length, total: p.destinations.length },
  };

  const scopes: SemanticScopeSnapshot[] = [
    pageScope,
    ...(p.destinations.length
      ? [destinationsListScope, ...p.destinations.map((d) => destinationRowScope(pageId, d))]
      : []),
  ];

  return { scopes, attention: [{ scopeId: pageId, entityRef: ref, reason: 'route' }] };
}

export function buildPolicyDetailSurface(
  input: PolicyDetailSurfaceInput,
  context: PolicyDetailSurfaceContext,
): SurfaceSnapshot | null {
  const p = input.policy;
  const content = presentedContent(input);
  if (!p || !content) return null;

  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'backup-policy-detail',
      route: `management/backup/policies/${p.id}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class PolicyDetailSurfaceRevision {
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
