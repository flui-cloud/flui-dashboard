import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
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

export interface ClusterWildcard {
  status: 'published' | 'absent' | 'foreign' | 'unknown' | 'unavailable';
  fqdn: string | null;
  hostnamePattern: string | null;
  expectedValue: string | null;
  actualValue: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClusterDnsZoneService {
  private readonly apiService = inject(ClusterDNSZoneService);
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  // Read per call: correct only once config.json has loaded.
  private get basePath(): string {
    return this.appConfig.apiBaseUrl;
  }

  private readonly assignmentsData = signal<ClusterDnsZoneResponseDto[]>([]);
  private readonly loadingData = signal(false);
  private readonly errorData = signal<string | null>(null);
  private readonly issuersData = signal<ClusterDnsZoneControllerGetIssuers200ResponseInner[]>([]);
  private readonly internalHostingStatusData = signal<InternalHostingStatus | null>(null);
  private readonly internalHostingLoadingData = signal(false);

  readonly assignments = this.assignmentsData.asReadonly();
  /** Primary (first-assigned) zone — cluster-wide setup paths use this one. */
  readonly assignment = computed(() => this.assignmentsData()[0] ?? null);
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly issuers = this.issuersData.asReadonly();
  readonly internalHostingStatus = this.internalHostingStatusData.asReadonly();
  readonly internalHostingLoading = this.internalHostingLoadingData.asReadonly();
  readonly hasAssignment = computed(() => this.assignmentsData().length > 0);
  readonly issuersConfigured = computed(() => this.issuersData().length > 0);
  readonly issuersReady = computed(() => this.issuersData().some(i => i.ready));
  /** True when a DNS-01-capable issuer is Ready in cert-manager — the live gate for wildcard certs. */
  readonly wildcardIssuersReady = computed(() =>
    this.issuersData().some(
      i => i.ready && (i.solverType === 'dns01' || i.solverType === 'combined')
    )
  );
  readonly reconciliationStatus = computed(
    () => this.assignment()?.reconciliationStatus ?? null
  );
  readonly needsReconciliation = computed(() =>
    this.assignmentsData().some(a =>
      a.reconciliationStatus === DnsReconciliationStatus.PENDING
      || a.reconciliationStatus === DnsReconciliationStatus.DRIFT
      || a.reconciliationStatus === DnsReconciliationStatus.ERROR
    )
  );

  async loadAssignment(clusterId: string): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.apiService.clusterDnsZoneControllerListZoneAssignments(clusterId)
      );
      this.assignmentsData.set(result ?? []);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        // No zone assigned — not an error condition
        this.assignmentsData.set([]);
      } else {
        this.errorData.set(this.extractErrorMessage(err, 'Failed to load DNS zone assignments'));
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
      this.assignmentsData.update(list => [...list, result]);
      return result;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to assign DNS zone'));
      return null;
    } finally {
      this.loadingData.set(false);
    }
  }

  /** Raw HttpClient: the reconcile endpoint is not in the generated client yet. */
  async reconcileAssignment(
    clusterId: string,
    assignmentId: string
  ): Promise<ClusterDnsZoneResponseDto | null> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const url = `${this.basePath}/api/v1/clusters/${encodeURIComponent(clusterId)}`
        + `/dns-zone/${encodeURIComponent(assignmentId)}/reconcile`;
      const result = await firstValueFrom(
        this.http.post<ClusterDnsZoneResponseDto>(url, {})
      );
      this.assignmentsData.update(list => list.map(a => (a.id === result.id ? result : a)));
      return result;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to reconcile the DNS zone'));
      return null;
    } finally {
      this.loadingData.set(false);
    }
  }

  async getClusterWildcard(
    clusterId: string,
    assignmentId: string
  ): Promise<ClusterWildcard | null> {
    try {
      return await firstValueFrom(
        this.http.get<ClusterWildcard>(this.wildcardUrl(clusterId, assignmentId))
      );
    } catch {
      return null;
    }
  }

  async publishClusterWildcard(
    clusterId: string,
    assignmentId: string
  ): Promise<ClusterWildcard | null> {
    this.errorData.set(null);
    try {
      return await firstValueFrom(
        this.http.post<ClusterWildcard>(
          this.wildcardUrl(clusterId, assignmentId),
          {}
        )
      );
    } catch (err: unknown) {
      this.errorData.set(
        this.extractErrorMessage(err, 'Failed to publish the wildcard record')
      );
      return null;
    }
  }

  private wildcardUrl(clusterId: string, assignmentId: string): string {
    return (
      `${this.basePath}/api/v1/clusters/${encodeURIComponent(clusterId)}` +
      `/dns-zone/${encodeURIComponent(assignmentId)}/wildcard`
    );
  }

  async pollAssignmentReconciliation(
    clusterId: string,
    assignmentId: string,
    timeoutMs = 180000
  ): Promise<void> {
    const start = Date.now();
    const interval = 4000;
    while (Date.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, interval));
      await this.loadAssignment(clusterId);
      const assignment = this.assignmentsData().find(a => a.id === assignmentId);
      if (!assignment) return;
      if (assignment.reconciliationStatus !== DnsReconciliationStatus.RECONCILING) return;
    }
  }

  /** Removes one assignment when `assignmentId` is given, otherwise every zone on the cluster. */
  async removeAssignment(clusterId: string, assignmentId?: string): Promise<boolean> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      if (assignmentId) {
        await firstValueFrom(
          this.apiService.clusterDnsZoneControllerRemoveAssignment(assignmentId, clusterId)
        );
        this.assignmentsData.update(list => list.filter(a => a.id !== assignmentId));
      } else {
        await firstValueFrom(
          this.apiService.clusterDnsZoneControllerRemoveZone(clusterId)
        );
        this.assignmentsData.set([]);
      }
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
    this.assignmentsData.set([]);
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
