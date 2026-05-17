import { Component, inject, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCpu,
  lucideMemoryStick,
  lucideHardDrive,
  lucideChevronLeft,
  lucideChevronRight,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { DashboardMetricsService, ClusterMetricsSummary, getSeverity } from '../../service/dashboard-metrics.service';
import { DashboardService } from '../../service/dashboard.service';

const PAGE_SIZE = 3;

type Severity = 'success' | 'warning' | 'danger';

const BAR_CLASS: Record<Severity, string> = {
  success: 'bg-green-500 dark:bg-green-400',
  warning: 'bg-yellow-500 dark:bg-yellow-400',
  danger:  'bg-red-500 dark:bg-red-400',
};

const TEXT_CLASS: Record<Severity, string> = {
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  danger:  'text-red-600 dark:text-red-400',
};

@Component({
  selector: 'app-dashboard-resources',
  standalone: true,
  imports: [NgIconComponent, DecimalPipe, RouterLink],
  providers: [
    provideIcons({
      lucideCpu,
      lucideMemoryStick,
      lucideHardDrive,
      lucideChevronLeft,
      lucideChevronRight,
      lucideRefreshCw,
    }),
  ],
  template: `
    @if (hasActiveClusters()) {
      <div class="bg-card border border-border rounded-lg px-4 py-2.5">

        @if (isLoading()) {
          <!-- Skeleton: single compact row -->
          <div class="flex items-center gap-3">
            <div class="h-3 w-20 rounded bg-muted animate-pulse flex-shrink-0"></div>
            <div class="flex-1 flex gap-4">
              @for (__ of [1,2,3]; track __) {
                <div class="flex-1 flex items-center gap-2">
                  <div class="h-2 w-6 rounded bg-muted animate-pulse"></div>
                  <div class="flex-1 h-1.5 rounded-full bg-muted animate-pulse"></div>
                  <div class="h-2 w-7 rounded bg-muted animate-pulse"></div>
                </div>
              }
            </div>
          </div>
        } @else if (hasData()) {

          <!-- One compact row per cluster, all on same horizontal band -->
          <div class="flex flex-col gap-0">
            @for (c of visibleClusters(); track c.clusterId) {
              <div class="flex items-center gap-3 py-1.5 first:pt-0 last:pb-0">

                <!-- Cluster name + nodes -->
                <div class="flex items-center gap-1.5 w-32 flex-shrink-0 min-w-0">
                  <a
                    [routerLink]="['/cluster', c.clusterId]"
                    class="text-xs font-medium text-foreground truncate
                           hover:text-primary hover:underline transition-colors"
                    [title]="c.clusterName"
                  >{{ c.clusterName }}</a>
                  <span class="text-[10px] text-muted-foreground flex-shrink-0">·{{ c.nodes }}n</span>
                </div>

                <!-- CPU -->
                <div class="flex items-center gap-1 flex-1 min-w-0">
                  <span class="text-[10px] text-muted-foreground w-5 flex-shrink-0">CPU</span>
                  <div class="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-700"
                         [class]="bar(c.cpu, 70, 90)"
                         [style.width.%]="c.cpu"></div>
                  </div>
                  <span class="text-[10px] font-medium w-8 text-right flex-shrink-0"
                        [class]="text(c.cpu, 70, 90)">{{ c.cpu | number:'1.0-1' }}%</span>
                </div>

                <!-- Memory -->
                <div class="flex items-center gap-1 flex-1 min-w-0">
                  <span class="text-[10px] text-muted-foreground w-5 flex-shrink-0">MEM</span>
                  <div class="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-700"
                         [class]="bar(c.memory, 75, 90)"
                         [style.width.%]="c.memory"></div>
                  </div>
                  <span class="text-[10px] font-medium w-8 text-right flex-shrink-0"
                        [class]="text(c.memory, 75, 90)">{{ c.memory | number:'1.0-1' }}%</span>
                </div>

                <!-- Disk -->
                <div class="flex items-center gap-1 flex-1 min-w-0">
                  <span class="text-[10px] text-muted-foreground w-5 flex-shrink-0">DSK</span>
                  <div class="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-700"
                         [class]="bar(c.disk, 80, 95)"
                         [style.width.%]="c.disk"></div>
                  </div>
                  <span class="text-[10px] font-medium w-8 text-right flex-shrink-0"
                        [class]="text(c.disk, 80, 95)">{{ c.disk | number:'1.0-1' }}%</span>
                </div>

                <!-- Pagination + refresh (only on last row) -->
                @if ($last) {
                  <div class="flex items-center gap-0.5 flex-shrink-0 ml-1">
                    @if (totalPages() > 1) {
                      <button
                        class="h-5 w-5 flex items-center justify-center rounded text-muted-foreground
                               hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        [disabled]="currentPage() === 0"
                        (click)="prev()"
                      ><ng-icon name="lucideChevronLeft" class="h-3 w-3" /></button>
                      <span class="text-[10px] text-muted-foreground px-0.5">
                        {{ currentPage() + 1 }}/{{ totalPages() }}
                      </span>
                      <button
                        class="h-5 w-5 flex items-center justify-center rounded text-muted-foreground
                               hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        [disabled]="currentPage() === totalPages() - 1"
                        (click)="next()"
                      ><ng-icon name="lucideChevronRight" class="h-3 w-3" /></button>
                    }
                    <button
                      class="h-5 w-5 flex items-center justify-center rounded text-muted-foreground
                             hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      [disabled]="isLoading()"
                      (click)="refresh()"
                      title="Refresh metrics"
                    >
                      <ng-icon name="lucideRefreshCw" class="h-3 w-3"
                               [class.animate-spin]="isLoading()" />
                    </button>
                  </div>
                } @else {
                  <div class="w-6 flex-shrink-0"></div>
                }

              </div>
            }
          </div>

        }
      </div>
    }
  `,
})
export class DashboardResourcesComponent {
  private readonly metricsService = inject(DashboardMetricsService);
  private readonly dashboardService = inject(DashboardService);

  allClusters = this.metricsService.clusterMetrics;
  isLoading = this.metricsService.isLoading;
  hasData = this.metricsService.hasData;
  hasActiveClusters = computed(() => this.dashboardService.activeClusters() > 0);

  currentPage = signal(0);
  totalPages = computed(() => Math.ceil(this.allClusters().length / PAGE_SIZE));

  visibleClusters = computed<ClusterMetricsSummary[]>(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.allClusters().slice(start, start + PAGE_SIZE);
  });

  prev(): void {
    this.currentPage.update((p) => Math.max(0, p - 1));
  }

  next(): void {
    this.currentPage.update((p) => Math.min(this.totalPages() - 1, p + 1));
  }

  async refresh(): Promise<void> {
    await this.metricsService.loadMetrics();
    this.currentPage.set(0);
  }

  bar(value: number, warn: number, danger: number): string {
    return BAR_CLASS[getSeverity(value, warn, danger)];
  }

  text(value: number, warn: number, danger: number): string {
    return TEXT_CLASS[getSeverity(value, warn, danger)];
  }
}
