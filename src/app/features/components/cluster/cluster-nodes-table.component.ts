import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { MeterBarComponent, NODE_SERIES_COLORS } from '../../../shared/components/charts';
import { ClusterMonitoringService, ServerMetricsState } from '../../service/cluster-monitoring.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { formatBytes, formatPercent, formatRate, formatUptime } from '../../../shared/utils/metric-format';

interface NodeRow {
  state: ServerMetricsState;
  /** The swatch tying this row to its line in the charts — absent once the charts stop drawing one line per node. */
  color: string | null;
  cpuCaption: string;
  memoryCaption: string;
  diskCaption: string;
  load: string;
  network: string;
  uptime: string;
}

/**
 * One row per node, with the three saturating resources as tracks rather than
 * gauges: the same readings in a fifth of the height, and with room for the
 * autoscaling thresholds drawn on the track itself.
 */
@Component({
  selector: 'app-cluster-nodes-table',
  standalone: true,
  imports: [MeterBarComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="card-surface">
      <div class="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
        <h3 class="text-sm font-semibold text-foreground">Nodes</h3>
        <span class="text-[11px] text-sub">{{ summary() }}</span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[880px] text-left">
          <thead>
            <tr class="text-[10px] font-semibold uppercase tracking-wider text-sub">
              <th scope="col" class="px-5 pb-2 font-semibold">Node</th>
              <th scope="col" class="px-3 pb-2 font-semibold w-[168px]">CPU</th>
              <th scope="col" class="px-3 pb-2 font-semibold w-[168px]">Memory</th>
              <th scope="col" class="px-3 pb-2 font-semibold w-[168px]">Disk</th>
              <th scope="col" class="px-3 pb-2 font-semibold">Load 1 / 5 / 15</th>
              <th scope="col" class="px-3 pb-2 font-semibold">Network in / out</th>
              <th scope="col" class="px-5 pb-2 font-semibold">Uptime</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.state.serverId) {
              <tr class="border-t border-border align-middle">
                <td class="px-5 py-3">
                  <div class="flex items-center gap-2.5">
                    @if (row.color) {
                      <span class="h-2 w-2 rounded-sm shrink-0" [style.background-color]="row.color"></span>
                    }
                    <div class="flex flex-col min-w-0">
                      <span class="text-sm font-medium text-foreground truncate">{{ row.state.serverId }}</span>
                      <span class="text-[10px] text-sub truncate">{{ row.state.instance }}</span>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-3">
                  <app-meter-bar
                    [value]="row.state.cpu.current"
                    [label]="percent(row.state.cpu.current)"
                    [caption]="row.cpuCaption"
                    [color]="meterColor"
                    [config]="{ warning: warnCpu(), danger: dangerCpu() }"
                  />
                </td>
                <td class="px-3 py-3">
                  <app-meter-bar
                    [value]="row.state.memory.current"
                    [label]="percent(row.state.memory.current)"
                    [caption]="row.memoryCaption"
                    [color]="meterColor"
                    [config]="{ warning: warnMemory(), danger: dangerMemory() }"
                  />
                </td>
                <td class="px-3 py-3">
                  <app-meter-bar
                    [value]="row.state.disk.current"
                    [label]="percent(row.state.disk.current)"
                    [caption]="row.diskCaption"
                    [color]="meterColor"
                    [config]="{ warning: 80, danger: 95 }"
                  />
                </td>
                <td class="px-3 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{{ row.load }}</td>
                <td class="px-3 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{{ row.network }}</td>
                <td class="px-5 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{{ row.uptime }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class ClusterNodesTableComponent {
  private readonly monitoring = inject(ClusterMonitoringService);
  private readonly autoscale = inject(ClusterAutoscaleService);

  private readonly thresholds = computed(() => this.autoscale.status()?.effectiveThresholds);
  readonly warnCpu = computed(() => this.thresholds()?.warnCpuPct ?? 70);
  readonly dangerCpu = computed(() => this.thresholds()?.dangerCpuPct ?? 90);
  readonly warnMemory = computed(() => this.thresholds()?.warnMemoryPct ?? 75);
  readonly dangerMemory = computed(() => this.thresholds()?.dangerMemoryPct ?? 90);

  readonly rows = computed<NodeRow[]>(() =>
    this.monitoring.servers().map((state, index) => ({
      state,
      color: this.swatch(index),
      cpuCaption: state.cpu.cores ? `${state.cpu.cores} vCPU` : '',
      memoryCaption: `${formatBytes(state.memory.used)} / ${formatBytes(state.memory.total)}`,
      diskCaption: `${formatBytes(state.disk.used)} / ${formatBytes(state.disk.total)}`,
      load: state.load
        ? `${state.load.one.toFixed(2)}  ${state.load.five.toFixed(2)}  ${state.load.fifteen.toFixed(2)}`
        : '—',
      network: `${formatRate(state.network.bytesIn)} / ${formatRate(state.network.bytesOut)}`,
      uptime: formatUptime(state.uptimeSeconds),
    }))
  );

  readonly summary = computed(() => {
    const servers = this.monitoring.servers();
    if (servers.length === 0) return '';
    const cores = servers.reduce((sum, s) => sum + (s.cpu.cores ?? 0), 0);
    const memory = servers.reduce((sum, s) => sum + s.memory.total, 0);
    const disk = servers.reduce((sum, s) => sum + s.disk.total, 0);
    const nodes = `${servers.length} ${servers.length === 1 ? 'node' : 'nodes'}`;
    return `${nodes} · ${cores} vCPU · ${formatBytes(memory)} · ${formatBytes(disk)} disk`;
  });

  /**
   * One hue for every meter. The series palette means "which node" in the
   * charts, so spending it per metric here made memory teal in one place and
   * blue in the other; the thresholds carry the state, not the colour.
   */
  readonly meterColor = NODE_SERIES_COLORS[0];

  seriesColor(index: number): string {
    return NODE_SERIES_COLORS[index];
  }

  /** Only rows the charts actually name get a swatch; a recycled colour would lie. */
  private swatch(index: number): string | null {
    return index < NODE_SERIES_COLORS.length ? NODE_SERIES_COLORS[index] : null;
  }

  percent(value: number): string {
    return formatPercent(value);
  }
}
