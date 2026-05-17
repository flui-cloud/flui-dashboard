import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideArrowRight } from '@ng-icons/lucide';
import { DashboardService } from '../../service/dashboard.service';
import { ClusterService } from '../../service/cluster.service';
import { ClusterStatus } from '../../model/cluster.models';

const STATUS_LABELS: Partial<Record<ClusterStatus, string>> = {
  [ClusterStatus.CREATING]: 'Provisioning cluster',
  [ClusterStatus.SCALING]: 'Scaling nodes',
  [ClusterStatus.UPDATING]: 'Updating cluster',
  [ClusterStatus.STOPPING]: 'Stopping cluster',
  [ClusterStatus.STARTING]: 'Starting cluster',
  [ClusterStatus.DELETING]: 'Deleting cluster',
};

const STATUS_COLORS: Partial<Record<ClusterStatus, string>> = {
  [ClusterStatus.CREATING]: 'text-blue-500',
  [ClusterStatus.SCALING]: 'text-purple-500',
  [ClusterStatus.UPDATING]: 'text-yellow-500',
  [ClusterStatus.STOPPING]: 'text-orange-500',
  [ClusterStatus.STARTING]: 'text-green-500',
  [ClusterStatus.DELETING]: 'text-red-500',
};

@Component({
  selector: 'app-dashboard-operations',
  standalone: true,
  imports: [RouterLink, NgIconComponent],
  providers: [provideIcons({ lucideLoader, lucideArrowRight })],
  template: `
    @if (operations().length > 0) {
      <div class="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
            <h2 class="font-semibold text-blue-900 dark:text-blue-100">Active Operations</h2>
          </div>
          <span class="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300
                       px-2.5 py-0.5 rounded-full font-medium border border-blue-200 dark:border-blue-700">
            {{ operations().length }} in progress
          </span>
        </div>

        <div class="divide-y divide-blue-200 dark:divide-blue-800/50">
          @for (cluster of operations(); track cluster.id) {
            <div class="flex items-center gap-3 py-2.5">
              <ng-icon
                name="lucideLoader"
                class="h-4 w-4 animate-spin flex-shrink-0"
                [class]="getStatusColor(cluster.status)"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-blue-900 dark:text-blue-100 truncate">
                  {{ cluster.name ?? 'Cluster' }}
                </p>
                <p class="text-xs text-blue-600 dark:text-blue-400">
                  {{ getStatusLabel(cluster.status) }}
                </p>
              </div>
              @if (showGlobalProgress() && operations().length === 1) {
                <div class="flex items-center gap-2 flex-shrink-0">
                  <div class="w-24 h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-500 rounded-full"
                      [style.width.%]="globalProgress()"
                    ></div>
                  </div>
                  <span class="text-xs text-blue-600 dark:text-blue-400 w-8 text-right font-mono">
                    {{ globalProgress() }}%
                  </span>
                </div>
              }
              <a
                [routerLink]="['/cluster', cluster.id]"
                class="flex items-center gap-0.5 text-xs text-blue-700 dark:text-blue-300
                       hover:text-blue-900 dark:hover:text-blue-100 font-medium transition-colors flex-shrink-0"
              >
                View
                <ng-icon name="lucideArrowRight" class="h-3 w-3" />
              </a>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class DashboardOperationsComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly clusterService = inject(ClusterService);

  operations = this.dashboardService.clustersInOperation;
  globalProgress = this.clusterService.progress;

  showGlobalProgress = computed(() => {
    const p = this.globalProgress();
    return p > 0 && p < 100;
  });

  getStatusLabel(status: ClusterStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  getStatusColor(status: ClusterStatus): string {
    return STATUS_COLORS[status] ?? 'text-blue-500';
  }
}
