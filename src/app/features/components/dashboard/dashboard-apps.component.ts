import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucidePackage,
  lucideCheckCircle,
  lucideAlertCircle,
  lucideRefreshCw,
  lucideBox,
  lucideDatabase,
  lucideContainer,
  lucideHammer,
} from '@ng-icons/lucide';
import { DashboardService } from '../../service/dashboard.service';

interface AppStatItem {
  label: string;
  value: number;
  colorClass: string;
  bgClass: string;
  icon: string;
}

@Component({
  selector: 'app-dashboard-apps',
  standalone: true,
  imports: [NgIconComponent],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucidePackage,
      lucideCheckCircle,
      lucideAlertCircle,
      lucideRefreshCw,
      lucideBox,
      lucideDatabase,
      lucideContainer,
      lucideHammer,
    }),
  ],
  template: `
    <div
      class="bg-card border border-border rounded-lg p-5 h-full flex flex-col
             cursor-pointer group transition-all duration-200
             hover:border-primary/30 hover:shadow-sm"
      (click)="goToApps()"
      role="button"
      tabindex="0"
      (keydown.enter)="goToApps()"
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <ng-icon name="lucidePackage" class="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h2 class="font-semibold text-foreground text-sm">Applications</h2>
            <p class="text-xs text-muted-foreground">Across all clusters</p>
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
        <span class="text-4xl font-bold text-foreground">{{ userTotalApps() }}</span>
        <span class="text-sm text-muted-foreground ml-2">total</span>
      </div>

      <!-- Stats grid -->
      <div class="grid grid-cols-4 gap-2 flex-1">
        @for (stat of stats(); track stat.label) {
          <div class="flex flex-col gap-1 rounded-md p-2.5" [class]="stat.bgClass">
            <ng-icon [name]="stat.icon" class="h-3.5 w-3.5" [class]="stat.colorClass" />
            <span class="text-xl font-bold" [class]="stat.colorClass">{{ stat.value }}</span>
            <span class="text-xs text-muted-foreground leading-tight">{{ stat.label }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class DashboardAppsComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);

  userTotalApps = this.dashboardService.userTotalApps;

  stats = computed<AppStatItem[]>(() => {
    const failed = this.dashboardService.failedApps();
    return [
      {
        label: 'Databases',
        value: this.dashboardService.databasesApps(),
        colorClass: 'text-foreground',
        bgClass: 'bg-muted/50',
        icon: 'lucideDatabase',
      },
      {
        label: 'Apps',
        value: this.dashboardService.applicationsApps(),
        colorClass: 'text-foreground',
        bgClass: 'bg-muted/50',
        icon: 'lucideContainer',
      },
      {
        label: 'Tools',
        value: this.dashboardService.toolsApps(),
        colorClass: 'text-foreground',
        bgClass: 'bg-muted/50',
        icon: 'lucideHammer',
      },
      {
        label: 'Failed',
        value: failed,
        colorClass: failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
        bgClass: 'bg-muted/50',
        icon: 'lucideAlertCircle',
      },
    ];
  });

  goToApps(): void {
    this.router.navigate(['/apps/applications']);
  }
}
