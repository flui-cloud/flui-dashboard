import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import {
  ChartPanelComponent,
  TimeSeriesLineComponent,
  TimeSeriesChartConfig,
} from '../../../shared/components/charts';
import { ClusterMetricsHistoryService } from '../../service/cluster-metrics-history.service';
import { ClusterMonitoringService, ServerMetricsState } from '../../service/cluster-monitoring.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { formatPercent, formatRate } from '../../../shared/utils/metric-format';

/** One config object per size, held stable so a 5s poll never re-applies chart options. */
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
  standalone: true,
  imports: [ChartPanelComponent, TimeSeriesLineComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      @if (history.cpu(); as cpu) {
        <app-chart-panel
          title="CPU"
          [subtitle]="history.seriesSubtitle()"
          [value]="cpuNow()"
          [body]="cpuBody"
          [inlineHeight]="inlineHeight"
          [expandedHeight]="expandedHeight"
        >
          <ng-template #cpuBody let-mode>
            <app-time-series-line [data]="cpu" [config]="pick(cpuConfig(), mode)" />
          </ng-template>
        </app-chart-panel>
      }

      @if (history.memory(); as memory) {
        <app-chart-panel
          title="Memory"
          [subtitle]="history.seriesSubtitle()"
          [value]="memoryNow()"
          [body]="memoryBody"
          [inlineHeight]="inlineHeight"
          [expandedHeight]="expandedHeight"
        >
          <ng-template #memoryBody let-mode>
            <app-time-series-line [data]="memory" [config]="pick(memoryConfig(), mode)" />
          </ng-template>
        </app-chart-panel>
      }

      @if (history.disk(); as disk) {
        <app-chart-panel
          title="Disk"
          [subtitle]="history.seriesSubtitle()"
          [value]="diskNow()"
          [body]="diskBody"
          [inlineHeight]="inlineHeight"
          [expandedHeight]="expandedHeight"
        >
          <ng-template #diskBody let-mode>
            <app-time-series-line [data]="disk" [config]="pick(diskConfig(), mode)" />
          </ng-template>
        </app-chart-panel>
      }

      @if (history.network(); as network) {
        <app-chart-panel
          title="Network"
          subtitle="cluster total"
          [value]="networkNow()"
          [body]="networkBody"
          [inlineHeight]="inlineHeight"
          [expandedHeight]="expandedHeight"
        >
          <ng-template #networkBody let-mode>
            <app-time-series-line [data]="network" [config]="pick(networkConfig(), mode)" />
          </ng-template>
        </app-chart-panel>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class ClusterMetricsGridComponent {
  readonly history = inject(ClusterMetricsHistoryService);
  private readonly monitoring = inject(ClusterMonitoringService);
  private readonly autoscale = inject(ClusterAutoscaleService);

  readonly inlineHeight = INLINE_HEIGHT;
  readonly expandedHeight = EXPANDED_HEIGHT;

  private readonly thresholds = computed(() => this.autoscale.status()?.effectiveThresholds);

  readonly cpuConfig = computed(() =>
    this.percentConfig(this.thresholds()?.warnCpuPct ?? 70, this.thresholds()?.dangerCpuPct ?? 90)
  );
  readonly memoryConfig = computed(() =>
    this.percentConfig(this.thresholds()?.warnMemoryPct ?? 75, this.thresholds()?.dangerMemoryPct ?? 90)
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

  /** The template context is untyped, so the size is resolved here rather than indexed inline. */
  pick(config: SizedConfig, mode: string): TimeSeriesChartConfig {
    return mode === 'expanded' ? config.expanded : config.inline;
  }

  private percentConfig(warning: number, danger: number): SizedConfig {
    const extra: TimeSeriesChartConfig = { unit: '%', thresholds: { warning, danger } };
    return {
      inline: this.sized(INLINE_HEIGHT, false, extra),
      expanded: this.sized(EXPANDED_HEIGHT, true, extra),
    };
  }

  /**
   * Expanded charts open without the draw-in animation: the overlay already
   * costs a full-viewport repaint, and watching a line redraw is not what the
   * bigger size was opened for.
   */
  private sized(height: string, expanded: boolean, extra: TimeSeriesChartConfig): TimeSeriesChartConfig {
    return {
      height,
      showGrid: true,
      showLegend: true,
      // The panel header names the chart and shows its current value; drawing
      // the same words inside the plot said it twice and cost a line of height.
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
