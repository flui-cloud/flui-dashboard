import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MeterBarComponent, NODE_SERIES_COLORS } from '../../../shared/components/charts';
import { ClusterAppsMetricsService } from '../../service/cluster-apps-metrics.service';
import { formatBytes } from '../../../shared/utils/metric-format';

/**
 * What the cluster is actually running for. Ranked by CPU in use, so a node
 * sitting at the threshold leads straight to the workload that put it there.
 */
@Component({
  selector: 'app-cluster-apps-table',
  standalone: true,
  imports: [MeterBarComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="card-surface">
      <div class="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
        <h3 class="text-sm font-semibold text-foreground">What is using the cluster</h3>
        <a routerLink="/apps/applications" class="text-[11px] font-semibold text-primary hover:underline">
          All applications →
        </a>
      </div>

      @if (apps().length === 0) {
        <p class="px-5 pb-5 text-sm text-sub">
          {{ service.error() ?? 'No application on this cluster reports usage yet.' }}
        </p>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-left">
            <thead>
              <tr class="text-[10px] font-semibold uppercase tracking-wider text-sub">
                <th scope="col" class="px-5 pb-2 font-semibold">Application</th>
                <th scope="col" class="px-3 pb-2 font-semibold w-[200px]">CPU</th>
                <th scope="col" class="px-3 pb-2 font-semibold w-[200px]">Memory</th>
                <th scope="col" class="px-3 pb-2 font-semibold">Replicas</th>
                <th scope="col" class="px-5 pb-2 font-semibold">Restarts 1h</th>
              </tr>
            </thead>
            <tbody>
              @for (app of apps(); track app.appId) {
                <tr class="border-t border-border align-middle">
                  <td class="px-5 py-3">
                    <div class="flex flex-col min-w-0">
                      <span class="text-sm font-medium text-foreground truncate">{{ app.name }}</span>
                      <span class="text-[10px] text-sub truncate">{{ app.namespace }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-3">
                    <app-meter-bar
                      [value]="app.cpuPercent ?? 0"
                      [label]="cores(app.cpuCores)"
                      [caption]="share(app.cpuPercent)"
                      [color]="meterColor"
                    />
                  </td>
                  <td class="px-3 py-3">
                    <app-meter-bar
                      [value]="app.memoryPercent ?? 0"
                      [label]="bytes(app.memoryBytes)"
                      [caption]="share(app.memoryPercent)"
                      [color]="meterColor"
                    />
                  </td>
                  <td class="px-3 py-3 font-mono text-xs" [class]="app.replicasDegraded ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'">
                    {{ app.replicas }}
                  </td>
                  <td class="px-5 py-3 font-mono text-xs" [class]="app.restarts > 2 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'">
                    {{ app.restarts }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class ClusterAppsTableComponent {
  readonly service = inject(ClusterAppsMetricsService);
  readonly apps = computed(() => this.service.topConsumers());

  /** One hue, as in the nodes table: the palette means node identity elsewhere. */
  readonly meterColor = NODE_SERIES_COLORS[0];

  cores(value: number | null): string {
    return value == null ? '—' : `${value.toFixed(2)} cores`;
  }

  bytes(value: number | null): string {
    return formatBytes(value);
  }

  /** Utilisation against the app's own limit — blank when no limit is declared. */
  share(percent: number | null): string {
    return percent == null ? 'no limit set' : `${percent.toFixed(0)}% of limit`;
  }
}
