import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideArrowRight,
} from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { ClusterStatus } from '../../model/cluster.models';

interface ActivityItem {
  name: string;
  status: ClusterStatus;
  time: Date | undefined;
  provider?: string;
}

const STATUS_COLORS: Partial<Record<ClusterStatus, { dot: string; label: string; text: string }>> = {
  [ClusterStatus.ACTIVE]:   { dot: 'bg-green-500',  label: 'active',   text: 'text-green-600 dark:text-green-400' },
  [ClusterStatus.ERROR]:    { dot: 'bg-red-500',    label: 'error',    text: 'text-red-600 dark:text-red-400' },
  [ClusterStatus.CREATING]: { dot: 'bg-blue-500',   label: 'creating', text: 'text-blue-600 dark:text-blue-400' },
  [ClusterStatus.SCALING]:  { dot: 'bg-purple-500', label: 'scaling',  text: 'text-purple-600 dark:text-purple-400' },
  [ClusterStatus.UPDATING]: { dot: 'bg-yellow-500', label: 'updating', text: 'text-yellow-600 dark:text-yellow-400' },
  [ClusterStatus.STOPPED]:  { dot: 'bg-gray-400',   label: 'stopped',  text: 'text-muted-foreground' },
  [ClusterStatus.STOPPING]: { dot: 'bg-orange-500', label: 'stopping', text: 'text-orange-600 dark:text-orange-400' },
  [ClusterStatus.STARTING]: { dot: 'bg-green-400',  label: 'starting', text: 'text-green-600 dark:text-green-400' },
  [ClusterStatus.DELETING]: { dot: 'bg-red-400',    label: 'deleting', text: 'text-red-600 dark:text-red-400' },
};

@Component({
  selector: 'app-dashboard-activity',
  standalone: true,
  imports: [RouterLink, NgIconComponent],
  providers: [provideIcons({ lucideActivity, lucideArrowRight })],
  template: `
    <div class="bg-card border border-border rounded-lg p-5">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <ng-icon name="lucideActivity" class="h-4 w-4 text-primary" />
          <h2 class="font-semibold text-foreground">Recent Cluster Activity</h2>
        </div>
        <a
          routerLink="/cluster"
          class="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          All clusters
          <ng-icon name="lucideArrowRight" class="h-3 w-3" />
        </a>
      </div>

      @if (recentActivity().length === 0) {
        <div class="text-center py-6">
          <p class="text-sm text-muted-foreground">No clusters found</p>
          <a routerLink="/cluster/new" class="text-xs text-primary hover:underline mt-1 inline-block">
            Create your first cluster →
          </a>
        </div>
      } @else {
        <!-- Timeline list -->
        <div class="relative">
          <!-- Vertical line -->
          <div class="absolute left-3 top-2 bottom-2 w-px bg-border"></div>

          <div class="space-y-0">
            @for (item of recentActivity(); track item.name; let last = $last) {
              <div class="flex items-start gap-4 py-2.5 relative">
                <!-- Timeline dot -->
                <div
                  class="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 mt-0.5
                         border-2 border-card"
                  [class]="getDotBg(item.status)"
                >
                  <span class="h-2 w-2 rounded-full bg-white/90 dark:bg-black/40"></span>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0 flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-foreground truncate">{{ item.name }}</p>
                    <span
                      class="text-xs font-medium capitalize"
                      [class]="getStatusText(item.status)"
                    >
                      {{ getStatusLabel(item.status) }}
                    </span>
                    @if (item.provider) {
                      <span class="text-xs text-muted-foreground ml-1.5 capitalize">· {{ item.provider }}</span>
                    }
                  </div>
                  <span class="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                    {{ formatTime(item.time) }}
                  </span>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class DashboardActivityComponent {
  private readonly clusterService = inject(ClusterService);

  recentActivity = computed<ActivityItem[]>(() =>
    [...this.clusterService.clusters()]
      .sort((a, b) => {
        const aTime = a.lastActivity?.getTime() ?? a.createdAt?.getTime() ?? 0;
        const bTime = b.lastActivity?.getTime() ?? b.createdAt?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 6)
      .map((c) => ({
        name: c.name ?? 'Unnamed cluster',
        status: c.status,
        time: c.lastActivity ?? c.createdAt,
        provider: c.provider,
      }))
  );

  getDotBg(status: ClusterStatus): string {
    const dot = STATUS_COLORS[status]?.dot ?? 'bg-gray-400';
    return dot;
  }

  getStatusText(status: ClusterStatus): string {
    return STATUS_COLORS[status]?.text ?? 'text-muted-foreground';
  }

  getStatusLabel(status: ClusterStatus): string {
    return STATUS_COLORS[status]?.label ?? status;
  }

  formatTime(date: Date | undefined): string {
    if (!date) return '--';
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
  }
}
