import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  GradeGaugeComponent,
  GaugeChartData,
  GaugeChartConfig,
  TimeSeriesLineComponent,
  TimeSeriesChartData,
  TimeSeriesChartConfig,
  TimeSeriesSeries,
} from '../../../shared/components/charts';
import { ClusterService } from '../../service/cluster.service';
import { ClusterMonitoringService, ServerMetricsState } from '../../service/cluster-monitoring.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { ClusterMetricsLogsService } from '../../../core/api/api/clusterMetricsLogs.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideActivity } from '@ng-icons/lucide';
import { AutoscaleWarningBannerComponent } from './autoscale-warning-banner.component';
import { AddWorkerDialogComponent } from './add-worker-dialog.component';

@Component({
  selector: 'cluster-monitoring-tab',
  standalone: true,
  imports: [
    CommonModule,
    GradeGaugeComponent,
    TimeSeriesLineComponent,
    NgIconComponent,
    AutoscaleWarningBannerComponent,
    AddWorkerDialogComponent,
  ],
  providers: [
    provideIcons({ lucideRefreshCw, lucideActivity }),
  ],
  templateUrl: './cluster-monitoring-tab.component.html',
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class ClusterMonitoringTabComponent implements OnInit, OnDestroy {
  readonly clusterService = inject(ClusterService);
  private readonly metricsService = inject(ClusterMetricsLogsService);
  readonly monitoring = inject(ClusterMonitoringService);
  readonly autoscaleService = inject(ClusterAutoscaleService);
  private readonly router = inject(Router);

  // Delegate shared signals
  readonly servers = this.monitoring.servers;
  readonly isLoading = this.monitoring.isLoading;
  readonly error = this.monitoring.error;
  readonly pollingPaused = this.monitoring.pollingPaused;
  readonly canRetry = this.monitoring.canRetry;
  readonly autoscaleStatus = this.autoscaleService.status;

  // Time series state (local to monitoring tab)
  private readonly selectedTimeRange = signal<'1h' | '2h' | '3h' | '6h' | '1d'>('3h');
  readonly timeRange = this.selectedTimeRange.asReadonly();
  private readonly isLoadingHistory = signal(false);
  readonly loadingHistory = this.isLoadingHistory.asReadonly();

  private readonly cpuHistoryData = signal<TimeSeriesChartData | null>(null);
  private readonly memoryHistoryData = signal<TimeSeriesChartData | null>(null);
  private readonly networkHistoryData = signal<TimeSeriesChartData | null>(null);

  readonly cpuHistory = this.cpuHistoryData.asReadonly();
  readonly memoryHistory = this.memoryHistoryData.asReadonly();
  readonly networkHistory = this.networkHistoryData.asReadonly();

  // Per-server gauge configurations — driven by autoscale effective thresholds when available
  readonly cpuConfig = computed<GaugeChartConfig>(() => {
    const t = this.autoscaleStatus()?.effectiveThresholds;
    return {
      unit: '%',
      thresholds: {
        warning: t?.warnCpuPct ?? 70,
        danger: t?.dangerCpuPct ?? 90,
      },
      height: '200px',
    };
  });

  readonly memoryConfig = computed<GaugeChartConfig>(() => {
    const t = this.autoscaleStatus()?.effectiveThresholds;
    return {
      unit: '%',
      thresholds: {
        warning: t?.warnMemoryPct ?? 75,
        danger: t?.dangerMemoryPct ?? 90,
      },
      height: '200px',
    };
  });

  readonly diskConfig: GaugeChartConfig = {
    unit: '%',
    thresholds: { warning: 80, danger: 95 },
    height: '200px',
  };

  // Time series chart configurations — same dynamic thresholds for the dashed lines
  readonly cpuTimeSeriesConfig = computed<TimeSeriesChartConfig>(() => {
    const t = this.autoscaleStatus()?.effectiveThresholds;
    return {
      unit: '%',
      height: '300px',
      showGrid: true,
      showLegend: true,
      thresholds: {
        warning: t?.warnCpuPct ?? 70,
        danger: t?.dangerCpuPct ?? 90,
      },
    };
  });

  readonly memoryTimeSeriesConfig = computed<TimeSeriesChartConfig>(() => {
    const t = this.autoscaleStatus()?.effectiveThresholds;
    return {
      unit: '%',
      height: '300px',
      showGrid: true,
      showLegend: true,
      thresholds: {
        warning: t?.warnMemoryPct ?? 75,
        danger: t?.dangerMemoryPct ?? 90,
      },
    };
  });

  readonly networkTimeSeriesConfig: TimeSeriesChartConfig = {
    unit: ' MB/s',
    height: '300px',
    showGrid: true,
    showLegend: true,
    valueFormatter: (value: number) => this.formatNetworkValue(value),
  };

  ngOnInit(): void {
    this.monitoring.startPolling();
    this.loadMetricsHistory();
  }

  ngOnDestroy(): void {
    this.monitoring.stopPolling();
  }

  goToAutoscaling(): void {
    const id = this.clusterService.cluster()?.id;
    if (id) this.router.navigate(['/cluster', id, 'autoscaling']);
  }

  goToNodes(): void {
    const id = this.clusterService.cluster()?.id;
    if (id) this.router.navigate(['/cluster', id, 'nodes']);
  }

  showAddWorkerDialog = signal<boolean>(false);

  openAddWorker(): void {
    this.showAddWorkerDialog.set(true);
  }

  async refreshMetrics(): Promise<void> {
    await this.monitoring.refreshMetrics();
  }

  setTimeRange(range: '1h' | '2h' | '3h' | '6h' | '1d'): void {
    this.selectedTimeRange.set(range);
    this.loadMetricsHistory();
  }

  private async loadMetricsHistory(): Promise<void> {
    const clusterId = this.clusterService.cluster()?.id;
    if (!clusterId) return;

    try {
      this.isLoadingHistory.set(true);

      const end = new Date();
      const start = new Date();
      const range = this.selectedTimeRange();
      let step: string;

      switch (range) {
        case '1h':
          start.setHours(start.getHours() - 1);
          step = '30s';
          break;
        case '2h':
          start.setHours(start.getHours() - 2);
          step = '1m';
          break;
        case '3h':
          start.setHours(start.getHours() - 3);
          step = '1m';
          break;
        case '6h':
          start.setHours(start.getHours() - 6);
          step = '2m';
          break;
        case '1d':
          start.setDate(start.getDate() - 1);
          step = '5m';
          break;
      }

      const historyResponse = await firstValueFrom(
        this.metricsService.serverMetricsControllerGetClusterMetricsHistory(
          clusterId,
          start.toISOString(),
          end.toISOString(),
          step
        )
      );

      this.transformHistoryData(historyResponse);
    } catch (error) {
      console.error('Failed to load metrics history:', error);
    } finally {
      this.isLoadingHistory.set(false);
    }
  }

  private transformHistoryData(response: any): void {
    if (!response.servers || response.servers.length === 0) return;

    // CPU Chart
    const cpuSeries: TimeSeriesSeries[] = response.servers.map((server: any) => ({
      name: server.server_id || server.instance,
      data: server.data_points
        .filter((dp: any) => dp.cpu_percent != null)
        .map((dp: any) => ({
          timestamp: new Date(dp.datetime),
          value: dp.cpu_percent,
        })),
      smooth: true,
    }));

    this.cpuHistoryData.set({ title: 'CPU Usage History', series: cpuSeries });

    // Memory Chart
    const memorySeries: TimeSeriesSeries[] = response.servers.map((server: any) => ({
      name: server.server_id || server.instance,
      data: server.data_points
        .filter((dp: any) => dp.memory_percent != null)
        .map((dp: any) => ({
          timestamp: new Date(dp.datetime),
          value: dp.memory_percent,
        })),
      smooth: true,
    }));

    this.memoryHistoryData.set({ title: 'Memory Usage History', series: memorySeries });

    // Network Chart - aggregated
    const timestampMap = new Map<string, { in: number; out: number }>();
    response.servers.forEach((server: any) => {
      server.data_points.forEach((dp: any) => {
        const key = dp.datetime;
        const existing = timestampMap.get(key) || { in: 0, out: 0 };
        existing.in += dp.network_in || 0;
        existing.out += dp.network_out || 0;
        timestampMap.set(key, existing);
      });
    });

    const networkInData: { timestamp: Date; value: number }[] = [];
    const networkOutData: { timestamp: Date; value: number }[] = [];
    const sortedTimestamps = Array.from(timestampMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    sortedTimestamps.forEach(([datetime, values]) => {
      const timestamp = new Date(datetime);
      networkInData.push({ timestamp, value: values.in });
      networkOutData.push({ timestamp, value: values.out });
    });

    this.networkHistoryData.set({
      title: 'Network I/O History',
      series: [
        { name: 'Network In', data: networkInData, smooth: true, color: '#3b82f6' },
        { name: 'Network Out', data: networkOutData, smooth: true, color: '#f59e0b' },
      ],
    });
  }

  // Format network values with adaptive units
  formatNetworkValue(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${bytes.toFixed(0)} B/s`;
  }

  // Helper methods for per-server gauges
  getCpuData(server: ServerMetricsState): GaugeChartData {
    return {
      value: server.cpu.current,
      title: 'CPU Usage',
      subtitle: `${server.cpu.current.toFixed(1)}% (${server.cpu.cores} cores)`,
      previousValue: server.cpu.previous,
    };
  }

  getMemoryData(server: ServerMetricsState): GaugeChartData {
    const usedGB = (server.memory.used / (1024 ** 3)).toFixed(1);
    const totalGB = (server.memory.total / (1024 ** 3)).toFixed(1);
    return {
      value: server.memory.current,
      title: 'Memory',
      subtitle: `${usedGB} GB / ${totalGB} GB`,
      previousValue: server.memory.previous,
    };
  }

  getDiskData(server: ServerMetricsState): GaugeChartData {
    const usedGB = (server.disk.used / (1024 ** 3)).toFixed(0);
    const totalGB = (server.disk.total / (1024 ** 3)).toFixed(0);
    return {
      value: server.disk.current,
      title: 'Disk Usage',
      subtitle: `${usedGB} GB / ${totalGB} GB`,
      previousValue: server.disk.previous,
    };
  }
}
