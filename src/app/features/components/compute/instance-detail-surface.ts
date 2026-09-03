import type {
  AttentionTarget,
  EntityReference,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  clusterEntityRef,
  instanceEntityRef,
  SURFACE_APP_ID,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import type { InstanceWithLabels, InstanceOwnership } from '../../model/instance.models';

export interface InstanceDetailSurfaceInput {
  instance: InstanceWithLabels | null;
  ownership: InstanceOwnership;
  clusterInfo: { clusterId?: string; clusterName?: string; nodeType?: string } | null;
}

export interface InstanceDetailSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

/** `createdAt`/`updatedAt` are typed `Date` on the DTO but travel as ISO strings over
 * the wire, same as `Application.lastDeployedAt` in the app producer — this just
 * tolerates either shape rather than assuming the wire type matches the TS type. */
function isoOf(value: unknown): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : String(value);
}

function instanceObservations(instance: InstanceWithLabels): Observation[] {
  const region = instance.regionName || instance.region;
  return [
    textObservation('flui.instance.status', instance.status, 'api'),
    textObservation('flui.instance.provider', instance.provider, 'api'),
    textObservation('flui.instance.region', region, 'api'),
    textObservation('flui.instance.data_center', instance.dataCenter, 'api'),
    valueObservation('flui.instance.cpu_cores', instance.cpuCores, 'api'),
    valueObservation('flui.instance.ram_mb', instance.ramMb, 'api'),
    valueObservation('flui.instance.disk_mb', instance.diskMb, 'api'),
    // `ipConfig.v4/v6.ip` are classified `network-identifier` server-side
    // (instance.dto.ts) — mask mode already substitutes them in the API
    // response `instance` was fetched with (this component re-fetches on
    // every mask-mode toggle, see the constructor effect), so reading the
    // same value the page renders never duplicates a real IP mask mode would
    // otherwise have covered. `macAddress` is explicitly classified `public`
    // (with its own comment explaining why), and `gateway` is never rendered
    // by this page at all, so it stays out.
    textObservation('flui.instance.ip_v4', instance.ipConfig?.v4?.ip, 'api'),
    textObservation('flui.instance.ip_v6', instance.ipConfig?.v6?.ip, 'api'),
    textObservation('flui.instance.mac_address', instance.macAddress, 'api'),
    textObservation('flui.instance.os_type', instance.osType, 'api'),
    textObservation('flui.instance.product_type', instance.productType, 'api'),
    textObservation('flui.instance.product_name', instance.productName, 'api'),
    textObservation('flui.instance.default_user', instance.defaultUser, 'api'),
    textObservation('flui.instance.created_at', isoOf(instance.createdAt), 'api'),
    textObservation('flui.instance.updated_at', isoOf(instance.updatedAt), 'api'),
  ].filter((o): o is Observation => o !== null);
}

function ownershipObservation(ownership: InstanceOwnership): Observation {
  return textObservation('flui.instance.ownership', ownership, 'derived') as Observation;
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything Instance Detail would present, without the revision/timestamp envelope —
 * split out so the revision counter hashes exactly this. Detail pattern (playbook §4,
 * first case): one real instance at the centre, attention always names it with reason
 * "route", same shape as `application-surface.ts`.
 */
export function presentedContent(input: InstanceDetailSurfaceInput): PresentedContent | null {
  const instance = input.instance;
  if (!instance) return null;

  const pageId = `instance-detail:${instance.provider}:${instance.providerId}`;
  const ref = instanceEntityRef(instance.provider, instance.providerId);
  const label = instance.displayName || instance.name;

  const entities: EntityReference[] = [{ ref, label, role: 'primary' }];
  // The cluster banner links out to the cluster this instance belongs to, when it
  // does (getClusterInfo returns null for unmanaged/non-cluster instances) — a
  // related reference, not the page's own attention.
  if (input.clusterInfo?.clusterId) {
    entities.push({
      ref: clusterEntityRef(input.clusterInfo.clusterId),
      label: input.clusterInfo.clusterName,
      role: 'related',
    });
  }

  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    label,
    entities,
    observations: [...instanceObservations(instance), ownershipObservation(input.ownership)],
  };

  const attention: AttentionTarget[] = [{ scopeId: pageId, entityRef: ref, reason: 'route' }];

  return { scopes: [pageScope], attention };
}

export function buildInstanceDetailSurface(
  input: InstanceDetailSurfaceInput,
  context: InstanceDetailSurfaceContext,
): SurfaceSnapshot | null {
  const instance = input.instance;
  const content = presentedContent(input);
  if (!instance || !content) return null;

  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'instance-detail',
      route: `infrastructure/compute/${instance.provider}/${instance.providerId}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Same content-hash approach as {@link ApplicationSurfaceRevision}. */
export class InstanceDetailSurfaceRevision {
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
