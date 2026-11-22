import { Component, computed, inject } from '@angular/core';
import { TimeSeriesChartConfig } from '../../../shared/components/charts';
import { ClusterMetricsHistoryService } from '../../service/cluster-metrics-history.service';
import {
  ClusterMonitoringService,
  ServerMetricsState,
} from '../../service/cluster-monitoring.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { formatPercent, formatRate } from '../../../shared/utils/metric-format';
import { AppMonitoringChart } from '../application/app-monitoring-chart';

type SizedConfig = Record<'inline' | 'expanded', TimeSeriesChartConfig>;

const INLINE_HEIGHT = '190px';
const EXPANDED_HEIGHT = 'min(62vh, 560px)';

/**
 * The four cluster series, small enough to be read side by side. Each panel
 * opens full screen, where the same chart gains its zoom handles and the room
 * for per-node detail.
 */
@Component({
  selector: 'app-cluster-metrics-grid',
  imports: [AppMonitoringChart],
  host: { class: 'block' },
  template: `
    <div class="fl-grid-2" data-testid="cluster-metrics-grid">
      @if (history.cpu(); as cpu) {
        <app-monitoring-chart
          title="CPU"
          [caption]="history.seriesSubtitle()"
          [value]="cpuNow()"
          [data]="cpu"
          [config]="cpuConfig().inline"
          [expandedConfig]="cpuConfig().expanded"
        />
      }
      @if (history.memory(); as memory) {
        <app-monitoring-chart
          title="Memory"
          [caption]="history.seriesSubtitle()"
          [value]="memoryNow()"
          [data]="memory"
          [config]="memoryConfig().inline"
          [expandedConfig]="memoryConfig().expanded"
        />
      }
      @if (history.disk(); as disk) {
        <app-monitoring-chart
          title="Disk"
          [caption]="history.seriesSubtitle()"
          [value]="diskNow()"
          [data]="disk"
          [config]="diskConfig().inline"
          [expandedConfig]="diskConfig().expanded"
        />
      }
      @if (history.network(); as network) {
        <app-monitoring-chart
          title="Network"
          caption="cluster total"
          [value]="networkNow()"
          [data]="network"
          [config]="networkConfig().inline"
          [expandedConfig]="networkConfig().expanded"
        />
      }
    </div>
  `,
})
export class ClusterMetricsGridComponent {
  readonly history = inject(ClusterMetricsHistoryService);
  private readonly monitoring = inject(ClusterMonitoringService);
  private readonly autoscale = inject(ClusterAutoscaleService);

  private readonly thresholds = computed(() => this.autoscale.status()?.effectiveThresholds);

  readonly cpuConfig = computed(() =>
    this.percentConfig(this.thresholds()?.warnCpuPct ?? 70, this.thresholds()?.dangerCpuPct ?? 90),
  );
  readonly memoryConfig = computed(() =>
    this.percentConfig(
      this.thresholds()?.warnMemoryPct ?? 75,
      this.thresholds()?.dangerMemoryPct ?? 90,
    ),
  );
  readonly diskConfig = computed(() => this.percentConfig(80, 95));
  readonly networkConfig = computed<SizedConfig>(() => ({
    inline: this.sized(INLINE_HEIGHT, false, { valueFormatter: formatRate }),
    expanded: this.sized(EXPANDED_HEIGHT, true, { valueFormatter: formatRate }),
  }));

  readonly cpuNow = computed(() => formatPercent(this.average((s) => s.cpu.current)));
  readonly memoryNow = computed(() => formatPercent(this.average((s) => s.memory.current)));
  readonly diskNow = computed(() => formatPercent(this.average((s) => s.disk.current)));
  readonly networkNow = computed(() => {
    const servers = this.monitoring.servers();
    if (servers.length === 0) return '';
    return formatRate(servers.reduce((sum, s) => sum + s.network.bytesIn + s.network.bytesOut, 0));
  });

  private percentConfig(warning: number, danger: number): SizedConfig {
    const extra: TimeSeriesChartConfig = { unit: '%', thresholds: { warning, danger } };
    return {
      inline: this.sized(INLINE_HEIGHT, false, extra),
      expanded: this.sized(EXPANDED_HEIGHT, true, extra),
    };
  }

  private sized(
    height: string,
    expanded: boolean,
    extra: TimeSeriesChartConfig,
  ): TimeSeriesChartConfig {
    return {
      height,
      showGrid: true,
      showLegend: true,
      showTitle: false,
      enableZoom: expanded,
      animated: !expanded,
      ...extra,
    };
  }

  private average(pick: (server: ServerMetricsState) => number): number | null {
    const servers = this.monitoring.servers();
    if (servers.length === 0) return null;
    return servers.reduce((sum, s) => sum + pick(s), 0) / servers.length;
  }
}
