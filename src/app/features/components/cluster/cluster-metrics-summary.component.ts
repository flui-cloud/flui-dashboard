import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { StatTileComponent, StatTileData, NODE_SERIES_COLORS } from '../../../shared/components/charts';
import { ClusterMonitoringService } from '../../service/cluster-monitoring.service';
import { ClusterMetricsHistoryService } from '../../service/cluster-metrics-history.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { formatBytes, formatDelta, formatRate } from '../../../shared/utils/metric-format';

/** A change in a percentage reading wears the same sign as the reading above it. */
const points = (value: number) => `${value.toFixed(1)}%`;

/**
 * The five figures that give the pulse of a cluster before any chart is read:
 * the three saturating resources, the load the nodes actually carry, and the
 * traffic crossing them.
 */
@Component({
  selector: 'app-cluster-metrics-summary',
  standalone: true,
  imports: [StatTileComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      @for (tile of tiles(); track tile.label) {
        <app-stat-tile [data]="tile" [sparkWidth]="112" />
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class ClusterMetricsSummaryComponent {
  private readonly monitoring = inject(ClusterMonitoringService);
  private readonly history = inject(ClusterMetricsHistoryService);
  private readonly autoscale = inject(ClusterAutoscaleService);

  private readonly servers = this.monitoring.servers;

  readonly tiles = computed<StatTileData[]>(() => {
    const servers = this.servers();
    if (servers.length === 0) return [];

    const trends = this.history.averages();
    // A delta is only offered while the stored window still reaches the present;
    // otherwise it would compare a live reading against a window that stopped.
    const fresh = this.history.isFresh();
    const avg = (pick: (s: (typeof servers)[number]) => number) =>
      servers.reduce((sum, s) => sum + pick(s), 0) / servers.length;

    const cpu = avg((s) => s.cpu.current);
    const memory = avg((s) => s.memory.current);
    const disk = avg((s) => s.disk.current);
    const netIn = servers.reduce((sum, s) => sum + s.network.bytesIn, 0);
    const netOut = servers.reduce((sum, s) => sum + s.network.bytesOut, 0);
    const network = netIn + netOut;

    const reportingLoad = servers.filter((s) => s.load != null);
    const runQueue = reportingLoad.reduce((sum, s) => sum + (s.load?.one ?? 0), 0);
    const loadCores = reportingLoad.reduce((sum, s) => sum + (s.cpu.cores ?? 0), 0);
    const thresholds = this.autoscale.status()?.effectiveThresholds;

    return [
      this.tile({
        label: 'Avg CPU',
        value: cpu.toFixed(1),
        unit: '%',
        spark: trends.cpu,
        color: NODE_SERIES_COLORS[0],
        footnote: `threshold ${thresholds?.warnCpuPct ?? 70}%`,
        current: fresh ? cpu : null,
        formatChange: points,
      }),
      this.tile({
        label: 'Avg memory',
        value: memory.toFixed(1),
        unit: '%',
        spark: trends.memory,
        color: NODE_SERIES_COLORS[1],
        footnote: this.usedOfTotal(servers.map((s) => [s.memory.used, s.memory.total])),
        current: fresh ? memory : null,
        formatChange: points,
      }),
      this.tile({
        label: 'Avg disk',
        value: disk.toFixed(1),
        unit: '%',
        spark: trends.disk,
        color: NODE_SERIES_COLORS[2],
        footnote: this.usedOfTotal(servers.map((s) => [s.disk.used, s.disk.total])),
        current: fresh ? disk : null,
        formatChange: points,
      }),
      this.tile({
        label: 'Load per core',
        value: loadCores ? (runQueue / loadCores).toFixed(2) : '\u2014',
        spark: [],
        color: NODE_SERIES_COLORS[3],
        footnote: loadCores ? `${runQueue.toFixed(2)} run queue \u00b7 ${loadCores} cores` : 'not reported',
        current: null,
      }),
      this.tile({
        label: 'Network',
        value: formatRate(network),
        spark: trends.network,
        color: NODE_SERIES_COLORS[0],
        footnote: `${formatRate(netIn)} in \u00b7 ${formatRate(netOut)} out`,
        current: fresh ? network : null,
        formatChange: formatRate,
      }),
    ];
  });

  private tile(spec: {
    label: string;
    value: string;
    unit?: string;
    spark: number[];
    color: string;
    footnote: string;
    /** The live reading behind `value`, or null when there is nothing current to compare. */
    current: number | null;
    formatChange?: (value: number) => string;
  }): StatTileData {
    const base: StatTileData = {
      label: spec.label,
      value: spec.value,
      unit: spec.unit ?? '',
      spark: spec.spark,
      color: spec.color,
      footnote: spec.footnote,
    };
    if (spec.current == null) return base;

    const delta = formatDelta(spec.current, spec.spark, spec.formatChange);
    return {
      ...base,
      delta: delta.text,
      deltaTone: delta.tone,
      deltaHint: `vs the typical value over the ${this.history.rangeLabel()}`,
    };
  }

  private usedOfTotal(pairs: [number, number][]): string {
    const used = pairs.reduce((sum, [u]) => sum + u, 0);
    const total = pairs.reduce((sum, [, t]) => sum + t, 0);
    return total ? `${formatBytes(used)} / ${formatBytes(total)}` : '—';
  }
}
