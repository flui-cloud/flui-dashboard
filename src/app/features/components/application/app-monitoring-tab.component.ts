import { databaseEngineOf } from '../../model/db-engine';
import { accessOf } from '../../model/app-access';
import { ApplicationService } from '../../service/application.service';
import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';

import { ActivatedRoute } from '@angular/router';
import { UserEventsService } from '../../../core/services/user-events.service';
import { firstValueFrom } from 'rxjs';
import { TimeSeriesChartData } from '../../../shared/components/charts';
import { formatPercent, formatRate } from '../../../shared/utils/metric-format';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';
import { ApplicationMetricsService } from '../../../core/api/api/applicationMetrics.service';
import { DbDiskUsageComponent } from './db-disk-usage.component';
import { AppTrafficSectionComponent, TrafficRange } from './app-traffic-section.component';
import { AppAlertsSectionComponent } from './app-alerts-section.component';
import type {
  AppHistoryPoint,
  SingleAppMetricsHistoryResponseDto,
} from '../../model/application.models';
import { lastReadinessDip, throttleNotice } from './app-monitoring-history';
import { AppHealthChecksService } from '../../service/app-health-checks.service';
import { AppCapacityAdviceService, adviceView } from '../../service/app-capacity-advice.service';
import { AppRuntimeService } from '../../service/app-runtime.service';
import { provideIcons } from '@ng-icons/core';
import { lucideActivity, lucideRefreshCw } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { SegmentOption, FlSegmented } from '../../../ui/patterns/filter-bar';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import {
  formatBytes,
  formatCpu,
  limitPercent,
  MonitoringMetric,
  monitoringMetrics,
} from './app-monitoring-metrics';
import {
  historyCharts,
  MonitoringTimeRange,
  RANGES,
  resolveRange,
  sizedPair,
} from './app-monitoring-series';
import { AppMonitoringSummary } from './app-monitoring-summary';
import { AppMonitoringChart } from './app-monitoring-chart';
import { AppMonitoringReplicas } from './app-monitoring-replicas';
import { AppMonitoringCapacity } from './app-monitoring-capacity';

const PHASE_TONES: Record<string, StatusTone> = {
  Running: 'success',
  Pending: 'warning',
  Failed: 'error',
};

@Component({
  selector: 'app-monitoring-tab',
  standalone: true,
  imports: [
    FlAlert,
    FlButton,
    FlEmptyState,
    FlIcon,
    FlLoadingState,
    FlPanel,
    FlSegmented,
    FlStatus,
    AppMonitoringSummary,
    AppMonitoringChart,
    AppMonitoringReplicas,
    AppMonitoringCapacity,
    DbDiskUsageComponent,
    AppTrafficSectionComponent,
    AppAlertsSectionComponent,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideActivity })],
  host: { class: 'fl-stack' },
  templateUrl: './app-monitoring-tab.component.html',
})
export class AppMonitoringTabComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);

  readonly monitoring = inject(ApplicationMonitoringService);
  private readonly metricsApi = inject(ApplicationMetricsService);
  private readonly healthChecks = inject(AppHealthChecksService);
  private readonly capacity = inject(AppCapacityAdviceService);
  private readonly runtime = inject(AppRuntimeService);
  readonly addingReplica = this.runtime.savingReplicas;
  readonly capacityAdvice = computed(() => {
    const advice = this.capacity.advice();
    const view = advice ? adviceView(advice.advice) : null;
    return advice && view ? { ...advice, ...view } : null;
  });

  private readonly apps = inject(ApplicationService);
  /** The disk under a database is part of its data: shown only when that data is the caller's to read. */
  protected readonly showsDisk = computed(() => {
    const app = this.apps.selectedApplication();
    return !!app && !!databaseEngineOf(app) && accessOf(app)?.dataAccess !== false;
  });

  protected appId(): string {
    return this.route.parent?.snapshot.paramMap.get('id') ?? '';
  }

  readonly metrics = this.monitoring.metrics;
  readonly isLoading = this.monitoring.isLoading;
  readonly error = this.monitoring.error;
  readonly pollingPaused = this.monitoring.pollingPaused;
  readonly canRetry = this.monitoring.canRetry;

  private readonly selectedTimeRange = signal<MonitoringTimeRange>('3h');
  readonly timeRange = this.selectedTimeRange.asReadonly();

  private readonly refreshTick = signal(0);

  private readonly userEvents = inject(UserEventsService);
  private unsubscribeAlerts: (() => void) | null = null;

  private readonly alertsRefreshTick = signal(0);
  readonly alertsRefreshKey = computed(() => this.refreshTick() + this.alertsRefreshTick());

  readonly trafficRange = computed<TrafficRange>(() => {
    this.refreshTick();
    return resolveRange(this.selectedTimeRange());
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

  private readonly historyPoints = signal<AppHistoryPoint[]>([]);
  readonly throttledPercent = computed(() => throttleNotice(this.historyPoints()));
  readonly lastDip = computed(() => lastReadinessDip(this.historyPoints()));

  readonly ranges = RANGES;
  protected readonly rangeOptions: SegmentOption[] = RANGES.map(({ value, label }) => ({
    value,
    label,
  }));
  readonly rangeLabel = computed(
    () => RANGES.find((r) => r.value === this.timeRange())?.long ?? '',
  );
  readonly cpuConfig = sizedPair({ unit: '%', thresholds: { warning: 70, danger: 90 } });
  readonly memoryConfig = sizedPair({ unit: '%', thresholds: { warning: 75, danger: 90 } });
  readonly networkConfig = sizedPair({ valueFormatter: (v: number) => formatRate(v) });
  readonly replicasConfig = sizedPair({ valueFormatter: (v: number) => v.toFixed(0) });

  protected readonly liveTone = computed<StatusTone>(() => {
    if (this.pollingPaused()) return 'neutral';
    return this.isLoading() ? 'progress' : 'success';
  });

  protected readonly liveLabel = computed(() => {
    if (this.pollingPaused()) return 'Auto-refresh paused';
    return this.isLoading() ? 'Refreshing' : 'Live';
  });

  private readonly selectedPodName = signal<string | null>(null);
  readonly selectedPod = this.selectedPodName.asReadonly();
  readonly availableReplicas = computed(() => this.metrics()?.replicas ?? []);

  /** The effective replica to show: explicit selection, or the only replica when there's just one. */
  private readonly effectiveReplica = computed(() => {
    const replicas = this.availableReplicas();
    const pod = this.selectedPodName();
    if (pod) return replicas.find((r) => r.pod === pod) ?? null;
    if (replicas.length === 1) return replicas[0];
    return null;
  });

  readonly activeCpu = computed(() => this.effectiveReplica()?.cpu ?? this.metrics()?.cpu ?? null);

  readonly activeMemory = computed(
    () => this.effectiveReplica()?.memory ?? this.metrics()?.memory ?? null,
  );

  readonly activeNetwork = computed(
    () => this.effectiveReplica()?.network ?? this.metrics()?.network ?? null,
  );

  readonly activeReplicaStatus = computed(() => this.effectiveReplica()?.status ?? null);

  selectPod(podName: string | null): void {
    this.selectedPodName.set(podName);
  }

  readonly replicaStats = computed(() => {
    const s = this.monitoring.statusMetrics();
    return {
      ready: s?.replicas_ready ?? null,
      desired: s?.replicas_desired ?? null,
      unavailable: s?.replicas_unavailable ?? 0,
    };
  });

  readonly cpuNow = computed(() => {
    const cpu = this.activeCpu();
    const pct = limitPercent(cpu?.usage_cores, cpu?.limits_cores);
    return pct == null ? '' : formatPercent(pct);
  });
  readonly memoryNow = computed(() => {
    const mem = this.activeMemory();
    const pct = limitPercent(mem?.usage_bytes, mem?.limits_bytes);
    return pct == null ? '' : formatPercent(pct);
  });
  readonly networkNow = computed(() => {
    const net = this.activeNetwork();
    return net ? formatRate((net.receive_bytes_rate ?? 0) + (net.transmit_bytes_rate ?? 0)) : '';
  });
  readonly replicasNow = computed(() => {
    const r = this.replicaStats();
    return r.desired && r.ready != null ? `${r.ready}/${r.desired}` : '';
  });

  readonly tiles = computed<MonitoringMetric[]>(() => {
    const podStatus = this.activeReplicaStatus();
    const appStatus = this.monitoring.statusMetrics();
    return monitoringMetrics({
      cpu: this.activeCpu(),
      memory: this.activeMemory(),
      network: this.activeNetwork(),
      replicas: this.replicaStats(),
      restarts: Math.round(podStatus?.restart_total ?? appStatus?.restart_total ?? 0),
      restartsHour: podStatus?.restart_rate_1h ?? appStatus?.restart_rate_1h ?? 0,
      throttledPercent: this.throttledPercent(),
      lastDip: this.lastDip(),
      checks: this.healthChecks.checks(),
    });
  });

  protected phaseTone(phase: string): StatusTone {
    return PHASE_TONES[phase] ?? 'neutral';
  }

  async addReplica(): Promise<void> {
    const advice = this.capacity.advice();
    if (advice?.advice !== 'add_replicas') return;
    if (await this.runtime.updateReplicas(this.appId(), { replicas: advice.desired + 1 })) {
      await this.capacity.load();
    }
  }

  ngOnInit(): void {
    this.monitoring.startPolling(this.appId());
    this.healthChecks.start(this.appId());
    this.capacity.start(this.appId());
    this.loadMetricsHistory();
    this.unsubscribeAlerts = this.userEvents.onAlert((event) => {
      if (event.applicationId === this.appId()) {
        this.alertsRefreshTick.update((tick) => tick + 1);
      }
    });
  }

  ngOnDestroy(): void {
    this.monitoring.stopPolling();
    this.healthChecks.stop();
    this.capacity.stop();
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

  protected onRangeChange(value: string): void {
    const range = RANGES.find((r) => r.value === value);
    if (range) this.setTimeRange(range.value);
  }

  private async loadMetricsHistory(): Promise<void> {
    const appId = this.appId();
    if (!appId) return;

    try {
      this.isLoadingHistory.set(true);
      const { start, end, step } = resolveRange(this.selectedTimeRange());

      const response = await firstValueFrom(
        this.metricsApi.applicationMetricsControllerGetAppMetricsHistory(
          appId,
          start.toISOString(),
          end.toISOString(),
          step,
        ),
      );
      this.transformHistoryData(response);
    } catch (error) {
      console.error('Failed to load app metrics history:', error);
    } finally {
      this.isLoadingHistory.set(false);
    }
  }

  private transformHistoryData(response: SingleAppMetricsHistoryResponseDto): void {
    const dp: AppHistoryPoint[] = response.data_points ?? [];
    this.historyPoints.set(dp);
    if (dp.length === 0) return;
    const charts = historyCharts(dp);
    this.cpuHistoryData.set(charts.cpu);
    this.memoryHistoryData.set(charts.memory);
    this.networkHistoryData.set(charts.network);
    this.replicasHistoryData.set(charts.replicas);
  }

  formatCpu(cores: number): string {
    return formatCpu(cores);
  }

  formatHealthDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatBytes(bytes: number): string {
    return formatBytes(bytes);
  }
}
