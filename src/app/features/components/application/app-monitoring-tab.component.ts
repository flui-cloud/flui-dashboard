import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  GradeGaugeComponent,
  GaugeChartData,
  GaugeChartConfig,
  TimeSeriesLineComponent,
  TimeSeriesChartData,
  TimeSeriesChartConfig,
  TimeSeriesSeries,
  MultiStatCardComponent,
  MultiStatCardData,
} from '../../../shared/components/charts';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';
import { ApplicationMetricsService } from '../../../core/api/api/applicationMetrics.service';
import type { SingleAppMetricsHistoryResponseDto } from '../../model/application.models';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideActivity, lucideCircleCheck, lucideTriangleAlert, lucideHeartPulse } from '@ng-icons/lucide';

@Component({
  selector: 'app-monitoring-tab',
  standalone: true,
  imports: [
    CommonModule,
    NgIconComponent,
    GradeGaugeComponent,
    TimeSeriesLineComponent,
    MultiStatCardComponent,
  ],
  providers: [
    provideIcons({ lucideRefreshCw, lucideActivity, lucideCircleCheck, lucideTriangleAlert, lucideHeartPulse }),
  ],
  templateUrl: './app-monitoring-tab.component.html',
})
export class AppMonitoringTabComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);

  readonly monitoring = inject(ApplicationMonitoringService);
  private readonly metricsApi = inject(ApplicationMetricsService);

  private appId(): string {
    return this.route.parent?.snapshot.paramMap.get('id') ?? '';
  }

  // Delegate shared signals
  readonly metrics = this.monitoring.metrics;
  readonly isLoading = this.monitoring.isLoading;
  readonly error = this.monitoring.error;
  readonly pollingPaused = this.monitoring.pollingPaused;
  readonly canRetry = this.monitoring.canRetry;

  // Time series state (local to this tab)
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

  // Gauge configurations
  readonly cpuGaugeConfig: GaugeChartConfig = {
    unit: '%', thresholds: { warning: 70, danger: 90 }, height: '200px',
  };
  readonly memoryGaugeConfig: GaugeChartConfig = {
    unit: '%', thresholds: { warning: 75, danger: 90 }, height: '200px',
  };

  // Time series configurations
  readonly cpuTsConfig: TimeSeriesChartConfig = {
    unit: '%', height: '300px', showGrid: true, showLegend: false,
    thresholds: { warning: 70, danger: 90 },
  };
  readonly memoryTsConfig: TimeSeriesChartConfig = {
    unit: '%', height: '300px', showGrid: true, showLegend: false,
    thresholds: { warning: 75, danger: 90 },
  };
  readonly networkTsConfig: TimeSeriesChartConfig = {
    unit: ' B/s', height: '300px', showGrid: true, showLegend: true,
    valueFormatter: (v: number) => this.formatBytes(v),
  };

  // Pod selector
  private readonly selectedPodName = signal<string | null>(null);
  readonly selectedPod = this.selectedPodName.asReadonly();
  readonly availableReplicas = computed(() => this.metrics()?.replicas ?? []);

  /** The effective replica to show: explicit selection, or the only replica when there's just one. */
  private readonly effectiveReplica = computed(() => {
    const replicas = this.availableReplicas();
    const pod = this.selectedPodName();
    if (pod) return replicas.find(r => r.pod === pod) ?? null;
    if (replicas.length === 1) return replicas[0];
    return null;
  });

  readonly activeCpu = computed(() =>
    this.effectiveReplica()?.cpu ?? this.metrics()?.cpu ?? null
  );

  readonly activeMemory = computed(() =>
    this.effectiveReplica()?.memory ?? this.metrics()?.memory ?? null
  );

  readonly activeNetwork = computed(() =>
    this.effectiveReplica()?.network ?? this.metrics()?.network ?? null
  );

  readonly activeReplicaStatus = computed(() =>
    this.effectiveReplica()?.status ?? null
  );

  selectPod(podName: string | null): void {
    this.selectedPodName.set(podName);
  }

  // Computed gauge data — usage vs limits (not requests) for realistic representation
  readonly cpuGaugeData = computed<GaugeChartData>(() => {
    const cpu = this.activeCpu();
    const usage = cpu?.usage_cores ?? 0;
    const limits = cpu?.limits_cores ?? 0;
    const pct = limits > 0 ? (usage / limits) * 100 : 0;
    return {
      value: pct,
      title: 'CPU',
      subtitle: `${this.formatCpu(usage)} / ${this.formatCpu(limits)}`,
    };
  });

  readonly memoryGaugeData = computed<GaugeChartData>(() => {
    const mem = this.activeMemory();
    const usage = mem?.usage_bytes ?? 0;
    const limits = mem?.limits_bytes ?? 0;
    const pct = limits > 0 ? (usage / limits) * 100 : 0;
    return {
      value: pct,
      title: 'Memory',
      subtitle: `${this.formatBytes(usage)} / ${this.formatBytes(limits)}`,
    };
  });

  // Computed stat cards
  readonly replicaStats = computed(() => {
    const s = this.monitoring.statusMetrics();
    return {
      ready: s?.replicas_ready ?? 0,
      desired: s?.replicas_desired ?? 0,
      unavailable: s?.replicas_unavailable ?? 0,
    };
  });

  readonly restartStats = computed<MultiStatCardData>(() => {
    const podStatus = this.activeReplicaStatus();
    const appStatus = this.monitoring.statusMetrics();
    const total = podStatus?.restart_total ?? appStatus?.restart_total ?? 0;
    const rate = podStatus?.restart_rate_1h ?? appStatus?.restart_rate_1h ?? 0;
    // Pass pre-formatted strings so MultiStatCardComponent doesn't apply its
    // default two-decimal float formatter (restart counts are integers).
    return {
      title: 'Container Restarts',
      stats: [
        { label: 'Total', value: String(Math.round(total)), severity: total > 0 ? 'warning' : 'success' },
        { label: 'Last Hour', value: rate.toFixed(1), severity: rate > 0 ? 'danger' : 'success' },
      ],
    };
  });

  readonly networkStats = computed<MultiStatCardData>(() => {
    const net = this.activeNetwork();
    return {
      title: 'Network I/O',
      stats: [
        { label: 'Receive', value: this.formatBytes(net?.receive_bytes_rate ?? 0) + '/s', severity: 'info' },
        { label: 'Transmit', value: this.formatBytes(net?.transmit_bytes_rate ?? 0) + '/s', severity: 'info' },
      ],
    };
  });

  ngOnInit(): void {
    this.monitoring.startPolling(this.appId());
    this.loadMetricsHistory();
  }

  ngOnDestroy(): void {
    this.monitoring.stopPolling();
  }

  async refreshMetrics(): Promise<void> {
    await this.monitoring.refreshMetrics();
  }

  setTimeRange(range: '1h' | '2h' | '3h' | '6h' | '1d'): void {
    this.selectedTimeRange.set(range);
    this.loadMetricsHistory();
  }

  private async loadMetricsHistory(): Promise<void> {
    const appId = this.appId();
    if (!appId) return;

    try {
      this.isLoadingHistory.set(true);
      const end = new Date();
      const start = new Date();
      let step: string;

      switch (this.selectedTimeRange()) {
        case '1h': start.setHours(start.getHours() - 1); step = '30s'; break;
        case '2h': start.setHours(start.getHours() - 2); step = '1m'; break;
        case '3h': start.setHours(start.getHours() - 3); step = '1m'; break;
        case '6h': start.setHours(start.getHours() - 6); step = '2m'; break;
        case '1d': start.setDate(start.getDate() - 1); step = '5m'; break;
      }

      const response = await firstValueFrom(
        this.metricsApi.applicationMetricsControllerGetAppMetricsHistory(
          appId, start.toISOString(), end.toISOString(), step
        )
      );
      this.transformHistoryData(response);
    } catch (error) {
      console.error('Failed to load app metrics history:', error);
    } finally {
      this.isLoadingHistory.set(false);
    }
  }

  private transformHistoryData(response: SingleAppMetricsHistoryResponseDto): void {
    if (!response.data_points || response.data_points.length === 0) return;

    const dp = response.data_points;

    // CPU chart
    const cpuSeries: TimeSeriesSeries[] = [{
      name: 'CPU %',
      data: dp
        .filter(p => p.cpu_utilization_percent != null)
        .map(p => ({ timestamp: new Date(p.datetime), value: p.cpu_utilization_percent! })),
      smooth: true,
      color: '#3b82f6',
    }];
    this.cpuHistoryData.set({ title: 'CPU Usage History', series: cpuSeries });

    // Memory chart
    const memorySeries: TimeSeriesSeries[] = [{
      name: 'Memory %',
      data: dp
        .filter(p => p.memory_utilization_percent != null)
        .map(p => ({ timestamp: new Date(p.datetime), value: p.memory_utilization_percent! })),
      smooth: true,
      color: '#8b5cf6',
    }];
    this.memoryHistoryData.set({ title: 'Memory Usage History', series: memorySeries });

    // Network chart (2 series)
    const netIn = dp
      .filter(p => p.network_receive_rate != null)
      .map(p => ({ timestamp: new Date(p.datetime), value: p.network_receive_rate! }));
    const netOut = dp
      .filter(p => p.network_transmit_rate != null)
      .map(p => ({ timestamp: new Date(p.datetime), value: p.network_transmit_rate! }));

    this.networkHistoryData.set({
      title: 'Network I/O History',
      series: [
        { name: 'Network In', data: netIn, smooth: true, color: '#3b82f6' },
        { name: 'Network Out', data: netOut, smooth: true, color: '#f59e0b' },
      ],
    });
  }

  formatCpu(cores: number): string {
    if (cores >= 1) return `${cores.toFixed(2)} cores`;
    return `${(cores * 1000).toFixed(0)} m`;
  }

  formatHealthDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes.toFixed(0)} B`;
  }
}
