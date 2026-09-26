import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';

import { ActivatedRoute } from '@angular/router';
import { UserEventsService } from '../../../core/services/user-events.service';
import { firstValueFrom } from 'rxjs';
import {
  ChartPanelComponent,
  StatTileComponent,
  StatTileData,
  NODE_SERIES_COLORS,
  TimeSeriesLineComponent,
  TimeSeriesChartData,
  TimeSeriesChartConfig,
  TimeSeriesSeries,
} from '../../../shared/components/charts';
import { formatPercent, formatRate } from '../../../shared/utils/metric-format';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';
import { ApplicationMetricsService } from '../../../core/api/api/applicationMetrics.service';
import { DbDiskUsageComponent } from './db-disk-usage.component';
import {
  AppTrafficSectionComponent,
  TrafficRange,
} from './app-traffic-section.component';
import { AppAlertsSectionComponent } from './app-alerts-section.component';
import type { SingleAppMetricsHistoryResponseDto } from '../../model/application.models';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideActivity, lucideCircleCheck, lucideTriangleAlert, lucideHeartPulse } from '@ng-icons/lucide';

type MonitoringTimeRange = '1h' | '2h' | '3h' | '6h' | '1d';

/** One config object per size, held stable so a 5s poll never re-applies chart options. */
type SizedConfig = Record<'inline' | 'expanded', TimeSeriesChartConfig>;

const INLINE_HEIGHT = '190px';
const EXPANDED_HEIGHT = 'min(62vh, 560px)';

const RANGES: { value: MonitoringTimeRange; label: string; long: string }[] = [
  { value: '1h', label: '1h', long: 'last hour' },
  { value: '2h', label: '2h', long: 'last 2 hours' },
  { value: '3h', label: '3h', long: 'last 3 hours' },
  { value: '6h', label: '6h', long: 'last 6 hours' },
  { value: '1d', label: '1d', long: 'last day' },
];

function sizedPair(extra: TimeSeriesChartConfig): SizedConfig {
  const base = { showGrid: true, showLegend: true, showTitle: false, ...extra };
  return {
    inline: { ...base, height: INLINE_HEIGHT, enableZoom: false, animated: true },
    expanded: { ...base, height: EXPANDED_HEIGHT, enableZoom: true, animated: false },
  };
}

@Component({
  selector: 'app-monitoring-tab',
  standalone: true,
  imports: [
    NgIconComponent,
    ChartPanelComponent,
    StatTileComponent,
    TimeSeriesLineComponent,
    DbDiskUsageComponent,
    AppTrafficSectionComponent,
    AppAlertsSectionComponent
],
  providers: [
    provideIcons({ lucideRefreshCw, lucideActivity, lucideCircleCheck, lucideTriangleAlert, lucideHeartPulse }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './app-monitoring-tab.component.html',
})
export class AppMonitoringTabComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);

  readonly monitoring = inject(ApplicationMonitoringService);
  private readonly metricsApi = inject(ApplicationMetricsService);

  protected appId(): string {
    return this.route.parent?.snapshot.paramMap.get('id') ?? '';
  }

  // Delegate shared signals
  readonly metrics = this.monitoring.metrics;
  readonly isLoading = this.monitoring.isLoading;
  readonly error = this.monitoring.error;
  readonly pollingPaused = this.monitoring.pollingPaused;
  readonly canRetry = this.monitoring.canRetry;

  // Time series state (local to this tab)
  private readonly selectedTimeRange = signal<MonitoringTimeRange>('3h');
  readonly timeRange = this.selectedTimeRange.asReadonly();

  private readonly refreshTick = signal(0);

  private readonly userEvents = inject(UserEventsService);
  private unsubscribeAlerts: (() => void) | null = null;

  private readonly alertsRefreshTick = signal(0);
  readonly alertsRefreshKey = computed(
    () => this.refreshTick() + this.alertsRefreshTick(),
  );

  readonly trafficRange = computed<TrafficRange>(() => {
    this.refreshTick();
    return this.resolveRange(this.selectedTimeRange());
  });
  private readonly isLoadingHistory = signal(false);
  readonly loadingHistory = this.isLoadingHistory.asReadonly();

  private readonly cpuHistoryData = signal<TimeSeriesChartData | null>(null);
  private readonly memoryHistoryData = signal<TimeSeriesChartData | null>(null);
  private readonly networkHistoryData = signal<TimeSeriesChartData | null>(null);
  private readonly replicasHistoryData = signal<TimeSeriesChartData | null>(null);

  readonly cpuHistory = this.cpuHistoryData.asReadonly();
  readonly memoryHistory = this.memoryHistoryData.asReadonly();
  readonly networkHistory = this.networkHistoryData.asReadonly();
  readonly replicasHistory = this.replicasHistoryData.asReadonly();

  readonly ranges = RANGES;
  readonly rangeLabel = computed(() => RANGES.find((r) => r.value === this.timeRange())?.long ?? '');
  readonly inlineHeight = INLINE_HEIGHT;
  readonly expandedHeight = EXPANDED_HEIGHT;
  readonly cpuConfig = sizedPair({ unit: '%', thresholds: { warning: 70, danger: 90 } });
  readonly memoryConfig = sizedPair({ unit: '%', thresholds: { warning: 75, danger: 90 } });
  readonly networkConfig = sizedPair({ valueFormatter: (v: number) => formatRate(v) });
  readonly replicasConfig = sizedPair({ valueFormatter: (v: number) => v.toFixed(0) });

  /** The template context is untyped, so the size is resolved here rather than indexed inline. */
  pick(config: SizedConfig, mode: string): TimeSeriesChartConfig {
    return mode === 'expanded' ? config.expanded : config.inline;
  }

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

  readonly replicaStats = computed(() => {
    const s = this.monitoring.statusMetrics();
    return {
      ready: s?.replicas_ready ?? 0,
      desired: s?.replicas_desired ?? 0,
      unavailable: s?.replicas_unavailable ?? 0,
    };
  });

  private readonly cpuPct = computed(() => {
    const cpu = this.activeCpu();
    const limit = cpu?.limits_cores ?? 0;
    return limit > 0 ? ((cpu?.usage_cores ?? 0) / limit) * 100 : null;
  });

  private readonly memoryPct = computed(() => {
    const mem = this.activeMemory();
    const limit = mem?.limits_bytes ?? 0;
    return limit > 0 ? ((mem?.usage_bytes ?? 0) / limit) * 100 : null;
  });

  readonly cpuNow = computed(() => {
    const pct = this.cpuPct();
    return pct == null ? '' : formatPercent(pct);
  });
  readonly memoryNow = computed(() => {
    const pct = this.memoryPct();
    return pct == null ? '' : formatPercent(pct);
  });
  readonly networkNow = computed(() => {
    const net = this.activeNetwork();
    return net ? formatRate((net.receive_bytes_rate ?? 0) + (net.transmit_bytes_rate ?? 0)) : '';
  });
  readonly replicasNow = computed(() => {
    const r = this.replicaStats();
    return r.desired ? `${r.ready}/${r.desired}` : '';
  });

  readonly tiles = computed<StatTileData[]>(() => {
    const cpu = this.activeCpu();
    const mem = this.activeMemory();
    const net = this.activeNetwork();
    const replicas = this.replicaStats();
    const podStatus = this.activeReplicaStatus();
    const appStatus = this.monitoring.statusMetrics();
    const restarts = Math.round(podStatus?.restart_total ?? appStatus?.restart_total ?? 0);
    const restartsHour = podStatus?.restart_rate_1h ?? appStatus?.restart_rate_1h ?? 0;
    const cpuPct = this.cpuPct();
    const memoryPct = this.memoryPct();
    const spark = (data: TimeSeriesChartData | null) => data?.series[0]?.data.map((p) => p.value) ?? [];
    const netIn = net?.receive_bytes_rate ?? 0;
    const netOut = net?.transmit_bytes_rate ?? 0;
    return [
      {
        label: 'CPU',
        value: cpuPct == null ? '—' : cpuPct.toFixed(1),
        unit: cpuPct == null ? '' : '%',
        spark: spark(this.cpuHistory()),
        color: NODE_SERIES_COLORS[0],
        footnote: `${this.formatCpu(cpu?.usage_cores ?? 0)} / ${this.formatCpu(cpu?.limits_cores ?? 0)}`,
      },
      {
        label: 'Memory',
        value: memoryPct == null ? '—' : memoryPct.toFixed(1),
        unit: memoryPct == null ? '' : '%',
        spark: spark(this.memoryHistory()),
        color: NODE_SERIES_COLORS[1],
        footnote: `${this.formatBytes(mem?.usage_bytes ?? 0)} / ${this.formatBytes(mem?.limits_bytes ?? 0)}`,
      },
      {
        label: 'Replicas',
        value: `${replicas.ready}/${replicas.desired}`,
        spark: spark(this.replicasHistory()),
        color: NODE_SERIES_COLORS[2],
        footnote: replicas.unavailable > 0 ? `${replicas.unavailable} unavailable` : 'all ready',
      },
      {
        label: 'Restarts',
        value: String(restarts),
        spark: [],
        color: NODE_SERIES_COLORS[3],
        footnote: `${restartsHour.toFixed(1)} last hour`,
      },
      {
        label: 'Network',
        value: formatRate(netIn + netOut),
        spark: spark(this.networkHistory()),
        color: NODE_SERIES_COLORS[0],
        footnote: `${formatRate(netIn)} in · ${formatRate(netOut)} out`,
      },
    ];
  });

  ngOnInit(): void {
    this.monitoring.startPolling(this.appId());
    this.loadMetricsHistory();
    this.unsubscribeAlerts = this.userEvents.onAlert((event) => {
      if (event.applicationId === this.appId()) {
        this.alertsRefreshTick.update((tick) => tick + 1);
      }
    });
  }

  ngOnDestroy(): void {
    this.monitoring.stopPolling();
    this.unsubscribeAlerts?.();
    this.unsubscribeAlerts = null;
  }

  async refreshMetrics(): Promise<void> {
    await this.monitoring.refreshMetrics();
    this.refreshTick.update((tick) => tick + 1);
    await this.loadMetricsHistory();
  }

  setTimeRange(range: MonitoringTimeRange): void {
    this.selectedTimeRange.set(range);
    this.loadMetricsHistory();
  }

  private resolveRange(range: MonitoringTimeRange): TrafficRange {
    const end = new Date();
    const start = new Date();
    let step: string;

    switch (range) {
      case '1h': start.setHours(start.getHours() - 1); step = '30s'; break;
      case '2h': start.setHours(start.getHours() - 2); step = '1m'; break;
      case '3h': start.setHours(start.getHours() - 3); step = '1m'; break;
      case '6h': start.setHours(start.getHours() - 6); step = '2m'; break;
      case '1d': start.setDate(start.getDate() - 1); step = '5m'; break;
    }

    return { start, end, step };
  }

  private async loadMetricsHistory(): Promise<void> {
    const appId = this.appId();
    if (!appId) return;

    try {
      this.isLoadingHistory.set(true);
      const { start, end, step } = this.resolveRange(this.selectedTimeRange());

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

    const ready = dp
      .filter(p => p.replicas_ready != null)
      .map(p => ({ timestamp: new Date(p.datetime), value: p.replicas_ready! }));
    const desired = dp
      .filter(p => p.replicas_desired != null)
      .map(p => ({ timestamp: new Date(p.datetime), value: p.replicas_desired! }));
    this.replicasHistoryData.set(
      ready.length || desired.length
        ? {
            title: 'Replicas',
            series: [
              { name: 'Ready', data: ready, color: '#10b981' },
              { name: 'Desired', data: desired, color: '#94a3b8' },
            ],
          }
        : null,
    );
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
    if (bytes >= 1024 * 1024) {
      const mb = bytes / (1024 * 1024);
      return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
    }
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes.toFixed(0)} B`;
  }
}
