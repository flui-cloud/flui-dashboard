import { Component, computed, inject } from '@angular/core';
import {
  ClusterMonitoringService,
  ServerMetricsState,
} from '../../service/cluster-monitoring.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { formatBytes, formatRate, formatUptime } from '../../../shared/utils/metric-format';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';

interface NodeRow {
  state: ServerMetricsState;
  cpuCaption: string;
  memoryCaption: string;
  diskCaption: string;
  load: string;
  network: string;
  uptime: string;
}

@Component({
  selector: 'app-cluster-nodes-table',
  imports: [FlPanel, FlTable, FlUsageBar],
  host: { class: 'block' },
  template: `
    <fl-panel title="Nodes" [count]="rows().length || null" [flush]="true">
      <span panelActions class="text-fl-caption text-fl-ink-muted">{{ summary() }}</span>
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Node</th>
              <th scope="col">CPU</th>
              <th scope="col">Memory</th>
              <th scope="col">Disk</th>
              <th scope="col" class="is-num">Load 1 / 5 / 15</th>
              <th scope="col" class="is-num">Network in / out</th>
              <th scope="col" class="is-num">Uptime</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.state.serverId) {
              <tr>
                <td>
                  <span class="fl-mono block">{{ row.state.serverId }}</span>
                  <span class="fl-mono block text-fl-caption text-fl-ink-muted">{{
                    row.state.instance
                  }}</span>
                </td>
                <td>
                  <fl-usage-bar
                    [percent]="row.state.cpu.current"
                    [label]="'CPU in use on ' + row.state.serverId"
                    [aside]="row.cpuCaption"
                    [warnAt]="warnCpu()"
                    [criticalAt]="dangerCpu()"
                  />
                </td>
                <td>
                  <fl-usage-bar
                    [percent]="row.state.memory.current"
                    [label]="'Memory in use on ' + row.state.serverId"
                    [aside]="row.memoryCaption"
                    [warnAt]="warnMemory()"
                    [criticalAt]="dangerMemory()"
                  />
                </td>
                <td>
                  <fl-usage-bar
                    [percent]="row.state.disk.current"
                    [label]="'Disk in use on ' + row.state.serverId"
                    [aside]="row.diskCaption"
                    [warnAt]="80"
                    [criticalAt]="95"
                  />
                </td>
                <td class="is-num fl-mono">{{ row.load }}</td>
                <td class="is-num fl-mono">{{ row.network }}</td>
                <td class="is-num fl-mono">{{ row.uptime }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>
  `,
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
    this.monitoring.servers().map((state) => ({
      state,
      cpuCaption: state.cpu.cores ? `${state.cpu.cores} vCPU` : '',
      memoryCaption: `${formatBytes(state.memory.used)} / ${formatBytes(state.memory.total)}`,
      diskCaption: `${formatBytes(state.disk.used)} / ${formatBytes(state.disk.total)}`,
      load: state.load
        ? `${state.load.one.toFixed(2)}  ${state.load.five.toFixed(2)}  ${state.load.fifteen.toFixed(2)}`
        : '—',
      network: `${formatRate(state.network.bytesIn)} / ${formatRate(state.network.bytesOut)}`,
      uptime: formatUptime(state.uptimeSeconds),
    })),
  );

  readonly summary = computed(() => {
    const servers = this.monitoring.servers();
    if (servers.length === 0) return '';
    const cores = servers.reduce((sum, s) => sum + (s.cpu.cores ?? 0), 0);
    const memory = servers.reduce((sum, s) => sum + s.memory.total, 0);
    const disk = servers.reduce((sum, s) => sum + s.disk.total, 0);
    return `${cores} vCPU · ${formatBytes(memory)} memory · ${formatBytes(disk)} disk`;
  });
}
