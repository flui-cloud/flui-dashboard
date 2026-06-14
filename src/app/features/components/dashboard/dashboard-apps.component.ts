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
  chipClass: string;
  icon: string;
  route: string;
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
          <div class="icon-chip chip-brand h-9 w-9">
            <ng-icon name="lucidePackage" class="h-4 w-4" />
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
          <div
            class="flex flex-col gap-2 rounded-lg border border-border p-2.5 cursor-pointer
                   transition-colors hover:border-primary/40 hover:bg-muted/40"
            role="button"
            tabindex="0"
            (click)="goToList(stat.route); $event.stopPropagation()"
            (keydown.enter)="goToList(stat.route); $event.stopPropagation()"
          >
            <div class="icon-chip icon-chip-sm" [class]="stat.chipClass">
              <ng-icon [name]="stat.icon" class="h-3.5 w-3.5" />
            </div>
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
        label: 'DBs',
        value: this.dashboardService.databasesApps(),
        colorClass: 'text-foreground',
        chipClass: 'chip-brand',
        icon: 'lucideDatabase',
        route: '/apps/databases',
      },
      {
        label: 'Apps',
        value: this.dashboardService.applicationsApps(),
        colorClass: 'text-foreground',
        chipClass: 'chip-purple',
        icon: 'lucideContainer',
        route: '/apps/applications',
      },
      {
        label: 'Tools',
        value: this.dashboardService.toolsApps(),
        colorClass: 'text-foreground',
        chipClass: 'chip-warn',
        icon: 'lucideHammer',
        route: '/apps/tools',
      },
      {
        label: 'Failed',
        value: failed,
        colorClass: failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
        chipClass: 'chip-danger',
        icon: 'lucideAlertCircle',
        route: '/apps/applications',
      },
    ];
  });

  private readonly primaryListRoute = computed(() => {
    const db = this.dashboardService.databasesApps();
    const app = this.dashboardService.applicationsApps();
    const tool = this.dashboardService.toolsApps();
    const max = Math.max(db, app, tool);
    if (max === 0 || app === max) return '/apps/applications';
    if (db === max) return '/apps/databases';
    return '/apps/tools';
  });

  goToApps(): void {
    this.router.navigate([this.primaryListRoute()]);
  }

  goToList(route: string): void {
    this.router.navigate([route]);
  }
}
