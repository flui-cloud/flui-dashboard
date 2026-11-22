import { Component, input, output } from '@angular/core';
import type { ReplicaMetricsDto } from '../../../core/api/model/replicaMetricsDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { formatBytes, formatCpu } from './app-monitoring-metrics';

@Component({
  selector: 'app-monitoring-replicas',
  imports: [FlPanel, FlTable, FlStatus, FlUsageBar],
  host: { class: 'block' },
  template: `
    <fl-panel title="Replicas breakdown" [count]="replicas().length" [flush]="true">
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Pod</th>
              <th scope="col">State</th>
              <th scope="col">CPU</th>
              <th scope="col">Memory</th>
              <th scope="col" class="is-num">Net in</th>
              <th scope="col" class="is-num">Net out</th>
              <th scope="col" class="is-num">Restarts</th>
              <th scope="col" class="is-num">Last hour</th>
            </tr>
          </thead>
          <tbody>
            @for (replica of replicas(); track replica.pod) {
              <tr [class.is-selected]="selected() === replica.pod">
                <td class="fl-cell-name">
                  <button
                    type="button"
                    class="fl-link fl-mono fl-cell-clip text-left"
                    [title]="replica.pod"
                    [attr.aria-pressed]="selected() === replica.pod"
                    (click)="replicaSelected.emit(replica.pod)"
                  >
                    {{ replica.pod }}
                  </button>
                </td>
                <td>
                  <fl-status [tone]="tone(replica)" [label]="replica.status.phase ?? 'Unknown'" />
                </td>
                <td>
                  <fl-usage-bar
                    [percent]="replica.cpu.utilization_percent ?? 0"
                    label="CPU"
                    [aside]="
                      formatCpu(replica.cpu.usage_cores ?? 0) +
                      ' of ' +
                      formatCpu(replica.cpu.limits_cores ?? 0)
                    "
                    [warnAt]="70"
                  />
                </td>
                <td>
                  <fl-usage-bar
                    [percent]="replica.memory.utilization_percent ?? 0"
                    label="Memory"
                    [aside]="
                      formatBytes(replica.memory.usage_bytes ?? 0) +
                      ' of ' +
                      formatBytes(replica.memory.limits_bytes ?? 0)
                    "
                    [warnAt]="75"
                  />
                </td>
                <td class="is-num">{{ formatBytes(replica.network.receive_bytes_rate ?? 0) }}/s</td>
                <td class="is-num">
                  {{ formatBytes(replica.network.transmit_bytes_rate ?? 0) }}/s
                </td>
                <td class="is-num">{{ replica.status.restart_total ?? 0 }}</td>
                <td class="is-num">{{ (replica.status.restart_rate_1h ?? 0).toFixed(1) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>
  `,
})
export class AppMonitoringReplicas {
  readonly replicas = input.required<readonly ReplicaMetricsDto[]>();
  readonly selected = input<string | null>(null);
  readonly replicaSelected = output<string>();

  protected readonly formatCpu = formatCpu;
  protected readonly formatBytes = formatBytes;

  protected tone(replica: ReplicaMetricsDto): StatusTone {
    return replica.status.ready === 1 ? 'success' : 'error';
  }
}
