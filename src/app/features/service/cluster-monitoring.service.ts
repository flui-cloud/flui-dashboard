import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ClusterService } from './cluster.service';
import { ClusterMetricsLogsService } from '../../core/api/api/clusterMetricsLogs.service';
import { ClusterHealthService } from '../../core/api/api/clusterHealth.service';
import {
  ClusterHealthResponseDto,
  ClusterMetricsResponseDto,
} from '../../core/api/model/models';
import { StatItem } from '../../shared/components/charts';

export interface ServerMetricsState {
  serverId: string;
  instance: string;
  cpu: { current: number; previous: number; cores: number };
  memory: { current: number; previous: number; used: number; total: number };
  disk: { current: number; previous: number; used: number; total: number };
  network: { bytesIn: number; bytesOut: number };
}

@Injectable({ providedIn: 'root' })
export class ClusterMonitoringService {
  private readonly clusterService = inject(ClusterService);
  private readonly metricsApi = inject(ClusterMetricsLogsService);
  private readonly healthApi = inject(ClusterHealthService);

  // Polling state
  private pollingInterval?: number;
  private subscriberCount = 0;

  private readonly isLoadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  // Retry mechanism
  private readonly MAX_CONSECUTIVE_ERRORS = 5;
  private readonly consecutiveErrorCount = signal(0);
  private readonly isPollingPaused = signal(false);
  private readonly manualRefreshCountSignal = signal(0);
  private readonly MAX_MANUAL_RETRIES = 5;

  // Health state
  private readonly healthState = signal<ClusterHealthResponseDto | null>(null);
  readonly health = this.healthState.asReadonly();

  // Server metrics state
  private readonly serverMetrics = signal<ServerMetricsState[]>([]);
  readonly servers = this.serverMetrics.asReadonly();

  // Public readonly signals
  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly pollingPaused = this.isPollingPaused.asReadonly();
  readonly manualRefreshCount = this.manualRefreshCountSignal.asReadonly();
  readonly canRetry = computed(() => this.manualRefreshCountSignal() < this.MAX_MANUAL_RETRIES);

  // Computed: health
  readonly healthStatus = computed(() => this.healthState()?.status || 'UNKNOWN');
  readonly healthSummary = computed(() => this.healthState()?.summary);
  readonly isHealthy = computed(() => this.healthStatus() === 'HEALTHY');

  // Computed: aggregate cluster stats
  readonly clusterStats = computed<StatItem[]>(() => {
    const servers = this.servers();
    if (servers.length === 0) return [];

    const avgCpu = servers.reduce((sum, s) => sum + s.cpu.current, 0) / servers.length;
    const avgMemory = servers.reduce((sum, s) => sum + s.memory.current, 0) / servers.length;
    const avgDisk = servers.reduce((sum, s) => sum + s.disk.current, 0) / servers.length;
    const totalCores = servers.reduce((sum, s) => sum + s.cpu.cores, 0);

    const severityFor = (value: number, danger: number, warning: number): 'danger' | 'warning' | 'success' => {
      if (value > danger) return 'danger';
      if (value > warning) return 'warning';
      return 'success';
    };

    return [
      {
        label: 'Avg CPU',
        value: avgCpu.toFixed(1),
        unit: '%',
        severity: severityFor(avgCpu, 90, 70),
      },
      {
        label: 'Avg Memory',
        value: avgMemory.toFixed(1),
        unit: '%',
        severity: severityFor(avgMemory, 90, 75),
      },
      {
        label: 'Avg Disk',
        value: avgDisk.toFixed(1),
        unit: '%',
        severity: severityFor(avgDisk, 95, 80),
      },
      {
        label: 'Total Cores',
        value: totalCores,
        unit: 'cores',
        severity: 'info',
      },
    ];
  });

  /** Call from component ngOnInit — starts polling if not already running. */
  startPolling(): void {
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

  /** Call from component ngOnDestroy — stops polling when last subscriber leaves. */
  stopPolling(): void {
    this.subscriberCount = Math.max(0, this.subscriberCount - 1);
    if (this.subscriberCount === 0 && this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

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

  getHealthBadgeClass(): string {
    switch (this.healthStatus()) {
      case 'HEALTHY':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'DEGRADED':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'DOWN':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  }

  private async loadMetrics(_isManualRefresh: boolean = false): Promise<void> {
    const clusterId = this.clusterService.cluster()?.id;
    if (!clusterId) {
      this.errorSignal.set('No cluster selected');
      return;
    }

    try {
      this.isLoadingSignal.set(true);
      this.errorSignal.set(null);

      const [metricsResponse, healthResponse] = await Promise.all([
        firstValueFrom(this.metricsApi.serverMetricsControllerGetClusterMetrics(clusterId)),
        firstValueFrom(this.healthApi.clusterHealthControllerGetClusterHealth(clusterId)),
      ]);

      this.healthState.set(healthResponse);
      this.updateServerMetrics(metricsResponse);

      // Reset error counters on success
      this.consecutiveErrorCount.set(0);
      if (this.isPollingPaused()) {
        this.resumePolling();
      }
    } catch (error: any) {
      console.error('Failed to load cluster metrics:', error);

      const isHttpError = error?.status >= 400 && error?.status < 600;
      if (isHttpError) {
        const newCount = this.consecutiveErrorCount() + 1;
        this.consecutiveErrorCount.set(newCount);

        if (newCount >= this.MAX_CONSECUTIVE_ERRORS) {
          this.isPollingPaused.set(true);
          this.errorSignal.set(
            `API failed multiple times. Auto-refresh paused. Click "Retry" to resume.`
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

  private resumePolling(): void {
    this.isPollingPaused.set(false);
    this.consecutiveErrorCount.set(0);
    this.manualRefreshCountSignal.set(0);
  }

  private updateServerMetrics(response: ClusterMetricsResponseDto): void {
    const currentServers = this.serverMetrics();
    const updatedServers: ServerMetricsState[] = response.servers.map((server) => {
      const previousServer = currentServers.find(
        (s) => s.instance === server.instance || s.serverId === server.server_id
      );

      return {
        serverId: server.server_id || server.instance,
        instance: server.instance,
        cpu: {
          current: server.cpu.usage_percent,
          previous: previousServer?.cpu.current || server.cpu.usage_percent,
          cores: server.cpu.cores,
        },
        memory: {
          current: server.memory.usage_percent,
          previous: previousServer?.memory.current || server.memory.usage_percent,
          used: server.memory.used_bytes,
          total: server.memory.total_bytes,
        },
        disk: {
          current: server.disk.usage_percent,
          previous: previousServer?.disk.current || server.disk.usage_percent,
          used: server.disk.used_bytes,
          total: server.disk.total_bytes,
        },
        network: {
          bytesIn: server.network?.bytes_in || 0,
          bytesOut: server.network?.bytes_out || 0,
        },
      };
    });

    this.serverMetrics.set(updatedServers);
  }
}
