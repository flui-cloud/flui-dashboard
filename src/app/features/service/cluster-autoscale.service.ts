import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  AutoscaleDefaults,
  AutoscaleError,
  AutoscaleStatus,
  UpdateClusterAutoscalePayload,
} from '../model/autoscale.models';

@Injectable({ providedIn: 'root' })
export class ClusterAutoscaleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly statusData = signal<AutoscaleStatus | null>(null);
  private readonly defaultsData = signal<AutoscaleDefaults | null>(null);
  private readonly loadingData = signal<boolean>(false);
  private readonly savingData = signal<boolean>(false);
  private readonly errorData = signal<AutoscaleError | null>(null);
  private readonly polledClusterId = signal<string | null>(null);

  readonly status = this.statusData.asReadonly();
  readonly defaults = this.defaultsData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly saving = this.savingData.asReadonly();
  readonly lastError = this.errorData.asReadonly();

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  private get base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/clusters`;
  }

  async loadDefaults(force = false): Promise<AutoscaleDefaults> {
    const cached = this.defaultsData();
    if (cached && !force) return cached;
    const result = await firstValueFrom(
      this.http.get<AutoscaleDefaults>(`${this.base}/autoscale/defaults`)
    );
    this.defaultsData.set(result);
    return result;
  }

  async getStatus(clusterId: string): Promise<AutoscaleStatus> {
    this.loadingData.set(true);
    try {
      const result = await firstValueFrom(
        this.http.get<AutoscaleStatus>(`${this.base}/${clusterId}/autoscale/status`)
      );
      this.statusData.set(result);
      return result;
    } finally {
      this.loadingData.set(false);
    }
  }

  /**
   * Fetch status for a cluster without touching shared state.
   * Use this for multi-cluster polling (e.g. dashboard pulse).
   */
  async fetchStatusFor(clusterId: string): Promise<AutoscaleStatus> {
    return firstValueFrom(
      this.http.get<AutoscaleStatus>(`${this.base}/${clusterId}/autoscale/status`)
    );
  }

  startStatusPolling(clusterId: string, intervalMs = 30_000): void {
    if (this.polledClusterId() === clusterId && this.pollHandle) {
      return;
    }
    this.stopStatusPolling();
    this.polledClusterId.set(clusterId);
    void this.getStatus(clusterId).catch(err => console.warn('autoscale status fetch failed', err));
    this.pollHandle = setInterval(() => {
      void this.getStatus(clusterId).catch(err =>
        console.warn('autoscale status poll failed', err)
      );
    }, intervalMs);
  }

  stopStatusPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    this.polledClusterId.set(null);
  }

  async updateAutoscale(
    clusterId: string,
    payload: UpdateClusterAutoscalePayload
  ): Promise<AutoscaleStatus> {
    this.savingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.http.patch<AutoscaleStatus>(`${this.base}/${clusterId}/autoscale`, payload)
      );
      this.statusData.set(result);
      return result;
    } catch (err) {
      const parsed = this.parseError(err);
      this.errorData.set(parsed);
      throw parsed;
    } finally {
      this.savingData.set(false);
    }
  }

  clearError(): void {
    this.errorData.set(null);
  }

  resetState(): void {
    this.stopStatusPolling();
    this.statusData.set(null);
    this.errorData.set(null);
  }

  private parseError(err: unknown): AutoscaleError {
    if (err instanceof HttpErrorResponse) {
      const message =
        (err.error && typeof err.error === 'object' && 'message' in err.error
          ? String((err.error as { message: unknown }).message)
          : err.message) || 'Failed to update autoscale configuration';

      if (err.status === 400 && /vnet/i.test(message) && /autoscal/i.test(message)) {
        return { kind: 'vnet-required', message };
      }
      if (err.status === 400) {
        return { kind: 'validation', message };
      }
      return { kind: 'generic', message };
    }
    return { kind: 'generic', message: 'Unexpected error updating autoscale configuration' };
  }
}
