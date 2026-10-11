import { Component, computed, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { DashboardService } from '../../service/dashboard.service';
import { FLEET_WINDOWS, FleetService, FleetWindow } from '../../service/fleet.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AddWorkloadMenuComponent } from '../application/add-workload-menu.component';
import { SandboxService } from '../../../core/services/sandbox.service';
import { ApplicationService } from '../../service/application.service';
import { accessOf } from '../../model/app-access';

@Component({
  selector: 'app-dashboard-home-header',
  standalone: true,
  imports: [NgIconComponent, AddWorkloadMenuComponent],
  providers: [provideIcons({ lucideRefreshCw })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <header class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div class="flex flex-col gap-1.5 min-w-0">
        <h1 class="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">Home</h1>
        <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground" data-testid="home-status-line">
          @if (pulse().backendOnline) {
            <span class="inline-flex items-center gap-1.5 font-semibold text-green-700 dark:text-green-400">
              <span class="h-2 w-2 rounded-full bg-green-500"></span>Online
            </span>
          } @else {
            <span class="inline-flex items-center gap-1.5 font-semibold text-destructive">
              <span class="h-2 w-2 rounded-full bg-destructive animate-pulse"></span>API offline
            </span>
          }
          @if (guest()) {
            <span class="text-border">·</span>
            <span>{{ plural(pulse().totalClusters, 'cluster') }}</span>
            <span class="text-border">·</span>
            <span>{{ guestApps().showcase }} in the showcase</span>
            <span class="text-border">·</span>
            <span>{{ guestApps().own === 0 ? 'none of yours yet' : guestApps().own + ' of yours' }}</span>
          } @else {
            <span class="text-border">·</span>
            <span>{{ plural(pulse().providersConnected, 'provider') }}</span>
            <span class="text-border">·</span>
            <span>{{ plural(pulse().totalClusters, 'cluster') }}</span>
            <span class="text-border">·</span>
            <span>{{ fresh() ? pulse().runningApps + ' system apps running' : pulse().runningApps + ' running' }}</span>
          }
          @if (pulse().activeOperations > 0) {
            <span class="text-border">·</span>
            <span class="font-medium text-primary" data-testid="home-operations">{{ plural(pulse().activeOperations, 'operation') }}</span>
          }
        </div>
      </div>

      <div class="flex items-center gap-2">
        @if (showWindow()) {
          <div class="inline-flex p-0.5 gap-0.5 bg-muted rounded-lg" role="group" aria-label="Metrics window" data-testid="home-window">
            @for (w of windows; track w) {
              <button
                type="button"
                (click)="setWindow(w)"
                [attr.aria-pressed]="fleet.window() === w"
                class="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                [class]="fleet.window() === w ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              >{{ w }}</button>
            }
          </div>
        }
        <button
          type="button"
          class="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          [disabled]="refreshing()"
          (click)="refresh.emit()"
          [title]="'Refresh · updated ' + refreshedAt()"
          aria-label="Refresh"
        >
          <ng-icon name="lucideRefreshCw" class="h-4 w-4" [class.animate-spin]="refreshing()" />
        </button>
        @if (canDeploy()) {
          <app-add-workload-menu label="Deploy" />
        }
      </div>
    </header>
  `,
})
export class DashboardHomeHeaderComponent {
  readonly fresh = input(false);
  readonly refreshing = input(false);
  readonly refresh = output<void>();

  protected readonly fleet = inject(FleetService);
  private readonly dashboard = inject(DashboardService);
  private readonly permissions = inject(PermissionService);
  private readonly sandbox = inject(SandboxService);
  private readonly applications = inject(ApplicationService);

  protected readonly guest = computed(() => this.sandbox.inSandbox());
  protected readonly guestApps = computed(() => {
    const groups = this.applications.applicationGroups();
    const showcase = groups.filter((group) => group.components.some((c) => accessOf(c)?.showcase)).length;
    return { showcase, own: groups.length - showcase };
  });

  protected readonly windows = FLEET_WINDOWS;
  protected readonly pulse = this.dashboard.pulseSummary;

  readonly showWindow = computed(() => !this.fresh() && this.fleet.metricsState() !== 'forbidden');
  readonly canDeploy = computed(() => this.permissions.hasSection('deploy'));

  protected readonly refreshedAt = computed(() =>
    this.dashboard.lastRefreshedAt().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );

  protected plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
  }

  protected setWindow(w: FleetWindow): void {
    void this.fleet.setWindow(w);
  }
}
