import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicationMetricsService } from '../../core/api/api/applicationMetrics.service';
import type { AppMetricsDto } from '../model/application.models';

@Injectable({ providedIn: 'root' })
export class ApplicationMonitoringService {
  private readonly metricsApi = inject(ApplicationMetricsService);

  // Polling state
  private pollingInterval?: number;
  private subscriberCount = 0;
  private currentAppId: string | null = null;

  private readonly isLoadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  // Retry mechanism
  private readonly MAX_CONSECUTIVE_ERRORS = 5;
  private readonly consecutiveErrorCount = signal(0);
  private readonly isPollingPaused = signal(false);
  private readonly manualRefreshCountSignal = signal(0);
  private readonly MAX_MANUAL_RETRIES = 5;

  // Metrics state
  private readonly currentMetrics = signal<AppMetricsDto | null>(null);
  private readonly previousCpu = signal<number | null>(null);
  private readonly previousMemory = signal<number | null>(null);

  // Public readonly signals
  readonly metrics = this.currentMetrics.asReadonly();
  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly pollingPaused = this.isPollingPaused.asReadonly();
  readonly canRetry = computed(() => this.manualRefreshCountSignal() < this.MAX_MANUAL_RETRIES);

  // Computed convenience signals
  readonly cpuUtilization = computed(() => this.currentMetrics()?.cpu?.utilization_percent ?? null);
  readonly memoryUtilization = computed(() => this.currentMetrics()?.memory?.utilization_percent ?? null);
  readonly networkIn = computed(() => this.currentMetrics()?.network?.receive_bytes_rate ?? null);
  readonly networkOut = computed(() => this.currentMetrics()?.network?.transmit_bytes_rate ?? null);
  readonly statusMetrics = computed(() => this.currentMetrics()?.status ?? null);
  readonly podPhases = computed(() => this.currentMetrics()?.pods ?? []);
  readonly isUp = computed(() => (this.currentMetrics()?.status?.replicas_ready ?? 0) > 0);
  readonly prevCpu = this.previousCpu.asReadonly();
  readonly prevMemory = this.previousMemory.asReadonly();

  /** Start polling for a specific application. */
  startPolling(appId: string): void {
    if (this.currentAppId !== appId) {
      this.reset();
      this.currentAppId = appId;
    }
    this.subscriberCount++;
    if (this.subscriberCount === 1) {
      this.loadMetrics();
      this.pollingInterval = globalThis.window.setInterval(() => {
        if (!this.isPollingPaused()) {
          this.loadMetrics(false);
        }
      }, 5000);
    }
  }

  /** Stop polling when the subscriber leaves. */
  stopPolling(): void {
    this.subscriberCount = Math.max(0, this.subscriberCount - 1);
    if (this.subscriberCount === 0 && this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  /** Manual refresh with retry tracking. */
  async refreshMetrics(): Promise<void> {
    if (!this.canRetry()) {
      this.errorSignal.set('Maximum retry attempts reached. Please refresh the page.');
      return;
    }
    if (this.isPollingPaused()) {
      this.consecutiveErrorCount.set(0);
      this.manualRefreshCountSignal.update(count => count + 1);
    }
    await this.loadMetrics(true);
  }

  /** One-shot fetch (no polling). Used by overview health summary. */
  async loadMetricsOnce(appId: string): Promise<void> {
    if (!appId) return;
    try {
      const response = await firstValueFrom(
        this.metricsApi.applicationMetricsControllerGetAppMetrics(appId)
      );
      this.updateMetrics(response.metrics);
      this.currentAppId = appId;
    } catch {
      // Silently fail for overview summary — monitoring tab handles errors
    }
  }

  private async loadMetrics(_isManualRefresh: boolean = false): Promise<void> {
    if (!this.currentAppId) {
      this.errorSignal.set('No application selected');
      return;
    }

    try {
      this.isLoadingSignal.set(true);
      this.errorSignal.set(null);

      const response = await firstValueFrom(
        this.metricsApi.applicationMetricsControllerGetAppMetrics(this.currentAppId)
      );

      this.updateMetrics(response.metrics);

      // Reset error counters on success
      this.consecutiveErrorCount.set(0);
      if (this.isPollingPaused()) {
        this.resumePolling();
      }
    } catch (error: any) {
      console.error('Failed to load app metrics:', error);

      const isHttpError = error?.status >= 400 && error?.status < 600;
      if (isHttpError) {
        const newCount = this.consecutiveErrorCount() + 1;
        this.consecutiveErrorCount.set(newCount);

        if (newCount >= this.MAX_CONSECUTIVE_ERRORS) {
          this.isPollingPaused.set(true);
          this.errorSignal.set(
            'API failed multiple times. Auto-refresh paused. Click "Retry" to resume.'
          );
        } else {
          this.errorSignal.set('Failed to load metrics. Will retry automatically...');
        }
      } else {
        this.errorSignal.set('Network error. Will retry automatically...');
      }
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  private updateMetrics(metrics: AppMetricsDto): void {
    const prev = this.currentMetrics();
    if (prev) {
      this.previousCpu.set(prev.cpu?.utilization_percent ?? null);
      this.previousMemory.set(prev.memory?.utilization_percent ?? null);
    }
    this.currentMetrics.set(metrics);
  }

  private resumePolling(): void {
    this.isPollingPaused.set(false);
    this.consecutiveErrorCount.set(0);
    this.manualRefreshCountSignal.set(0);
  }

  private reset(): void {
    this.currentMetrics.set(null);
    this.previousCpu.set(null);
    this.previousMemory.set(null);
    this.errorSignal.set(null);
    this.consecutiveErrorCount.set(0);
    this.isPollingPaused.set(false);
    this.manualRefreshCountSignal.set(0);
  }
}
