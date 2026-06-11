import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideServer,
  lucideCheckCircle,
  lucideAlertTriangle,
  lucideCpu,
  lucideCircleDot,
} from '@ng-icons/lucide';
import { DashboardService } from '../../service/dashboard.service';
import { ClusterStatus } from '../../model/cluster.models';

@Component({
  selector: 'app-dashboard-clusters',
  standalone: true,
  imports: [NgIconComponent],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideServer,
      lucideCheckCircle,
      lucideAlertTriangle,
      lucideCpu,
      lucideCircleDot,
    }),
  ],
  template: `
    <div
      class="bg-card border border-border rounded-lg p-5 h-full flex flex-col
             cursor-pointer group transition-all duration-200
             hover:border-primary/30 hover:shadow-sm"
      (click)="goToClusters()"
      role="button"
      tabindex="0"
      (keydown.enter)="goToClusters()"
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2.5">
          <div class="icon-chip chip-brand h-9 w-9">
            <ng-icon name="lucideServer" class="h-4 w-4" />
          </div>
          <div>
            <h2 class="font-semibold text-foreground text-sm">Clusters</h2>
            <p class="text-xs text-muted-foreground">Infrastructure</p>
          </div>
        </div>
        <div class="flex items-center gap-1 text-xs text-muted-foreground
                    group-hover:text-primary transition-colors">
          <span class="hidden sm:inline">View all</span>
          <ng-icon name="lucideArrowRight" class="h-3.5 w-3.5" />
        </div>
      </div>

      <!-- Big total number -->
      <div class="mb-4">
        <span class="text-4xl font-bold text-foreground">{{ total() }}</span>
        <span class="text-sm text-muted-foreground ml-2">clusters</span>
        @if (totalNodes() > 0) {
          <span class="text-xs text-muted-foreground ml-2">· {{ totalNodes() }} nodes</span>
        }
      </div>

      <!-- Cluster status breakdown -->
      <div class="space-y-2 flex-1">
        <!-- Active -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-green-500 flex-shrink-0"></span>
            <span class="text-sm text-muted-foreground">Active</span>
          </div>
          <span class="text-sm font-semibold text-foreground">{{ active() }}</span>
        </div>

        <!-- Unhealthy -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span
              class="h-2 w-2 rounded-full flex-shrink-0"
              [class]="unhealthy() > 0 ? 'bg-red-500' : 'bg-muted-foreground/30'"
            ></span>
            <span class="text-sm" [class]="unhealthy() > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'">
              Unhealthy
            </span>
          </div>
          <span
            class="text-sm font-semibold"
            [class]="unhealthy() > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'"
          >
            {{ unhealthy() }}
          </span>
        </div>

        <!-- In operation -->
        @if (inOperation() > 0) {
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0"></span>
              <span class="text-sm text-blue-600 dark:text-blue-400">In progress</span>
            </div>
            <span class="text-sm font-semibold text-blue-600 dark:text-blue-400">{{ inOperation() }}</span>
          </div>
        }

        <!-- Stopped -->
        @if (stopped() > 0) {
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-gray-400 flex-shrink-0"></span>
              <span class="text-sm text-muted-foreground">Stopped</span>
            </div>
            <span class="text-sm font-semibold text-muted-foreground">{{ stopped() }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class DashboardClustersComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);

  total = this.dashboardService.totalClusters;
  active = this.dashboardService.activeClusters;
  unhealthy = this.dashboardService.unhealthyClusters;
  totalNodes = this.dashboardService.totalNodes;

  inOperation = computed(() => this.dashboardService.clustersInOperation().length);

  stopped = computed(
    () =>
      this.dashboardService
        .clusters()
        .filter((c) => c.status === ClusterStatus.STOPPED).length
  );

  goToClusters(): void {
    this.router.navigate(['/cluster']);
  }
}
