import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ClusterService } from '../../service/cluster.service';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';
import { AuthzInstallService } from '../../service/authz-install.service';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { ResourceAvailabilityResponseDto } from '../../../core/api/model/resourceAvailabilityResponseDto';
import { AuthzInstallResponseDto } from '../../../core/api/model/authzInstallResponseDto';
import { ClusterInfo } from '../../model/cluster.models';
import { DeployWizardForm } from './deploy-wizard.state';

function missingCapabilityLabel(key: string): string {
  switch (key) {
    case 'dns_zone':
      return 'DNS zone';
    case 'wildcard_issuer':
      return 'wildcard TLS issuer';
    case 'internal_wildcard_dns':
      return 'internal wildcard DNS';
    default:
      return key;
  }
}

@Injectable()
export class DeployWizardCluster {
  private readonly form = inject(DeployWizardForm);
  private readonly state = inject(DeployWizardStateService);
  private readonly clusterService = inject(ClusterService);
  private readonly clustersApi = inject(InfrastructureClustersService);
  readonly authzInstall = inject(AuthzInstallService);

  readonly authzNotReady = computed(() => {
    if (!this.form.isInternalDeploy()) return false;
    const status = this.authzInstall.install()?.status;
    return status !== AuthzInstallResponseDto.StatusEnum.Running;
  });

  readonly canDeployReason = computed<string | null>(() => {
    const detail = this.state.catalogDetail();
    if (this.form.flowSubtype() === 'marketplace' && detail?.installable === false) {
      const details = (detail.notInstallableDetails ?? []).map(missingCapabilityLabel);
      const missing = details.length ? ` Missing: ${details.join(', ')}.` : '';
      return `This cluster does not support internal apps yet.${missing} Configure DNS on the cluster first.`;
    }
    return null;
  });

  readonly internalHostingMissingLabel = computed(() => {
    const missing = this.state.internalHostingMissing();
    if (missing.length === 0) return 'DNS configuration';
    return missing.map(missingCapabilityLabel).join(', ');
  });

  readonly showExposure = computed(() => {
    const flow = this.form.flowSubtype();
    const detail = this.state.catalogDetail();
    return (
      !!this.form.selectedCluster() &&
      flow !== null &&
      (flow !== 'marketplace' ||
        (detail?.exposure === 'public' &&
          detail?.appType !== 'building-block' &&
          detail?.privatizable !== false))
    );
  });

  readonly roomWaitAhead = computed(() => {
    const av = this.state.catalogAvailability();
    return !!av && !!av.reason && av.placement?.verdict !== 'fits';
  });

  async loadClusters(): Promise<void> {
    this.form.isLoadingClusters.set(true);

    try {
      await this.clusterService.loadClusters();
    } catch (error) {
      console.error('Failed to load clusters:', error);
    } finally {
      this.form.isLoadingClusters.set(false);
    }
  }

  selectCluster(cluster: ClusterInfo): void {
    this.form.selectedCluster.set(cluster);
    if (!cluster.id) return;
    this.state.clusterId.set(cluster.id);
    void this.state.fetchClusterCapabilities(cluster.id);
    if (this.form.flowSubtype() === 'marketplace') {
      this.state.checkCatalogResourceAvailability(cluster.id);
      return;
    }
    this.form.resourceAvailability.set(null);
    this.checkResourceAvailabilityForCluster(cluster.id);
  }

  async checkResourceAvailabilityForCluster(clusterId: string): Promise<void> {
    const f = this.form;
    const profile =
      f.flowSubtype() === 'image' ? f.selectedProfile() : this.state.deployConfig().resourceProfile;
    const replicas = f.deployReplicas();

    f.checkingAvailability.set(true);
    try {
      const res = await firstValueFrom(
        this.clustersApi.clustersControllerCheckResourceAvailability(
          clusterId,
          profile,
          undefined,
          undefined,
          replicas,
        ),
      );
      f.resourceAvailability.set(res);
    } catch {
      f.resourceAvailability.set(null);
    } finally {
      f.checkingAvailability.set(false);
    }
  }

  getAvailabilityMessage(): string {
    const av = this.form.resourceAvailability();
    if (!av?.reason) return '';
    const replicas = this.form.deployReplicas();
    switch (av.reason) {
      case ResourceAvailabilityResponseDto.ReasonEnum.InsufficientResources:
        return `The cluster does not have enough resources for the selected profile with ${replicas} replica(s). Reduce replicas or choose a smaller profile.`;
      case ResourceAvailabilityResponseDto.ReasonEnum.AutoscalingPending:
        return 'Current resources are tight. Autoscaling will add a node automatically if needed.';
      default:
        return '';
    }
  }

  async installAuthProxy(): Promise<void> {
    const id = this.state.clusterId();
    if (!id) return;
    await this.authzInstall.installAuthz(id);
  }
}
