import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ClusterDNSZoneService } from '../../core/api/api/clusterDNSZone.service';
import { ClusterDnsZoneResponseDto } from '../../core/api/model/clusterDnsZoneResponseDto';
import { ClusterDnsZoneControllerGetIssuers200ResponseInner } from '../../core/api/model/clusterDnsZoneControllerGetIssuers200ResponseInner';
import { AssignDnsZoneDto } from '../../core/api/model/assignDnsZoneDto';
import { ConfigureIssuerDto } from '../../core/api/model/configureIssuerDto';
import { ConfigureSystemIngressDto } from '../../core/api/model/configureSystemIngressDto';
import { DnsReconciliationStatus } from '../model/dns.models';

export type InternalHostingRequirement = 'dns_zone' | 'wildcard_issuer' | 'internal_wildcard_dns';

export interface InternalHostingStatus {
  clusterId: string;
  enabled: boolean;
  missingRequirements: InternalHostingRequirement[];
  zoneName?: string;
  internalHostTemplate?: string;
}

export type IssuerApiType = 'http' | 'dns';

@Injectable({ providedIn: 'root' })
export class ClusterDnsZoneService {
  private readonly apiService = inject(ClusterDNSZoneService);

  private readonly assignmentData = signal<ClusterDnsZoneResponseDto | null>(null);
  private readonly loadingData = signal(false);
  private readonly errorData = signal<string | null>(null);
  private readonly issuersData = signal<ClusterDnsZoneControllerGetIssuers200ResponseInner[]>([]);
  private readonly internalHostingStatusData = signal<InternalHostingStatus | null>(null);
  private readonly internalHostingLoadingData = signal(false);

  readonly assignment = this.assignmentData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly issuers = this.issuersData.asReadonly();
  readonly internalHostingStatus = this.internalHostingStatusData.asReadonly();
  readonly internalHostingLoading = this.internalHostingLoadingData.asReadonly();
  readonly hasAssignment = computed(() => !!this.assignmentData());
  readonly issuersConfigured = computed(() => this.issuersData().length > 0);
  readonly issuersReady = computed(() => this.issuersData().some(i => i.ready));
  readonly reconciliationStatus = computed(
    () => this.assignmentData()?.reconciliationStatus ?? null
  );
  readonly needsReconciliation = computed(() => {
    const status = this.assignmentData()?.reconciliationStatus;
    return status === DnsReconciliationStatus.PENDING
      || status === DnsReconciliationStatus.DRIFT
      || status === DnsReconciliationStatus.ERROR;
  });

  async loadAssignment(clusterId: string): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.apiService.clusterDnsZoneControllerGetZoneAssignment(clusterId)
      );
      this.assignmentData.set(result ?? null);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        // No zone assigned — not an error condition
        this.assignmentData.set(null);
      } else {
        this.errorData.set(this.extractErrorMessage(err, 'Failed to load DNS zone assignment'));
      }
    } finally {
      this.loadingData.set(false);
    }
  }

  async assignZone(
    clusterId: string,
    dto: AssignDnsZoneDto
  ): Promise<ClusterDnsZoneResponseDto | null> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.apiService.clusterDnsZoneControllerAssignZone(clusterId, dto)
      );
      this.assignmentData.set(result);
      return result;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to assign DNS zone'));
      return null;
    } finally {
      this.loadingData.set(false);
    }
  }

  async updateCertConfig(clusterId: string): Promise<ClusterDnsZoneResponseDto | null> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.apiService.clusterDnsZoneControllerUpdateCertConfig(clusterId)
      );
      this.assignmentData.set(result);
      return result;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to update certificate config'));
      return null;
    } finally {
      this.loadingData.set(false);
    }
  }

  async removeAssignment(clusterId: string): Promise<boolean> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      await firstValueFrom(
        this.apiService.clusterDnsZoneControllerRemoveZone(clusterId)
      );
      this.assignmentData.set(null);
      return true;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to remove DNS zone assignment'));
      return false;
    } finally {
      this.loadingData.set(false);
    }
  }

  async getIssuers(clusterId: string): Promise<ClusterDnsZoneControllerGetIssuers200ResponseInner[]> {
    try {
      const result = await firstValueFrom(
        this.apiService.clusterDnsZoneControllerGetIssuers(clusterId)
      );
      this.issuersData.set(result);
      return result;
    } catch {
      return [];
    }
  }

  async loadIssuers(clusterId: string): Promise<void> {
    await this.getIssuers(clusterId);
  }

  /** Fetch the render-friendly internal hosting status for a cluster. */
  async loadInternalHostingStatus(clusterId: string): Promise<void> {
    this.internalHostingLoadingData.set(true);
    try {
      const result = (await firstValueFrom(
        this.apiService.clusterDnsZoneControllerGetInternalHostingStatus(clusterId),
      )) as InternalHostingStatus;
      this.internalHostingStatusData.set(result ?? null);
    } catch (err: unknown) {
      this.errorData.set(
        this.extractErrorMessage(err, 'Failed to load internal hosting status.'),
      );
      this.internalHostingStatusData.set(null);
    } finally {
      this.internalHostingLoadingData.set(false);
    }
  }

  resetInternalHostingStatus(): void {
    this.internalHostingStatusData.set(null);
  }

  async configureIssuer(clusterId: string, dto: ConfigureIssuerDto): Promise<boolean> {
    try {
      await firstValueFrom(
        this.apiService.clusterDnsZoneControllerConfigureIssuer(clusterId, dto)
      );
      return true;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to configure certificate issuer'));
      return false;
    }
  }

  async configureIssuerByType(clusterId: string, type: IssuerApiType, dto: ConfigureIssuerDto): Promise<boolean> {
    try {
      await firstValueFrom(
        this.apiService.clusterDnsZoneControllerConfigureIssuerByType(clusterId, type, dto)
      );
      return true;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, `Failed to configure ${type.toUpperCase()} certificate issuers`));
      return false;
    }
  }

  /** Step 1 of wildcard setup: apply the DNS token Secret in cert-manager namespace */
  async configureDnsSecret(clusterId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.apiService.clusterDnsZoneControllerConfigureDnsSecret(clusterId)
      );
      return true;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to configure DNS secret'));
      return false;
    }
  }

  /** Step 2 of wildcard setup: apply wildcard ClusterIssuers (requires dns-secret to exist) */
  async configureDnsIssuers(clusterId: string, dto: ConfigureIssuerDto): Promise<boolean> {
    try {
      await firstValueFrom(
        this.apiService.clusterDnsZoneControllerConfigureDnsIssuers(clusterId, dto)
      );
      return true;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to configure DNS-01 wildcard issuers'));
      return false;
    }
  }

  async deleteIssuersByType(clusterId: string, type: IssuerApiType): Promise<boolean> {
    try {
      await firstValueFrom(
        this.apiService.clusterDnsZoneControllerDeleteIssuersByType(clusterId, type)
      );
      return true;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, `Failed to delete ${type.toUpperCase()} certificate issuers`));
      return false;
    }
  }

  async configureSystemIngress(clusterId: string, dto: ConfigureSystemIngressDto): Promise<boolean> {
    try {
      await firstValueFrom(
        this.apiService.clusterDnsZoneControllerConfigureSystemIngress(clusterId, dto)
      );
      return true;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to configure system ingress'));
      return false;
    }
  }

  clearError(): void {
    this.errorData.set(null);
  }

  clearAssignment(): void {
    this.assignmentData.set(null);
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
