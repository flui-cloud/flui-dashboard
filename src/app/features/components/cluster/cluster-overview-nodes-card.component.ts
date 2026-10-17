import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideServer } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { ClusterMonitoringService } from '../../service/cluster-monitoring.service';
import { ArchitectureBadgeComponent } from '../../../shared/components/architecture-badge.component';
import { OVERVIEW_NODE_LIMIT, buildOverviewNodeRows, meterBarClass } from './cluster-overview-nodes';

@Component({
  selector: 'app-cluster-overview-nodes-card',
  host: { class: 'block' },
  standalone: true,
  imports: [RouterModule, NgIconComponent, NgTemplateOutlet, ArchitectureBadgeComponent],
  providers: [provideIcons({ lucideArrowRight, lucideServer })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="card-surface p-4" data-testid="cluster-overview-nodes">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5 text-label">
            <ng-icon name="lucideServer" class="h-3.5 w-3.5" />
            Nodes
          </div>
          <span class="text-sm font-bold text-foreground tabular-nums">{{ total() }}</span>
          @if (cluster()?.autoScalingEnabled) {
            <span class="hidden sm:inline text-sub">· Auto-scale {{ cluster()?.minNodes }}–{{ cluster()?.maxNodes }}</span>
          }
        </div>
        <a [routerLink]="['../nodes']" class="flex items-center gap-1 text-xs text-primary hover:underline">
          View all nodes <ng-icon name="lucideArrowRight" class="h-3 w-3" />
        </a>
      </div>

      @if (clusterService.nodesIsLoading() && rows().length === 0) {
        <div class="space-y-1.5">
          @for (i of [1, 2, 3]; track i) {
            <div class="skeleton h-9"></div>
          }
        </div>
      } @else if (rows().length === 0) {
        <p class="text-sub">No nodes loaded</p>
      } @else {
        <div class="hidden sm:grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_7.5rem_7.5rem_6.5rem] gap-x-4 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sub">
          <span>Node</span>
          <span>Type · Location</span>
          <span>CPU</span>
          <span>Memory</span>
          <span class="text-right">Status</span>
        </div>
        <div class="space-y-1">
          @for (row of rows(); track row.id) {
            @if (row.link) {
              <a [routerLink]="row.link" class="block card-inner hover:bg-muted transition-colors">
                <ng-container *ngTemplateOutlet="rowBody; context: { $implicit: row }" />
              </a>
            } @else {
              <div class="card-inner">
                <ng-container *ngTemplateOutlet="rowBody; context: { $implicit: row }" />
              </div>
            }
          }
        </div>
        @if (hiddenCount() > 0) {
          <a [routerLink]="['../nodes']" class="card-link">
            +{{ hiddenCount() }} more <ng-icon name="lucideArrowRight" class="h-3 w-3" />
          </a>
        }
      }
    </div>

    <ng-template #rowBody let-row>
      <div class="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_7.5rem_7.5rem_6.5rem] items-center gap-x-4 gap-y-0.5 px-2 py-1.5 text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <span class="h-1.5 w-1.5 rounded-full flex-shrink-0" [class]="row.dot"></span>
          <span class="text-value truncate" [title]="row.name">{{ row.name }}</span>
          @if (row.role) {
            <span class="flex-shrink-0 rounded border border-border px-1.5 py-px text-[10px] uppercase tracking-wide text-muted-foreground">{{ row.role }}</span>
          }
          <app-architecture-badge class="flex-shrink-0" [architecture]="row.architecture" />
        </div>
        <div class="hidden sm:block text-sub truncate">{{ meta(row.serverType, row.location) }}</div>
        <div class="hidden sm:block">
          <ng-container *ngTemplateOutlet="meter; context: { $implicit: row.cpu, warn: 70, danger: 90 }" />
        </div>
        <div class="hidden sm:block">
          <ng-container *ngTemplateOutlet="meter; context: { $implicit: row.memory, warn: 75, danger: 90 }" />
        </div>
        <div class="text-right truncate capitalize" [class]="row.failed ? 'text-red-600 dark:text-red-400' : 'text-sub'">
          {{ row.statusLabel ?? '—' }}
        </div>
        <div class="col-span-2 sm:hidden pl-3.5 text-sub truncate">{{ meta(row.serverType, row.location) }}</div>
      </div>
    </ng-template>

    <ng-template #meter let-value let-warn="warn" let-danger="danger">
      @if (value === null) {
        <span class="text-sub">—</span>
      } @else {
        <div class="flex items-center gap-2">
          <div class="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div class="h-full rounded-full" [class]="barClass(value, warn, danger)" [style.width.%]="value"></div>
          </div>
          <span class="w-8 text-right tabular-nums text-foreground">{{ value.toFixed(0) }}%</span>
        </div>
      }
    </ng-template>
  `,
})
export class ClusterOverviewNodesCardComponent {
  readonly clusterService = inject(ClusterService);
  private readonly monitoring = inject(ClusterMonitoringService);

  readonly cluster = this.clusterService.cluster;
  readonly rows = computed(() => buildOverviewNodeRows(this.clusterService.nodes(), this.monitoring.servers()));
  readonly total = computed(() => this.clusterService.nodes().length || this.cluster()?.nodeCount || 0);
  readonly hiddenCount = computed(() => Math.max(0, this.clusterService.nodes().length - OVERVIEW_NODE_LIMIT));

  meta(serverType: string | null, location: string | null): string {
    return [serverType, location].filter(Boolean).join(' · ') || '—';
  }

  barClass(value: number, warn: number, danger: number): string {
    return meterBarClass(value, warn, danger);
  }
}
