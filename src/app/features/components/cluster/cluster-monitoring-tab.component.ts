import { Component, OnInit, OnDestroy, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideActivity } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { ClusterMonitoringService } from '../../service/cluster-monitoring.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import {
  ClusterMetricsHistoryService,
  MetricsRange,
} from '../../service/cluster-metrics-history.service';
import { ClusterAppsMetricsService } from '../../service/cluster-apps-metrics.service';
import { AutoscaleWarningBannerComponent } from './autoscale-warning-banner.component';
import { ClusterMetricsSummaryComponent } from './cluster-metrics-summary.component';
import { ClusterMetricsGridComponent } from './cluster-metrics-grid.component';
import { ClusterNodesTableComponent } from './cluster-nodes-table.component';
import { ClusterAppsTableComponent } from './cluster-apps-table.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlSegmented, SegmentOption } from '../../../ui/patterns/filter-bar';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

const RANGES: readonly SegmentOption<MetricsRange>[] = [
  { value: '1h', label: '1h' },
  { value: '3h', label: '3h' },
  { value: '6h', label: '6h' },
  { value: '1d', label: '24h' },
];

@Component({
  selector: 'cluster-monitoring-tab',
  imports: [
    FlAlert,
    FlButton,
    FlEmptyState,
    FlIcon,
    FlLoadingState,
    FlPanel,
    FlSegmented,
    FlStatus,
    AutoscaleWarningBannerComponent,
    ClusterMetricsSummaryComponent,
    ClusterMetricsGridComponent,
    ClusterNodesTableComponent,
    ClusterAppsTableComponent,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideActivity })],
  host: { class: 'fl-stack' },
  templateUrl: './cluster-monitoring-tab.component.html',
})
export class ClusterMonitoringTabComponent implements OnInit, OnDestroy {
  readonly clusterService = inject(ClusterService);
  readonly monitoring = inject(ClusterMonitoringService);
  readonly history = inject(ClusterMetricsHistoryService);
  readonly apps = inject(ClusterAppsMetricsService);
  readonly autoscaleService = inject(ClusterAutoscaleService);
  private readonly router = inject(Router);

  readonly servers = this.monitoring.servers;
  readonly isLoading = this.monitoring.isLoading;
  readonly error = this.monitoring.error;
  readonly pollingPaused = this.monitoring.pollingPaused;
  readonly canRetry = this.monitoring.canRetry;
  readonly autoscaleStatus = this.autoscaleService.status;

  readonly ranges = RANGES;

  protected readonly liveTone = computed<StatusTone>(() => {
    if (this.pollingPaused()) return 'neutral';
    return this.isLoading() ? 'progress' : 'success';
  });

  protected readonly liveLabel = computed(() => {
    if (this.pollingPaused()) return 'Auto-refresh paused';
    return this.isLoading() ? 'Refreshing' : 'Live';
  });

  private historyTimer?: number;

  ngOnInit(): void {
    this.monitoring.startPolling();
    void this.loadWindowed();
    this.scheduleHistoryRefresh();
  }

  ngOnDestroy(): void {
    this.monitoring.stopPolling();
    this.clearHistoryRefresh();
  }

  protected onRangeChange(value: string): void {
    const range = RANGES.find((r) => r.value === value);
    if (range) this.setRange(range.value);
  }

  setRange(range: MetricsRange): void {
    this.history.setRange(range);
    void this.loadHistory();
    this.scheduleHistoryRefresh();
  }

  async refresh(): Promise<void> {
    await Promise.all([this.monitoring.refreshMetrics(), this.loadWindowed()]);
  }

  goToScaling(): void {
    const id = this.clusterService.cluster()?.id;
    if (id) void this.router.navigate(['/cluster', id, 'scaling']);
  }

  private async loadWindowed(): Promise<void> {
    const clusterId = this.clusterService.cluster()?.id;
    if (!clusterId) return;
    await Promise.all([this.history.load(clusterId), this.apps.load(clusterId)]);
  }

  private async loadHistory(): Promise<void> {
    const clusterId = this.clusterService.cluster()?.id;
    if (clusterId) await this.history.load(clusterId);
  }

  private scheduleHistoryRefresh(): void {
    this.clearHistoryRefresh();
    this.historyTimer = globalThis.window.setInterval(
      () => void this.loadHistory(),
      this.history.refreshIntervalMs(),
    );
  }

  private clearHistoryRefresh(): void {
    if (this.historyTimer) clearInterval(this.historyTimer);
    this.historyTimer = undefined;
  }
}
