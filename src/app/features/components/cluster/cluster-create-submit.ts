import { inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AccessManagementService } from '../../../core/api/api/accessManagement.service';
import { ClusterConfiguration, NodeSizeOption, ProviderType } from '../../model/cluster.models';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import { ClusterService } from '../../service/cluster.service';
import { createClusterErrorMessage, tagsWithClusterId } from './cluster-create-helpers';
import { ClusterCreateFirewall } from './cluster-create-firewall';
import { ClusterCreateState } from './cluster-create.state';

export interface ClusterCreateOutcome {
  success: boolean;
  cluster?: any;
  error?: string;
}

export class ClusterCreateSubmit {
  private readonly clusterService = inject(ClusterService);
  private readonly accessManagementService = inject(AccessManagementService);
  private readonly clusterDnsZoneService = inject(ClusterDnsZoneService);
  private readonly router = inject(Router);

  readonly isCreating = signal<boolean>(false);
  readonly createError = signal<string | null>(null);

  constructor(
    private readonly state: ClusterCreateState,
    private readonly firewall: ClusterCreateFirewall,
  ) {}

  async createCluster(emit: (outcome: ClusterCreateOutcome) => void): Promise<void> {
    if (!this.state.canComplete()) return;

    const serverType = this.state.getSelectedServerType();
    if (!serverType) return;

    this.isCreating.set(true);
    this.createError.set(null);

    try {
      const configuration = this.buildClusterConfiguration(serverType);
      const result = await this.clusterService.createCluster(configuration);

      const sshKeyId = this.state.selectedSshKeyId();
      if (sshKeyId) {
        await this.updateSshKeyTagsWithClusterId(result.clusterId, sshKeyId);
      }

      await this.attachSelectedDnsZone(result.clusterId);
      this.navigateAfterCreate(result);

      emit({
        success: true,
        cluster: {
          ...configuration,
          id: result.clusterId,
          clusterId: result.clusterId,
          operationId: result.operationId,
        },
      });
    } catch (error: any) {
      console.error('Failed to create cluster:', error);
      const message = createClusterErrorMessage(error);
      this.createError.set(message);
      emit({ success: false, error: message });
    } finally {
      this.isCreating.set(false);
    }
  }

  private buildClusterConfiguration(serverType: NodeSizeOption): ClusterConfiguration {
    const state = this.state;
    const availability = state.availability();
    const sshKeyId = state.selectedSshKeyId();
    const vnetId = state.selectedVNetId();
    const subnetId = state.selectedSubnetId();
    return {
      name: state.basicConfigForm.get('name')?.value || '',
      provider: state.selectedProvider() as ProviderType,
      region: state.selectedRegion(),
      nodeTypeId: serverType.id,
      minNodes: state.costedNodes(),
      maxNodes: state.costedNodes(),
      highAvailability: state.highlyAvailable()
        ? { shapes: availability.shapes, completeLater: availability.completeLater }
        : undefined,
      sshKeys: sshKeyId ? [sshKeyId] : [],
      diskSizeGb: state.needsDiskConfig() ? state.diskSizeGb() : undefined,
      firewallRules: this.firewall.buildFirewallRules(),
      vnetConfig:
        !state.environmentNetwork() && !state.fluiBuildsNetwork() && vnetId && subnetId
          ? { vnetId, subnetId, autoAssignIp: true }
          : undefined,
      fluiManagedNetwork: this.buildFluiManagedNetwork(),
      endpointHostnameMode: state.endpointHostnameMode(),
      sharedStorageEnabled: state.sharedStorageEnabled(),
      sharedStorageVolumeSizeGb: state.sharedStorageEnabled()
        ? state.sharedStorageVolumeSizeGb()
        : undefined,
    };
  }

  private buildFluiManagedNetwork(): ClusterConfiguration['fluiManagedNetwork'] {
    if (!this.state.fluiBuildsNetwork()) {
      return undefined;
    }
    const ipRange = this.state.fluiNetworkCidr().trim();
    return ipRange ? { ipRange } : {};
  }

  private navigateAfterCreate(result: { operationId?: string; clusterId?: string }): void {
    if (result.operationId) {
      this.router.navigate(['/cluster/create', result.operationId]);
    } else if (result.clusterId) {
      this.router.navigate(['/cluster', result.clusterId]);
    } else {
      this.router.navigate(['/cluster']);
    }
  }

  private async attachSelectedDnsZone(clusterId: string): Promise<void> {
    if (this.state.endpointHostnameMode() !== 'domain') return;
    const zoneId = this.state.selectedDnsZoneId();
    if (!zoneId || !clusterId) return;

    const assigned = await this.clusterDnsZoneService.assignZone(clusterId, { dnsZoneId: zoneId });
    if (!assigned) {
      console.error(
        'Cluster created but DNS zone assignment failed:',
        this.clusterDnsZoneService.error(),
      );
    }
  }

  private async updateSshKeyTagsWithClusterId(clusterId: string, keyId: string): Promise<void> {
    try {
      const existingKey = this.state.getSshKeyById(keyId);
      if (!existingKey) return;

      const updatedTags = tagsWithClusterId(
        existingKey.tags as Record<string, unknown> | undefined,
        clusterId,
      );

      await firstValueFrom(
        this.accessManagementService.accessControllerUpdateSSHKey(keyId, {
          tags: updatedTags,
        }),
      );
    } catch {
      return;
    }
  }
}
