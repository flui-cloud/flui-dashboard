import { Component, OnDestroy, OnInit, inject, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleX,
  lucideLoader,
  lucideCloud,
  lucideServer,
  lucidePackage,
  lucideCpu,
  lucideMemoryStick,
  lucideHardDrive,
  lucideChevronLeft,
  lucideChevronRight,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { DashboardService } from '../../service/dashboard.service';
import { DashboardMetricsService, ClusterMetricsSummary, getSeverity } from '../../service/dashboard-metrics.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { AutoscaleWarningLevel } from '../../model/autoscale.models';

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
  selector: 'app-dashboard-pulse',
  standalone: true,
  imports: [NgIconComponent, DecimalPipe, RouterLink],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideCircleX,
      lucideLoader,
      lucideCloud,
      lucideServer,
      lucidePackage,
      lucideCpu,
      lucideMemoryStick,
      lucideHardDrive,
      lucideChevronLeft,
      lucideChevronRight,
      lucideRefreshCw,
    }),
  ],
  template: `
    <div class="bg-card border border-border rounded-lg px-3 py-2 flex flex-col gap-0">

      <!-- Top band: status pills + timestamp + refresh -->
      <div class="flex items-center gap-1 flex-wrap text-xs">

        <!-- Backend Health -->
        @if (pulse().backendOnline) {
          <div class="flex items-center gap-1.5 px-1.5 py-1">
            <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
            <span class="font-medium text-green-600 dark:text-green-400">Online</span>
          </div>
        } @else {
          <div class="flex items-center gap-1.5 px-1.5 py-1">
            <span class="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
            <span class="font-medium text-red-600 dark:text-red-400">API Offline</span>
          </div>
        }

        <span class="text-border mx-1">·</span>

        <!-- Providers -->
        <div class="flex items-center gap-1 text-muted-foreground px-1.5 py-1">
          <ng-icon name="lucideCloud" class="h-3 w-3" />
          <span>{{ pulse().providersConnected }} provider{{ pulse().providersConnected === 1 ? '' : 's' }}</span>
        </div>

        <span class="text-border mx-1">·</span>

        <!-- Clusters -->
        <div class="flex items-center gap-1 text-muted-foreground px-1.5 py-1">
          <ng-icon name="lucideServer" class="h-3 w-3" />
          <span>{{ pulse().totalClusters }} cluster{{ pulse().totalClusters === 1 ? '' : 's' }}</span>
        </div>

        <span class="text-border mx-1">·</span>

        <!-- Running Apps -->
        <div class="flex items-center gap-1 text-muted-foreground px-1.5 py-1">
          <ng-icon name="lucidePackage" class="h-3 w-3" />
          <span>{{ pulse().runningApps }} running</span>
        </div>

        <!-- Active operations badge -->
        @if (pulse().activeOperations > 0) {
          <span class="text-border mx-1">·</span>
          <div class="flex items-center gap-1 px-1.5 py-1">
            <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
            <span class="font-medium text-blue-600 dark:text-blue-400">
              {{ pulse().activeOperations }} op{{ pulse().activeOperations === 1 ? '' : 's' }}
            </span>
          </div>
        }

        <!-- Spacer + timestamp + refresh -->
        <div class="ml-auto flex items-center gap-1.5 pl-2">
          <span class="text-muted-foreground/60 hidden md:block text-[10px]">
            Updated {{ refreshedAt() }}
          </span>
          <button
            class="h-5 w-5 flex items-center justify-center rounded text-muted-foreground
                   hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            [disabled]="isRefreshing()"
            (click)="refresh()"
            title="Refresh"
          >
            <ng-icon name="lucideRefreshCw" class="h-3 w-3"
                     [class.animate-spin]="isRefreshing()" />
          </button>
        </div>
      </div>

      <!-- Resources band: only when active clusters exist and metrics available -->
      @if (hasActiveClusters() && (metricsLoading() || hasMetrics())) {
        <div class="border-t border-border/50 mt-1 pt-1.5">

          @if (metricsLoading()) {
            <!-- Skeleton -->
            <div class="flex items-center gap-3">
              <div class="h-2.5 w-20 rounded bg-muted animate-pulse flex-shrink-0"></div>
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
          } @else {
            <!-- Per-cluster rows -->
            <div class="flex flex-col gap-0 mt-2">
              @for (c of visibleClusters(); track c.clusterId) {
                <div class="flex items-center gap-3 py-1 first:pt-0 last:pb-0">

                  <!-- Cluster name + nodes -->
                  <div class="flex items-center gap-1.5 w-32 flex-shrink-0 min-w-0">
                    <a
                      [routerLink]="['/cluster', c.clusterId]"
                      class="text-xs font-medium text-foreground truncate
                             hover:text-primary hover:underline transition-colors"
                      [title]="c.clusterName"
                    >{{ c.clusterName }}</a>
                    @if (autoscaleWarning(c.clusterId); as level) {
                      <a
                        [routerLink]="['/cluster', c.clusterId, 'autoscaling']"
                        [title]="autoscaleWarningTitle(level)"
                        class="text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded flex-shrink-0 hover:opacity-80 transition-opacity"
                        [class]="level === 'DANGER_NEEDS_SCALE'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'"
                      >{{ level === 'DANGER_NEEDS_SCALE' ? 'alert' : 'warn' }}</a>
                    }
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

                  <!-- Pagination (only on last row) -->
                  @if ($last && totalPages() > 1) {
                    <div class="flex items-center gap-0.5 flex-shrink-0">
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
                    </div>
                  } @else {
                    <div class="w-1 flex-shrink-0"></div>
                  }

                </div>
              }
            </div>
          }

        </div>
      }

    </div>
  `,
})
export class DashboardPulseComponent implements OnInit, OnDestroy {
  private readonly dashboardService = inject(DashboardService);
  private readonly metricsService = inject(DashboardMetricsService);
  private readonly autoscaleService = inject(ClusterAutoscaleService);

  pulse = this.dashboardService.pulseSummary;
  hasActiveClusters = computed(() => this.dashboardService.activeClusters() > 0);

  metricsLoading = this.metricsService.isLoading;
  hasMetrics = this.metricsService.hasData;
  allClusters = this.metricsService.clusterMetrics;

  isRefreshing = signal(false);

  // Autoscale warning state per cluster (NONE filtered out)
  private readonly autoscaleWarnings = signal<Record<string, AutoscaleWarningLevel>>({});
  private autoscalePollHandle: ReturnType<typeof setInterval> | null = null;

  autoscaleWarning(clusterId: string): AutoscaleWarningLevel | null {
    const level = this.autoscaleWarnings()[clusterId];
    return level && level !== 'NONE' ? level : null;
  }

  autoscaleWarningTitle(level: AutoscaleWarningLevel): string {
    return level === 'DANGER_NEEDS_SCALE'
      ? 'Critical pressure — open Autoscaling tab'
      : 'Sustained pressure — open Autoscaling tab';
  }

  refreshedAt = computed(() => {
    const d = this.dashboardService.lastRefreshedAt();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  currentPage = signal(0);
  totalPages = computed(() => Math.ceil(this.allClusters().length / PAGE_SIZE));

  visibleClusters = computed<ClusterMetricsSummary[]>(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.allClusters().slice(start, start + PAGE_SIZE);
  });

  async refresh(): Promise<void> {
    this.isRefreshing.set(true);
    this.currentPage.set(0);
    await this.dashboardService.refresh();
    this.isRefreshing.set(false);
  }

  prev(): void { this.currentPage.update((p) => Math.max(0, p - 1)); }
  next(): void { this.currentPage.update((p) => Math.min(this.totalPages() - 1, p + 1)); }

  bar(value: number, warn: number, danger: number): string {
    return BAR_CLASS[getSeverity(value, warn, danger)];
  }

  text(value: number, warn: number, danger: number): string {
    return TEXT_CLASS[getSeverity(value, warn, danger)];
  }

  ngOnInit(): void {
    void this.refreshAutoscaleWarnings();
    this.autoscalePollHandle = setInterval(() => {
      void this.refreshAutoscaleWarnings();
    }, 30_000);
  }

  ngOnDestroy(): void {
    if (this.autoscalePollHandle) {
      clearInterval(this.autoscalePollHandle);
      this.autoscalePollHandle = null;
    }
  }

  private async refreshAutoscaleWarnings(): Promise<void> {
    const ids = this.allClusters().map(c => c.clusterId);
    if (ids.length === 0) return;
    const results = await Promise.allSettled(
      ids.map(id => this.autoscaleService.fetchStatusFor(id))
    );
    const next: Record<string, AutoscaleWarningLevel> = {};
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        next[ids[idx]] = r.value.warning;
      }
    });
    this.autoscaleWarnings.set(next);
  }
}
