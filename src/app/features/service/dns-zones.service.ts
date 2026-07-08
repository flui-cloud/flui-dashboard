import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DNSZonesService } from '../../core/api/api/dNSZones.service';
import { ClusterDNSZoneService } from '../../core/api/api/clusterDNSZone.service';
import { InfrastructureClustersService } from '../../core/api/api/infrastructureClusters.service';
import { ProviderManagementService } from '../../core/api/api/providerManagement.service';
import { DnsZoneResponseDto } from '../../core/api/model/dnsZoneResponseDto';
import { CreateDnsZoneDto } from '../../core/api/model/createDnsZoneDto';
import { ProviderConfigurationDto } from '../../core/api/model/providerConfigurationDto';
import { DnsZoneDelegationDto } from '../../core/api/model/dnsZoneDelegationDto';
import { ProviderZone } from '../model/dns.models';

export interface DnsCapableProvider {
  id: string;
  displayName: string;
  dnsZoneDelegation?: DnsZoneDelegationDto;
}

export interface ZoneClusterAssignment {
  clusterId: string;
  clusterName: string;
}

@Injectable({ providedIn: 'root' })
export class DnsZonesService {
  private readonly apiService = inject(DNSZonesService);
  private readonly clusterDnsApi = inject(ClusterDNSZoneService);
  private readonly clustersApi = inject(InfrastructureClustersService);
  private readonly providerManagementApi = inject(ProviderManagementService);

  private readonly zonesData = signal<DnsZoneResponseDto[]>([]);
  private readonly providersData = signal<string[]>([]);
  private readonly dnsCapableProvidersData = signal<DnsCapableProvider[]>([]);
  private readonly providerZonesData = signal<ProviderZone[]>([]);
  private readonly loadingData = signal(false);
  private readonly errorData = signal<string | null>(null);

  readonly zones = this.zonesData.asReadonly();
  readonly providers = this.providersData.asReadonly();
  readonly dnsCapableProviders = this.dnsCapableProvidersData.asReadonly();
  readonly providerZones = this.providerZonesData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly hasZones = computed(() => this.zonesData().length > 0);

  async loadZones(): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const zones = await firstValueFrom(this.apiService.dnsZoneControllerListZones());
      this.zonesData.set(zones ?? []);
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to load DNS zones'));
    } finally {
      this.loadingData.set(false);
    }
  }

  async loadProviders(): Promise<void> {
    try {
      const result = await firstValueFrom(this.apiService.dnsZoneControllerListProviders());
      const list = Array.isArray(result) ? result : (result?.providers ?? []);
      this.providersData.set(list);
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to load DNS providers'));
    }
  }

  /** Loads active configured providers that support DNS zones via capabilities check. */
  async loadDnsCapableProviders(): Promise<void> {
    try {
      const configurations = await firstValueFrom(
        this.providerManagementApi.managementControllerGetUserProviderConfigurations()
      );
      const activeConfigs = configurations.filter(
        (c) => c.status === ProviderConfigurationDto.StatusEnum.Active
      );

      const definitions = await Promise.allSettled(
        activeConfigs.map((c) =>
          firstValueFrom(
            this.providerManagementApi.managementControllerGetProvider(
              c.provider as any
            )
          )
        )
      );

      const capable: DnsCapableProvider[] = [];
      definitions.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.capabilities?.features?.dnsZones) {
          capable.push({
            id: result.value.id,
            displayName: result.value.displayName,
            dnsZoneDelegation: result.value.dnsZoneDelegation,
          });
        }
      });

      this.dnsCapableProvidersData.set(capable);
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to load DNS-capable providers'));
    }
  }

  async loadProviderZones(provider: string): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.apiService.dnsZoneControllerListProviderZones(provider as 'hetzner' | 'none')
      );
      let raw: unknown[];
      if (Array.isArray(result)) raw = result;
      else if (Array.isArray((result as { zones?: unknown[] })?.zones)) raw = (result as { zones: unknown[] }).zones;
      else raw = [];
      const zones: ProviderZone[] = raw.map((z) => {
        const zone = z as { zoneId?: string; id?: string; name?: string; zoneName?: string };
        return { zoneId: zone.zoneId ?? zone.id ?? '', name: zone.name ?? zone.zoneName ?? '' };
      });
      this.providerZonesData.set(zones);
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to load provider zones'));
      this.providerZonesData.set([]);
    }
  }

  async registerZone(dto: CreateDnsZoneDto): Promise<DnsZoneResponseDto | null> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const zone = await firstValueFrom(this.apiService.dnsZoneControllerCreateZone(dto));
      this.zonesData.update(zones => [...zones, zone]);
      return zone;
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        this.errorData.set('This zone is already registered.');
      } else {
        this.errorData.set(this.extractErrorMessage(err, 'Failed to register DNS zone'));
      }
      return null;
    } finally {
      this.loadingData.set(false);
    }
  }

  async deleteZone(id: string): Promise<boolean> {
    this.errorData.set(null);
    try {
      await firstValueFrom(this.apiService.dnsZoneControllerDeleteZone(id));
      this.zonesData.update(zones => zones.filter(z => z.id !== id));
      return true;
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        this.errorData.set('Cannot delete: this zone is still assigned to one or more clusters.');
      } else {
        this.errorData.set(this.extractErrorMessage(err, 'Failed to delete DNS zone'));
      }
      return false;
    }
  }

  /** Returns which clusters currently have this zone assigned. */
  async getZoneAssignedClusters(zoneId: string): Promise<ZoneClusterAssignment[]> {
    let clusters: { id: string; name: string }[] = [];
    try {
      const response = await firstValueFrom(this.clustersApi.clustersControllerListClusters());
      clusters = (response as any[]).map(c => ({ id: c.id, name: c.name ?? c.id }));
    } catch {
      return [];
    }

    const results = await Promise.allSettled(
      clusters.filter(c => !!c.id).map(async c => {
        const assignments = await firstValueFrom(
          this.clusterDnsApi.clusterDnsZoneControllerListZoneAssignments(c.id)
        ).catch(() => []);
        return assignments.some(a => a.dnsZoneId === zoneId)
          ? { clusterId: c.id, clusterName: c.name }
          : null;
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<ZoneClusterAssignment> =>
        r.status === 'fulfilled' && r.value !== null
      )
      .map(r => r.value);
  }

  clearError(): void {
    this.errorData.set(null);
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
