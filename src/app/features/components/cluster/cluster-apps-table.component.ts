import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClusterAppsMetricsService } from '../../service/cluster-apps-metrics.service';
import { formatBytes } from '../../../shared/utils/metric-format';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlStatus } from '../../../ui/primitives/status';

/**
 * What the cluster is actually running for. Ranked by CPU in use, so a node
 * sitting at the threshold leads straight to the workload that put it there.
 */
@Component({
  selector: 'app-cluster-apps-table',
  imports: [RouterLink, FlPanel, FlTable, FlUsageBar, FlStatus, FlEmptyState, FlAlert],
  host: { class: 'block' },
  template: `
    <fl-panel
      title="What is using the cluster"
      [count]="apps().length || null"
      [flush]="apps().length > 0"
      data-testid="cluster-apps-table"
    >
      <a panelActions routerLink="/apps/applications" class="fl-link text-fl-body-sm"
        >All applications</a
      >

      @if (apps().length === 0) {
        @if (service.error(); as error) {
          <fl-alert tone="warning" title="Usage could not be read">{{ error }}</fl-alert>
        } @else {
          <fl-empty-state
            [compact]="true"
            title="No usage reported yet"
            body="No application on this cluster reports usage yet."
          />
        }
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Application</th>
                <th scope="col">CPU</th>
                <th scope="col">Memory</th>
                <th scope="col" class="is-num">Replicas</th>
                <th scope="col" class="is-num">Restarts 1h</th>
              </tr>
            </thead>
            <tbody>
              @for (app of apps(); track app.appId) {
                <tr>
                  <td class="fl-cell-name">
                    <div class="flex min-w-0 flex-col">
                      <span class="truncate">{{ app.name }}</span>
                      <span class="fl-mono truncate text-fl-ink-muted">{{ app.namespace }}</span>
                    </div>
                  </td>
                  <td>
                    @if (app.cpuPercent === null) {
                      <span class="flex flex-col">
                        <span class="fl-num">{{ cores(app.cpuCores) }}</span>
                        <span class="text-fl-caption text-fl-ink-muted">No limit set</span>
                      </span>
                    } @else {
                      <fl-usage-bar
                        [percent]="app.cpuPercent"
                        [label]="app.name + ' CPU of its limit'"
                        [aside]="cores(app.cpuCores)"
                      />
                    }
                  </td>
                  <td>
                    @if (app.memoryPercent === null) {
                      <span class="flex flex-col">
                        <span class="fl-num">{{ bytes(app.memoryBytes) }}</span>
                        <span class="text-fl-caption text-fl-ink-muted">No limit set</span>
                      </span>
                    } @else {
                      <fl-usage-bar
                        [percent]="app.memoryPercent"
                        [label]="app.name + ' memory of its limit'"
                        [aside]="bytes(app.memoryBytes)"
                      />
                    }
                  </td>
                  <td class="is-num">
                    @if (app.replicasDegraded) {
                      <fl-status tone="warning" [label]="app.replicas" />
                    } @else {
                      <span class="fl-mono">{{ app.replicas }}</span>
                    }
                  </td>
                  <td class="is-num">
                    @if (app.restarts > 2) {
                      <fl-status tone="warning" [label]="'' + app.restarts" />
                    } @else {
                      <span class="fl-mono">{{ app.restarts }}</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class ClusterAppsTableComponent {
  readonly service = inject(ClusterAppsMetricsService);
  readonly apps = computed(() => this.service.topConsumers());

  cores(value: number | null): string {
    return value == null ? '—' : `${value.toFixed(2)} cores`;
  }

  bytes(value: number | null): string {
    return formatBytes(value);
  }
}
