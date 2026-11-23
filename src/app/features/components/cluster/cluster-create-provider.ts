import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AsyncValidatorFn } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { ClusterNameAvailabilityService } from '../../service/cluster-name-availability.service';
import { ClusterService } from '../../service/cluster.service';
import { ProviderWizardService } from '../../../shared/services/provider-wizard.service';
import { STANDARD_AVAILABILITY, STANDARD_DRAFT } from './cluster-availability-choice.component';
import { clusterNameValidator, suggestClusterName } from './cluster-create-helpers';
import { ClusterCreateState } from './cluster-create.state';

interface WorkloadProviderVerdict {
  allowed: boolean;
  reason: string | null;
  overlayEnabled?: boolean;
  environmentNetwork?: { name: string; ipRange: string } | null;
}

export class ClusterCreateProvider {
  private readonly clusterService = inject(ClusterService);
  private readonly autoscaleService = inject(ClusterAutoscaleService);
  private readonly nameAvailabilityService = inject(ClusterNameAvailabilityService);
  private readonly wizardService = inject(ProviderWizardService);
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  constructor(private readonly state: ClusterCreateState) {}

  private readonly checkName = (name: string, provider: string) =>
    this.nameAvailabilityService.check(name, provider);

  nameValidator(): AsyncValidatorFn {
    return clusterNameValidator(
      () => this.clusterService.clusters(),
      () => this.state.selectedProvider(),
      this.checkName,
    );
  }

  async loadAutoscaleDefaults(): Promise<void> {
    try {
      const defs = await this.autoscaleService.loadDefaults();
      this.state.autoscaleDefaults.set(defs);
      if (defs.defaultMinNodes) this.state.minNodes.set(defs.defaultMinNodes);
      if (defs.defaultMaxNodes) this.state.maxNodes.set(defs.defaultMaxNodes);
    } catch {
      this.state.autoscaleDefaults.set(null);
    }
  }

  async loadCatalog(): Promise<void> {
    await Promise.all([
      this.clusterService.loadClusters(),
      this.wizardService.loadProviders(),
      this.state.dnsZonesService.loadZones(),
    ]);

    const zones = this.state.dnsZones();
    if (zones.length === 1) {
      this.state.selectedDnsZoneId.set(zones[0].id);
    }
  }

  async generateUniqueClusterName(): Promise<void> {
    this.state.generatingName.set(true);
    try {
      const suggestedName = await suggestClusterName(
        this.clusterService.clusters(),
        this.state.selectedProvider(),
        this.checkName,
      );
      this.state.basicConfigForm.patchValue({ name: suggestedName });
    } finally {
      this.state.generatingName.set(false);
    }
  }

  onProviderSelected(providerId: string): void {
    const state = this.state;
    state.selectedProvider.set(providerId);
    state.selectedRegion.set('');
    state.selectedServerTypeId.set('');
    state.availabilityDraft.set(STANDARD_DRAFT);
    state.availability.set(STANDARD_AVAILABILITY);
    state.providerRefusal.set(null);
    state.environmentNetwork.set(null);
    if (providerId) {
      void this.wizardService.loadServerTypesAllRegions(providerId).catch(() => undefined);
      void this.checkWorkloadProvider(providerId);
    }
  }

  private async checkWorkloadProvider(providerId: string): Promise<void> {
    try {
      const verdict = await firstValueFrom(
        this.http.get<WorkloadProviderVerdict>(
          `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/clusters/workload-providers/${providerId}`,
        ),
      );
      if (this.state.selectedProvider() !== providerId) return;
      this.state.providerRefusal.set(verdict.allowed ? null : verdict.reason);
      this.state.environmentNetwork.set(verdict.environmentNetwork ?? null);
      this.state.overlayEnabled.set(!!verdict.overlayEnabled);
    } catch {
      if (this.state.selectedProvider() === providerId) {
        this.state.providerRefusal.set(null);
        this.state.environmentNetwork.set(null);
      }
    }
  }

  onRegionSelected(regionId: string): void {
    this.state.selectedRegion.set(regionId);
    this.state.selectedServerTypeId.set('');
  }

  onServerTypeSelected(serverTypeId: string): void {
    this.state.selectedServerTypeId.set(serverTypeId);
  }

  onSshKeySelected(keyId: string | undefined): void {
    this.state.selectedSshKeyId.set(keyId);
  }
}
