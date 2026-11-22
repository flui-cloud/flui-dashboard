import { Component, computed, inject } from '@angular/core';
import { ClusterMonitoringService } from '../../service/cluster-monitoring.service';
import { ClusterMetricsHistoryService } from '../../service/cluster-metrics-history.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { formatBytes, formatDelta, formatRate } from '../../../shared/utils/metric-format';
import { FlMetric, FlMetricStrip } from '../../../ui/patterns/metric-strip';

const points = (value: number) => `${value.toFixed(1)}%`;

interface ClusterHeadline {
  readonly label: string;
  readonly value: string;
  readonly caption: string;
  readonly hint: string | null;
}

/**
 * The five figures that give the pulse of a cluster before any chart is read:
 * the three saturating resources, the load the nodes actually carry, and the
 * traffic crossing them.
 */
@Component({
  selector: 'app-cluster-metrics-summary',
  imports: [FlMetricStrip, FlMetric],
  host: { class: 'block' },
  template: `
    <fl-metric-strip data-testid="cluster-metrics-summary">
      @for (tile of tiles(); track tile.label) {
        <fl-metric
          [attr.title]="tile.hint"
          [label]="tile.label"
          [value]="tile.value"
          [caption]="tile.caption"
        />
      }
    </fl-metric-strip>
  `,
})
export class ClusterMetricsSummaryComponent {
  private readonly monitoring = inject(ClusterMonitoringService);
  private readonly history = inject(ClusterMetricsHistoryService);
  private readonly autoscale = inject(ClusterAutoscaleService);

  private readonly servers = this.monitoring.servers;

  readonly tiles = computed<ClusterHeadline[]>(() => {
    const servers = this.servers();
    if (servers.length === 0) return [];

    const trends = this.history.averages();
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
        label: 'Average CPU',
        value: cpu.toFixed(1),
        unit: '%',
        spark: trends.cpu,
        footnote: `Threshold ${thresholds?.warnCpuPct ?? 70}%`,
        current: fresh ? cpu : null,
        formatChange: points,
      }),
      this.tile({
        label: 'Average memory',
        value: memory.toFixed(1),
        unit: '%',
        spark: trends.memory,
        footnote: this.usedOfTotal(servers.map((s) => [s.memory.used, s.memory.total])),
        current: fresh ? memory : null,
        formatChange: points,
      }),
      this.tile({
        label: 'Average disk',
        value: disk.toFixed(1),
        unit: '%',
        spark: trends.disk,
        footnote: this.usedOfTotal(servers.map((s) => [s.disk.used, s.disk.total])),
        current: fresh ? disk : null,
        formatChange: points,
      }),
      this.tile({
        label: 'Load per core',
        value: loadCores ? (runQueue / loadCores).toFixed(2) : '—',
        spark: [],
        footnote: loadCores
          ? `${runQueue.toFixed(2)} run queue · ${loadCores} cores`
          : 'Not reported',
        current: null,
      }),
      this.tile({
        label: 'Network',
        value: formatRate(network),
        spark: trends.network,
        footnote: `${formatRate(netIn)} in · ${formatRate(netOut)} out`,
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
    footnote: string;
    current: number | null;
    formatChange?: (value: number) => string;
  }): ClusterHeadline {
    const value = `${spec.value}${spec.unit ?? ''}`;
    if (spec.current == null) {
      return { label: spec.label, value, caption: spec.footnote, hint: null };
    }
    const delta = formatDelta(spec.current, spec.spark, spec.formatChange);
    if (!delta.text) return { label: spec.label, value, caption: spec.footnote, hint: null };
    return {
      label: spec.label,
      value,
      caption: `${spec.footnote} · ${delta.text}`,
      hint: `${delta.text} vs the typical value over the ${this.history.rangeLabel()}`,
    };
  }

  private usedOfTotal(pairs: [number, number][]): string {
    const used = pairs.reduce((sum, [u]) => sum + u, 0);
    const total = pairs.reduce((sum, [, t]) => sum + t, 0);
    return total ? `${formatBytes(used)} / ${formatBytes(total)}` : '—';
  }
}
