import type {
  AttentionTarget,
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import {
  boolObservation,
  buildSurfaceList,
  scopeIdPart,
  SURFACE_APP_ID,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import { applicationEntityRef } from '../application/application-surface';
import {
  RegistryStorageStatus,
  RegistryTraffic,
  RegistryUsage,
  registryProviderLabel,
  usageGauge,
} from '../../model/registry-storage.models';

const PAGE_ID = 'registry-storage';
const USAGE_ID = `${PAGE_ID}:usage`;
const APPS_ID = `${PAGE_ID}:applications`;
const TRAFFIC_ID = `${PAGE_ID}:traffic`;
const BUCKET_ID = `${PAGE_ID}:bucket`;
const CONFIRM_ID = `${PAGE_ID}:confirm-replace`;
const REMOVE_CONFIRM_ID = `${PAGE_ID}:confirm-remove`;

export type RegistryConnectOption = 'scaleway' | 'own';

export interface RegistryStorageSurfaceInput {
  loading: boolean;
  refused: boolean;
  hasLoadError: boolean;
  status: RegistryStorageStatus | null;
  measuring: boolean;
  connecting: RegistryConnectOption | null;
  hasConnectError: boolean;
  connectOpen: boolean;
  confirmReplace: RegistryConnectOption | null;
  replacedBuckets: number;
  replacedCreatedByFlui: number;
  removing: boolean;
  hasRemoveError: boolean;
  confirmRemove: { createdByFlui: boolean } | null;
  traffic: RegistryTraffic | null;
  trafficWindow: string;
  trafficLoading: boolean;
  trafficHidden: boolean;
}

export interface RegistryStorageSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

function keep(observations: (Observation | null)[]): Observation[] {
  return observations.filter((o): o is Observation => o !== null);
}

function backendLabel(status: RegistryStorageStatus): string {
  return status.backend === 's3' ? 'bucket' : 'volume';
}

function pageScopeOf(input: RegistryStorageSurfaceInput, status: RegistryStorageStatus | null): SemanticScopeSnapshot {
  const keepsOwnImages = !!status?.usage;
  return {
    id: PAGE_ID,
    kind: 'page',
    label: 'Image registry',
    observations: keep([
      boolObservation('flui.registry.refused', input.refused, 'api'),
      status ? textObservation('flui.registry.backend', backendLabel(status), 'api') : null,
      status ? boolObservation('flui.registry.own_registry', keepsOwnImages, 'derived') : null,
    ]),
    state: {
      loading: input.loading && !status,
      ...(input.hasLoadError ? { error: true, errorCode: 'flui.registry.load_failed' } : {}),
    },
  };
}

function usageScope(usage: RegistryUsage, measuring: boolean): SemanticScopeSnapshot {
  const gauge = usageGauge(usage);
  return {
    id: USAGE_ID,
    parentId: PAGE_ID,
    kind: 'region',
    label: 'Space in use',
    observations: keep([
      valueObservation('flui.registry.used_bytes', usage.totalBytes, 'api', 'B'),
      usage.capacityBytes != null
        ? valueObservation('flui.registry.capacity_bytes', usage.capacityBytes, 'api', 'B')
        : null,
      usage.alertBytes != null
        ? valueObservation('flui.registry.alert_bytes', usage.alertBytes, 'api', 'B')
        : null,
      gauge.kind !== 'none'
        ? valueObservation('flui.registry.used_percent', Math.round(gauge.percent), 'derived', '%')
        : null,
      boolObservation('flui.registry.alerting', usage.alerting, 'api'),
      valueObservation('flui.registry.unreadable_applications', usage.unreadable, 'api'),
      textObservation('flui.registry.measured_at', usage.measuredAt, 'api'),
      boolObservation('flui.registry.measuring', measuring, 'ui'),
    ]),
  };
}

function trafficObservations(t: RegistryTraffic | null): (Observation | null)[] {
  if (!t) return [];
  return [
    valueObservation('flui.registry.traffic.pulls', t.requests.pulls, 'api'),
    valueObservation('flui.registry.traffic.pushes', t.requests.pushes, 'api'),
    valueObservation('flui.registry.traffic.bytes_out', t.bytesOut, 'api', 'B'),
    valueObservation('flui.registry.traffic.bytes_in', t.bytesIn, 'api', 'B'),
    valueObservation('flui.registry.traffic.peak_out', t.peakBytesPerSecondOut, 'api', 'B/s'),
    valueObservation('flui.registry.traffic.peak_in', t.peakBytesPerSecondIn, 'api', 'B/s'),
    valueObservation('flui.registry.traffic.refused', t.outcomes.refused, 'api'),
    valueObservation('flui.registry.traffic.failed', t.outcomes.failed, 'api'),
    t.readFromBucketBytes !== null
      ? valueObservation('flui.registry.traffic.read_from_bucket', t.readFromBucketBytes, 'api', 'B')
      : null,
  ];
}

function trafficScope(input: RegistryStorageSurfaceInput): SemanticScopeSnapshot {
  return {
    id: TRAFFIC_ID,
    parentId: PAGE_ID,
    kind: 'region',
    label: 'Traffic',
    observations: keep([
      textObservation('flui.registry.traffic.window', input.trafficWindow, 'ui'),
      ...trafficObservations(input.traffic),
    ]),
    state: { loading: input.trafficLoading },
  };
}

function applicationScopes(usage: RegistryUsage): SemanticScopeSnapshot[] {
  const { scopes: listScopes } = buildSurfaceList({
    listId: APPS_ID,
    parentId: PAGE_ID,
    label: 'Largest applications',
    totalCount: usage.applications.length,
    rows: usage.applications.map((app) => ({
      id: `${APPS_ID}:${scopeIdPart(app.applicationId)}`,
      ref: applicationEntityRef(app.applicationId),
      label: app.name,
      observations: [valueObservation('flui.registry.application_bytes', app.bytes, 'api', 'B')],
    })),
  });
  listScopes[0] = {
    ...listScopes[0],
    state: { loading: false, empty: usage.applications.length === 0 },
  };
  return listScopes;
}

function connectedBucketObservations(status: RegistryStorageStatus): (Observation | null)[] {
  if (!status.connected) return [];
  return [
    textObservation('flui.registry.bucket_provider', registryProviderLabel(status.provider), 'derived'),
    textObservation('flui.registry.bucket_region', status.region, 'api'),
    boolObservation('flui.registry.bucket_in_use', status.backend === 's3', 'derived'),
  ];
}

function bucketErrorCode(input: RegistryStorageSurfaceInput): string {
  return input.hasConnectError ? 'flui.registry.connect_failed' : 'flui.registry.remove_failed';
}

function bucketScope(status: RegistryStorageStatus, input: RegistryStorageSurfaceInput): SemanticScopeSnapshot {
  return {
    id: BUCKET_ID,
    parentId: PAGE_ID,
    kind: 'region',
    label: 'Bucket',
    observations: keep([
      boolObservation('flui.registry.bucket_connected', status.connected, 'api'),
      ...connectedBucketObservations(status),
      boolObservation('flui.registry.connect_open', input.connectOpen, 'ui'),
      input.connecting ? textObservation('flui.registry.connecting', input.connecting, 'ui') : null,
      valueObservation('flui.registry.replaced_buckets', input.replacedBuckets, 'api'),
      input.replacedBuckets > 0
        ? valueObservation('flui.registry.replaced_buckets_created_by_flui', input.replacedCreatedByFlui, 'api')
        : null,
      input.removing ? boolObservation('flui.registry.removing_bucket', true, 'ui') : null,
    ]),
    ...(input.hasConnectError || input.hasRemoveError
      ? { state: { error: true, errorCode: bucketErrorCode(input) } }
      : {}),
  };
}

function storedImagesScopes(
  input: RegistryStorageSurfaceInput,
  status: RegistryStorageStatus,
  usage: RegistryUsage,
): SemanticScopeSnapshot[] {
  return [
    usageScope(usage, input.measuring),
    ...(input.trafficHidden ? [] : [trafficScope(input)]),
    ...applicationScopes(usage),
    bucketScope(status, input),
  ];
}

function overlayScope(
  input: RegistryStorageSurfaceInput,
  status: RegistryStorageStatus | null,
): SemanticScopeSnapshot | null {
  if (input.confirmReplace && status?.connected) {
    return {
      id: CONFIRM_ID,
      parentId: PAGE_ID,
      kind: 'overlay',
      label: 'Replace the bucket',
      observations: [
        textObservation('flui.registry.replace_with', input.confirmReplace, 'ui')!,
      ],
    };
  }
  if (input.confirmRemove && status?.usage) {
    return {
      id: REMOVE_CONFIRM_ID,
      parentId: PAGE_ID,
      kind: 'overlay',
      label: input.confirmRemove.createdByFlui ? 'Delete a replaced bucket' : 'Forget a replaced bucket',
      observations: [
        boolObservation('flui.registry.remove_created_by_flui', input.confirmRemove.createdByFlui, 'api'),
      ],
    };
  }
  return null;
}

/**
 * The bucket's name and endpoint are drawn on screen but never travel: the name is a tenant
 * identifier and the endpoint a network one, and no agent question about this page needs
 * either. The form's fields, and above all its keys, are never read here at all.
 */
export function presentedContent(input: RegistryStorageSurfaceInput): PresentedContent {
  const status = input.status;
  const usage = status?.usage;

  const scopes: SemanticScopeSnapshot[] = [pageScopeOf(input, status)];

  if (status && usage) {
    scopes.push(...storedImagesScopes(input, status, usage));
  }

  const overlay = overlayScope(input, status);
  if (!overlay) return { scopes, attention: [{ scopeId: PAGE_ID, reason: 'route' }] };
  scopes.push(overlay);
  return { scopes, attention: [{ scopeId: overlay.id, reason: 'overlay' }] };
}

export function buildRegistryStorageSurface(
  input: RegistryStorageSurfaceInput,
  context: RegistryStorageSurfaceContext,
): SurfaceSnapshot {
  const content = presentedContent(input);
  const truncated = content.scopes.some((scope) => scope.completeness?.truncated);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'management/registry',
      revision: context.revision,
      generatedAt: context.generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class RegistryStorageSurfaceRevision {
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
