/**
 * VNet Service
 *
 * Manages Virtual Network state and API interactions using Angular signals.
 * Follows the established pattern from ClusterService.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VNetsService } from '../../core/api/api/vNets.service';
import { SubnetsService } from '../../core/api/api/subnets.service';
import {
  VNetResponseDto,
  VNetListResponseDto,
  CreateVNetDto,
  AddSubnetDto,
  AttachServerToSubnetDto,
  DetachServerFromSubnetDto,
  SubnetResponseDto,
  VNetRouteResponseDto
} from '../../core/api/model/models';
import {
  VNetInfo,
  SubnetInfo,
  RouteInfo,
  VNetStatus,
  CreateVNetConfiguration,
  AddSubnetConfiguration,
  VNetStatistics,
  AttachServerToSubnetConfiguration,
  DetachServerFromSubnetConfiguration,
  getAllAttachedServerIds
} from '../model/vnet.models';

@Injectable({
  providedIn: 'root'
})
export class VNetService {
  private readonly vnetApi = inject(VNetsService);
  private readonly subnetsApi = inject(SubnetsService);

  private readonly vnetsList = signal<VNetInfo[]>([]);
  private readonly selectedVNetInfo = signal<VNetInfo | null>(null);
  private readonly isLoading = signal<boolean>(false);
  private readonly error = signal<string | null>(null);
  private readonly selectedVNetId = signal<string | null>(null);

  readonly vnets = this.vnetsList.asReadonly();
  readonly selectedVNet = this.selectedVNetInfo.asReadonly();
  readonly loading = this.isLoading.asReadonly();
  readonly errorMessage = this.error.asReadonly();
  readonly selectedId = this.selectedVNetId.asReadonly();

  readonly hasVNets = computed(() => this.vnetsList().length > 0);

  readonly hasSelectedVNet = computed(() => !!this.selectedVNetInfo());

  readonly statistics = computed((): VNetStatistics => {
    const vnets = this.vnetsList();
    return {
      total: vnets.length,
      active: vnets.filter(v => v.status === VNetStatus.ACTIVE).length,
      pending: vnets.filter(v => v.status === VNetStatus.PENDING).length,
      failed: vnets.filter(v => v.status === VNetStatus.FAILED).length,
      totalSubnets: vnets.reduce((sum, v) => sum + v.subnets.length, 0),
      totalAttachedServers: vnets.reduce((sum, v) =>
        sum + getAllAttachedServerIds(v).length, 0)
    };
  });

  readonly vnetById = computed(() => {
    const id = this.selectedVNetId();
    if (!id) return null;
    return this.vnetsList().find(v => v.id === id) || null;
  });

  /**
   * Load all VNets from API
   * @param provider Optional provider filter
   * @param clusterId Optional cluster ID filter
   */
  async loadVNets(provider?: string, clusterId?: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.vnetApi.vNetsControllerListVNets(provider, clusterId)
      );

      const vnets = this.mapListResponseToVNetInfo(response);
      this.vnetsList.set(vnets);
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to load VNets';
      this.error.set(errorMsg);
      console.error('Failed to load VNets:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Get a specific VNet by ID
   * @param id VNet UUID
   */
  async getVNet(id: string): Promise<VNetInfo> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.vnetApi.vNetsControllerGetVNet(id)
      );

      const vnet = this.mapDtoToVNetInfo(response);
      this.selectedVNetInfo.set(vnet);
      this.selectedVNetId.set(id);

      this.vnetsList.update(vnets => {
        const index = vnets.findIndex(v => v.id === id);
        if (index !== -1) {
          const updated = [...vnets];
          updated[index] = vnet;
          return updated;
        }
        return vnets;
      });

      return vnet;
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to get VNet';
      this.error.set(errorMsg);
      console.error('Failed to get VNet:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Get VNet by provider resource ID
   * @param providerResourceId Provider-specific VNet ID
   */
  async getVNetByProviderResourceId(providerResourceId: string): Promise<VNetInfo> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.vnetApi.vNetsControllerGetVNetByProviderResourceId(providerResourceId)
      );

      const vnet = this.mapDtoToVNetInfo(response);
      this.selectedVNetInfo.set(vnet);
      return vnet;
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to get VNet by provider ID';
      this.error.set(errorMsg);
      console.error('Failed to get VNet by provider ID:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Create a new VNet
   * @param config VNet configuration
   */
  async createVNet(config: CreateVNetConfiguration): Promise<VNetInfo> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const dto: CreateVNetDto = {
        name: config.name,
        provider: config.provider as any,
        ipRange: config.ipRange,
        labels: config.labels?.map(l => `${l.key}:${l.value}`),
        metadata: config.metadata,
        subnets: config.subnet ? [{
          networkZone: config.subnet.networkZone,
          ipRange: config.subnet.ipRange,
          vswitchId: config.subnet.vswitchId
        }] : undefined
      };

      const response = await firstValueFrom(
        this.vnetApi.vNetsControllerCreateVNet(dto)
      );

      const vnet = this.mapDtoToVNetInfo(response);

      this.vnetsList.update(vnets => [...vnets, vnet]);

      return vnet;
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to create VNet';
      this.error.set(errorMsg);
      console.error('Failed to create VNet:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Delete a VNet
   * @param id VNet UUID
   */
  async deleteVNet(id: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(
        this.vnetApi.vNetsControllerDeleteVNet(id)
      );

      this.vnetsList.update(vnets => vnets.filter(v => v.id !== id));

      if (this.selectedVNetId() === id) {
        this.selectedVNetInfo.set(null);
        this.selectedVNetId.set(null);
      }
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to delete VNet';
      this.error.set(errorMsg);
      console.error('Failed to delete VNet:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Sync VNet from cloud provider
   * @param id VNet UUID
   */
  async syncVNet(id: string): Promise<VNetInfo> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.vnetApi.vNetsControllerSyncVNet(id)
      );

      const vnet = this.mapDtoToVNetInfo(response);

      // Update in list
      this.vnetsList.update(vnets => {
        const index = vnets.findIndex(v => v.id === id);
        if (index !== -1) {
          const updated = [...vnets];
          updated[index] = vnet;
          return updated;
        }
        return vnets;
      });

      // Update selected if it's the same
      if (this.selectedVNetId() === id) {
        this.selectedVNetInfo.set(vnet);
      }

      return vnet;
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to sync VNet';
      this.error.set(errorMsg);
      console.error('Failed to sync VNet:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Add a subnet to a VNet
   * @param vnetId VNet UUID
   * @param config Subnet configuration
   */
  async addSubnet(vnetId: string, config: AddSubnetConfiguration): Promise<VNetInfo> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const dto: AddSubnetDto = {
        networkZone: config.networkZone,
        ipRange: config.ipRange,
        vswitchId: config.vswitchId
      };

      const response = await firstValueFrom(
        this.vnetApi.vNetsControllerAddSubnet(vnetId, dto)
      );

      const vnet = this.mapDtoToVNetInfo(response);

      // Update in list
      this.vnetsList.update(vnets => {
        const index = vnets.findIndex(v => v.id === vnetId);
        if (index !== -1) {
          const updated = [...vnets];
          updated[index] = vnet;
          return updated;
        }
        return vnets;
      });

      // Update selected if it's the same
      if (this.selectedVNetId() === vnetId) {
        this.selectedVNetInfo.set(vnet);
      }

      return vnet;
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to add subnet';
      this.error.set(errorMsg);
      console.error('Failed to add subnet:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Delete a subnet from a VNet
   * @param vnetId VNet UUID
   * @param subnetId Subnet provider resource ID
   */
  async deleteSubnet(vnetId: string, subnetId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(
        this.vnetApi.vNetsControllerDeleteSubnet(vnetId, subnetId)
      );

      // Update VNet in list (remove subnet)
      this.vnetsList.update(vnets => {
        const index = vnets.findIndex(v => v.id === vnetId);
        if (index !== -1) {
          const updated = [...vnets];
          updated[index] = {
            ...updated[index],
            subnets: updated[index].subnets.filter(s => s.providerSubnetId !== subnetId)
          };
          return updated;
        }
        return vnets;
      });

      // Update selected if it's the same
      if (this.selectedVNetId() === vnetId) {
        this.selectedVNetInfo.update(current => {
          if (!current) return null;
          return {
            ...current,
            subnets: current.subnets.filter(s => s.providerSubnetId !== subnetId)
          };
        });
      }
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to delete subnet';
      this.error.set(errorMsg);
      console.error('Failed to delete subnet:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Attach a server to a specific subnet
   * @param subnetId Subnet UUID
   * @param config Server attachment configuration
   */
  async attachServerToSubnet(
    subnetId: string,
    config: AttachServerToSubnetConfiguration
  ): Promise<SubnetInfo> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const dto: AttachServerToSubnetDto = {
        serverId: config.serverId,
        ip: config.ip,
        aliasIps: config.aliasIps
      };

      const response = await firstValueFrom(
        this.subnetsApi.subnetsControllerAttachServer(subnetId, dto)
      );

      const subnet = this.mapSubnetDtoToInfo(response);

      // Update subnet in selected VNet
      this.updateSubnetInState(subnet);

      return subnet;
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to attach server to subnet';
      this.error.set(errorMsg);
      console.error('Failed to attach server to subnet:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Detach a server from a specific subnet
   * @param subnetId Subnet UUID
   * @param config Server detachment configuration
   */
  async detachServerFromSubnet(
    subnetId: string,
    config: DetachServerFromSubnetConfiguration
  ): Promise<SubnetInfo> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const dto: DetachServerFromSubnetDto = {
        serverId: config.serverId
      };

      const response = await firstValueFrom(
        this.subnetsApi.subnetsControllerDetachServer(subnetId, dto)
      );

      const subnet = this.mapSubnetDtoToInfo(response);

      // Update subnet in selected VNet
      this.updateSubnetInState(subnet);

      return subnet;
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to detach server from subnet';
      this.error.set(errorMsg);
      console.error('Failed to detach server from subnet:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Bulk attach all servers in an array to a specific subnet
   * Useful for attaching all cluster nodes to a subnet
   * @param subnetId Subnet UUID
   * @param serverIds Array of server provider resource IDs
   */
  async bulkAttachServersToSubnet(
    subnetId: string,
    serverIds: string[]
  ): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Attach servers sequentially to avoid race conditions
      for (const serverId of serverIds) {
        await this.attachServerToSubnet(subnetId, { serverId });
      }
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to bulk attach servers';
      this.error.set(errorMsg);
      console.error('Failed to bulk attach servers:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Helper method to update a subnet in the state (both list and selected VNet)
   */
  private updateSubnetInState(subnet: SubnetInfo): void {
    // Update in vnets list
    this.vnetsList.update(vnets => {
      return vnets.map(vnet => {
        const subnetIndex = vnet.subnets.findIndex(s => s.id === subnet.id);
        if (subnetIndex !== -1) {
          const updatedSubnets = [...vnet.subnets];
          updatedSubnets[subnetIndex] = subnet;
          return { ...vnet, subnets: updatedSubnets };
        }
        return vnet;
      });
    });

    // Update in selected VNet if it contains this subnet
    this.selectedVNetInfo.update(current => {
      if (!current) return null;
      const subnetIndex = current.subnets.findIndex(s => s.id === subnet.id);
      if (subnetIndex !== -1) {
        const updatedSubnets = [...current.subnets];
        updatedSubnets[subnetIndex] = subnet;
        return { ...current, subnets: updatedSubnets };
      }
      return current;
    });
  }

  /**
   * Set selected VNet ID
   */
  setSelectedVNetId(id: string | null): void {
    this.selectedVNetId.set(id);
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this.error.set(null);
  }

  /**
   * Clear selected VNet
   */
  clearSelection(): void {
    this.selectedVNetInfo.set(null);
    this.selectedVNetId.set(null);
  }

  /**
   * Map API DTO to domain model
   */
  private mapDtoToVNetInfo(dto: VNetResponseDto): VNetInfo {
    return {
      id: dto.id,
      providerResourceId: dto.providerResourceId,
      name: dto.name,
      provider: dto.provider,
      ipRange: dto.ipRange,
      labels: dto.labels
        .filter(l => l.key !== undefined && l.value !== undefined)
        .map(l => ({ key: l.key!, value: l.value! })),
      metadata: dto.metadata,
      status: dto.status as VNetStatus,
      subnets: dto.subnets.map(s => this.mapSubnetDtoToInfo(s)),
      routes: dto.routes.map(r => this.mapRouteDtoToInfo(r)),
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt)
    };
  }

  /**
   * Map list response to VNet info array
   */
  private mapListResponseToVNetInfo(response: VNetListResponseDto): VNetInfo[] {
    return response.vnets.map(dto => this.mapDtoToVNetInfo(dto));
  }

  /**
   * Map subnet DTO to domain model
   */
  private mapSubnetDtoToInfo(dto: SubnetResponseDto | any): SubnetInfo {
    return {
      id: dto.id,
      vnetId: dto.vnetId,
      providerSubnetId: dto.providerSubnetId,
      ipRange: dto.ipRange,
      networkZone: dto.networkZone,
      gateway: dto.gateway,
      vswitchId: dto.vswitchId,
      attachedServerIds: dto.attachedServerIds || [],
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt)
    };
  }

  /**
   * Map route DTO to domain model
   */
  private mapRouteDtoToInfo(dto: VNetRouteResponseDto): RouteInfo {
    return {
      id: dto.id,
      destination: dto.destination,
      gateway: dto.gateway
    };
  }
}
