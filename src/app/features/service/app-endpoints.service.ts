import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppEndpointsService as ApiService } from '../../core/api/api/appEndpoints.service';
import { AppEndpointResponseDto } from '../../core/api/model/appEndpointResponseDto';
import { CreateAppEndpointDto } from '../../core/api/model/createAppEndpointDto';
import { UpdateAppEndpointDto } from '../../core/api/model/updateAppEndpointDto';
import { CertificateStatus, DnsReconciliationStatus } from '../model/dns.models';
import { internalHostingErrorMessage } from '../model/app-exposure';

@Injectable({ providedIn: 'root' })
export class AppEndpointsService {
  private readonly apiService = inject(ApiService);

  private readonly endpointsData = signal<AppEndpointResponseDto[]>([]);
  private readonly loadingData = signal(false);
  private readonly errorData = signal<string | null>(null);

  readonly endpoints = this.endpointsData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly hasEndpoints = computed(() => this.endpointsData().length > 0);
  readonly syncedCount = computed(
    () => this.endpointsData().filter(
      e => e.reconciliationStatus === DnsReconciliationStatus.IN_SYNC
    ).length
  );

  async loadEndpoints(clusterId: string): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.apiService.appEndpointControllerListEndpoints(clusterId)
      );
      this.endpointsData.set(result ?? []);
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to load endpoints'));
    } finally {
      this.loadingData.set(false);
    }
  }

  async createEndpoint(
    clusterId: string,
    dto: CreateAppEndpointDto
  ): Promise<AppEndpointResponseDto | null> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const endpoint = await firstValueFrom(
        this.apiService.appEndpointControllerCreateEndpoint(clusterId, dto)
      );
      this.endpointsData.update(list => [...list, endpoint]);
      return endpoint;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to create endpoint'));
      return null;
    } finally {
      this.loadingData.set(false);
    }
  }

  async updateEndpoint(
    id: string,
    dto: UpdateAppEndpointDto
  ): Promise<AppEndpointResponseDto | null> {
    this.errorData.set(null);
    try {
      const updated = await firstValueFrom(
        this.apiService.appEndpointControllerUpdateEndpoint(id, dto)
      );
      this.updateEndpointInList(updated);
      return updated;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to update endpoint'));
      return null;
    }
  }

  async reconcileEndpoint(id: string): Promise<AppEndpointResponseDto | null> {
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.apiService.appEndpointControllerReconcile(id)
      );
      this.updateEndpointInList(result);
      return result;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to trigger reconciliation'));
      return null;
    }
  }

  async getEndpointStatus(id: string): Promise<AppEndpointResponseDto | null> {
    try {
      const result = await firstValueFrom(
        this.apiService.appEndpointControllerGetStatus(id)
      );
      this.updateEndpointInList(result);
      return result;
    } catch {
      return null;
    }
  }

  async deleteEndpoint(id: string): Promise<boolean> {
    this.errorData.set(null);
    try {
      await firstValueFrom(this.apiService.appEndpointControllerDeleteEndpoint(id));
      this.endpointsData.update(list => list.filter(e => e.id !== id));
      return true;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to delete endpoint'));
      return false;
    }
  }

  async pollEndpointReconciliation(id: string, timeoutMs = 60000): Promise<boolean> {
    const start = Date.now();
    const interval = 5000;

    while (Date.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, interval));
      const status = await this.getEndpointStatus(id);
      if (!status) break;
      if (
        status.reconciliationStatus === DnsReconciliationStatus.IN_SYNC ||
        status.reconciliationStatus === DnsReconciliationStatus.ERROR
      ) {
        return status.reconciliationStatus === DnsReconciliationStatus.IN_SYNC;
      }
    }
    return false;
  }

  /**
   * Polls the endpoint status until the certificate reaches a terminal state
   * (valid, failed, or expired). Timeout defaults to 5 minutes since cert
   * issuance via Let's Encrypt can take some time.
   * Returns the final certificateStatus string, or null on timeout/error.
   */
  async pollCertificateStatus(id: string, timeoutMs = 300000): Promise<string | null> {
    const terminalStates: Set<string> = new Set([
      CertificateStatus.VALID,
      CertificateStatus.FAILED,
      CertificateStatus.EXPIRED,
    ]);
    const start = Date.now();
    const interval = 8000;

    while (Date.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, interval));
      const ep = await this.getEndpointStatus(id);
      if (!ep) break;
      const certStatus = ep.certificateStatus ?? null;
      if (certStatus && terminalStates.has(certStatus)) {
        return certStatus;
      }
    }
    return null;
  }

  clearError(): void {
    this.errorData.set(null);
  }

  private updateEndpointInList(updated: AppEndpointResponseDto): void {
    this.endpointsData.update(list =>
      list.map(e => (e.id === updated.id ? updated : e))
    );
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    // Structured INTERNAL_HOSTING_NOT_AVAILABLE → render with missingRequirements detail.
    const internalMsg = internalHostingErrorMessage(err);
    if (internalMsg) return internalMsg;
    const e = err as {
      error?: { code?: string; message?: string };
      message?: string;
    };
    if (e?.error?.code === 'AUTH_PROXY_NOT_RUNNING') {
      return (
        e.error.message ??
        'Internal endpoints require the Flui Auth Proxy to be installed and running on the cluster.'
      );
    }
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
