import type {
  AttentionTarget,
  EntityReference,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  SURFACE_APP_ID,
  instanceEntityRef,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import { vnetEntityRef } from './vnet-list-surface';
import type { VNetInfo } from '../../model/vnet.models';
import type { InstanceWithLabels } from '../../model/instance.models';

export interface VNetDetailSurfaceInput {
  vnet: VNetInfo | null;
  totalAttachedServers: number;
  /** Instances resolved from the page's own `serversCache`, one per attached server id
   * that has loaded so far — never fabricated from a bare, unresolved id. */
  attachedInstances: InstanceWithLabels[];
}

export interface VNetDetailSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

// `ipRange` (VNet and subnet CIDRs), subnet `gateway` and route `destination`/`gateway`
// are deliberately NOT presented here, same as in the list producer: `VNetResponseDto`
// carries no `@Sensitivity` decoration at all, so mask mode passes every one of these
// fields through unmasked regardless of its toggle. That is a genuine backend gap, not a
// classification this producer can rely on being safe — flagged in the producer report.
function vnetObservations(vnet: VNetInfo): Observation[] {
  return [
    textObservation('flui.vnet.status', vnet.status, 'api'),
    textObservation('flui.vnet.provider', vnet.provider, 'api'),
    textObservation('flui.vnet.provider_resource_id', vnet.providerResourceId, 'api'),
    valueObservation('flui.vnet.subnet_count', vnet.subnets.length, 'api'),
    valueObservation('flui.vnet.route_count', vnet.routes.length, 'api'),
    valueObservation('flui.vnet.label_count', vnet.labels.length, 'derived'),
  ].filter((o): o is Observation => o !== null);
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Everything VNet Detail would present, without the revision/timestamp envelope. Detail
 * pattern (playbook §4, first case): one real VNet at the centre, attention always names
 * it with reason "route". Attached servers are named as related entities using the same
 * canonical instance ref the Compute pages use (spec §12.1 item 2) — only for instances
 * this page has actually resolved from its own `serversCache`, never from a bare id.
 */
export function presentedContent(input: VNetDetailSurfaceInput): PresentedContent | null {
  const vnet = input.vnet;
  if (!vnet) return null;

  const pageId = `vnet-detail:${vnet.id}`;
  const ref = vnetEntityRef(vnet.id);

  // A server attached to more than one subnet must still resolve to exactly one entity
  // (spec §12.3, `duplicate-entity-ref`) — dedupe by ref, not by subnet membership.
  const seenRefs = new Set<string>();
  const attachedEntities: EntityReference[] = [];
  for (const i of input.attachedInstances) {
    if (!i.provider || !i.providerId) continue;
    const instRef = instanceEntityRef(i.provider, i.providerId);
    if (seenRefs.has(instRef)) continue;
    seenRefs.add(instRef);
    attachedEntities.push({ ref: instRef, label: i.displayName || i.name, role: 'related' });
  }
  const entities: EntityReference[] = [{ ref, label: vnet.name, role: 'primary' }, ...attachedEntities];

  const pageScope: SemanticScopeSnapshot = {
    id: pageId,
    kind: 'page',
    label: vnet.name,
    entities,
    observations: [
      ...vnetObservations(vnet),
      valueObservation('flui.vnet.attached_server_count', input.totalAttachedServers, 'derived'),
    ],
  };

  const attention: AttentionTarget[] = [{ scopeId: pageId, entityRef: ref, reason: 'route' }];

  return { scopes: [pageScope], attention };
}

export function buildVNetDetailSurface(
  input: VNetDetailSurfaceInput,
  context: VNetDetailSurfaceContext,
): SurfaceSnapshot | null {
  const vnet = input.vnet;
  const content = presentedContent(input);
  if (!vnet || !content) return null;

  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: 'vnet-detail',
      route: `infrastructure/vnet/${vnet.id}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class VNetDetailSurfaceRevision {
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
