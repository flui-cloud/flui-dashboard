import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ClusterDNSZoneService } from '../../core/api/api/clusterDNSZone.service';
import { AppEndpointsService as AppEndpointsApi } from '../../core/api/api/appEndpoints.service';
import { SystemDnsStatusResponseDto } from '../../core/api/model/systemDnsStatusResponseDto';
import { AppEndpointResponseDto } from '../../core/api/model/appEndpointResponseDto';
import { ClusterService } from './cluster.service';
import { ClusterType } from '../model/cluster.models';

export interface AppDnsInfo {
  applicationId: string | null;
  endpointId: string | null;
  domain: string | null;
  certStatus: AppEndpointResponseDto['certificateStatus'] | null;
  certMessage: string | null;
  ingressConfigured: boolean;
  stagingCertConfigured: boolean;
  prodCertConfigured: boolean;
  synced: boolean;
  syncedDomain: string | null;
  lastSyncedAt: string | null;
  /** True only when synced===true, syncedDomain===domain, and lastSyncedAt is set */
  isComplete: boolean;
}

export interface DashboardDnsStatus {
  /** DNS zone is assigned to the cluster */
  dnsZoneConfigured: boolean;
  /** At least one app has a configured endpoint */
  hasEndpoints: boolean;
  /** All apps have IN_SYNC endpoints with valid certs */
  fullyConfigured: boolean;
  fluiApi: AppDnsInfo;
  fluiWeb: AppDnsInfo;
  /** null when SSO/Zitadel is not configured for this installation */
  zitadel: AppDnsInfo | null;
}


@Injectable({ providedIn: 'root' })
export class DashboardDnsService {
  private readonly clusterDNSZoneApi = inject(ClusterDNSZoneService);
  private readonly appEndpointsApi = inject(AppEndpointsApi);
  private readonly clusterService = inject(ClusterService);

  private readonly statusData = signal<DashboardDnsStatus | null>(null);
  private readonly loadingData = signal(false);
  private readonly errorData = signal<string | null>(null);
  private readonly targetClusterIdData = signal<string | null>(null);

  readonly status = this.statusData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly targetClusterId = this.targetClusterIdData.asReadonly();

  readonly isFullyConfigured = computed(() => !!this.statusData()?.fullyConfigured);
  readonly needsSetup = computed(() => !this.statusData()?.dnsZoneConfigured);
  readonly hasStatus = computed(() => this.statusData() !== null);

  async load(): Promise<void> {
    const clusters = this.clusterService.clusters();
    const target =
      clusters.find(c => c.clusterType === ClusterType.OBSERVABILITY && !!c.id) ??
      clusters.find(c => !!c.id);

    if (!target?.id) return;

    this.targetClusterIdData.set(target.id);
    this.loadingData.set(true);
    this.errorData.set(null);

    try {
      // Load system status (applicationId, endpointId, domain per app) + endpoints in parallel
      const [systemStatus, endpoints] = await Promise.all([
        firstValueFrom(this.clusterDNSZoneApi.clusterDnsZoneControllerGetSystemDnsStatus(target.id)),
        firstValueFrom(this.appEndpointsApi.appEndpointControllerListEndpoints(target.id)).catch(() => [] as AppEndpointResponseDto[]),
      ]);

      const endpointMap = new Map(endpoints.map(e => [e.id, e]));

      const buildAppInfo = (raw: SystemDnsStatusResponseDto['fluiApi']): AppDnsInfo => {
        const appId = raw?.applicationId ?? null;
        const epId = raw?.endpointId ?? null;
        const ep = epId ? endpointMap.get(epId) : undefined;
        const domain = raw?.domain ?? null;
        const syncedDomain = raw?.syncedDomain ?? null;
        const lastSyncedAt = raw?.lastSyncedAt ?? null;
        const synced = raw?.synced ?? false;
        const endpointWorking = ep?.reconciliationStatus === 'IN_SYNC' && ep?.certificateStatus === 'valid';
        const isComplete =
          (synced && syncedDomain !== null && syncedDomain === domain && lastSyncedAt !== null) ||
          endpointWorking;
        return {
          applicationId: appId,
          endpointId: epId,
          domain,
          certStatus: ep?.certificateStatus ?? null,
          certMessage: ep?.certificateMessage ?? null,
          ingressConfigured: ep?.reconciliationStatus === 'IN_SYNC',
          stagingCertConfigured: raw?.stagingCertConfigured ?? false,
          prodCertConfigured: raw?.prodCertConfigured ?? false,
          synced,
          syncedDomain,
          lastSyncedAt,
          isComplete,
        };
      };

      const fluiApi = buildAppInfo(systemStatus.fluiApi);
      const fluiWeb = buildAppInfo(systemStatus.fluiWeb);
      // zitadel may be null when SSO is not configured for this installation
      const zitadel = systemStatus.zitadel ? buildAppInfo(systemStatus.zitadel) : null;

      const dnsZoneConfigured = !!(fluiApi.endpointId || fluiWeb.endpointId || zitadel?.endpointId || fluiApi.domain || fluiWeb.domain);
      const hasEndpoints = !!(fluiApi.endpointId || fluiWeb.endpointId || zitadel?.endpointId);
      // Only include zitadel in fullyConfigured check when it is present in this installation
      const fullyConfigured = fluiApi.isComplete && fluiWeb.isComplete && (zitadel === null || zitadel.isComplete);

      this.statusData.set({ dnsZoneConfigured, hasEndpoints, fullyConfigured, fluiApi, fluiWeb, zitadel });
    } catch {
      this.errorData.set('Could not load DNS status');
    } finally {
      this.loadingData.set(false);
    }
  }

  refresh(): Promise<void> {
    return this.load();
  }
}
