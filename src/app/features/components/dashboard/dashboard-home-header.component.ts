import { Component, computed, inject, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { DashboardService } from '../../service/dashboard.service';
import { FLEET_WINDOWS, FleetService, FleetWindow } from '../../service/fleet.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AddWorkloadMenuComponent } from '../application/add-workload-menu.component';
import { SandboxService } from '../../../core/services/sandbox.service';
import { ApplicationService } from '../../service/application.service';
import { accessOf } from '../../model/app-access';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlSegmented } from '../../../ui/patterns/filter-bar';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-dashboard-home-header',
  imports: [AddWorkloadMenuComponent, FlPageHeader, FlStatus, FlSegmented, FlButton, FlIcon],
  providers: [provideIcons({ lucideRefreshCw })],
  template: `
    <fl-page-header title="Overview">
      @if (pulse().backendOnline) {
        <fl-status headerStatus tone="success" label="Operational" data-testid="home-status" />
      } @else {
        <fl-status headerStatus tone="error" label="API offline" data-testid="home-status" />
      }
      <span headerMeta class="contents" data-testid="home-status-line">
        @if (guest()) {
          <span>{{ plural(pulse().totalClusters, 'cluster') }}</span>
          <span>{{ guestApps().showcase }} in the showcase</span>
          @if (guestApps().own > 0) {
            <span>{{ guestApps().own }} of yours</span>
          }
        } @else {
          <span>{{ plural(pulse().providersConnected, 'provider') }}</span>
          <span>{{ plural(pulse().totalClusters, 'cluster') }}</span>
          <span>{{
            fresh()
              ? pulse().runningApps + ' system apps running'
              : pulse().runningApps + ' running'
          }}</span>
        }
        @if (pulse().activeOperations > 0) {
          <fl-status
            tone="progress"
            [label]="plural(pulse().activeOperations, 'operation')"
            data-testid="home-operations"
          />
        }
      </span>
      <ng-container headerActions>
        @if (showWindow()) {
          <fl-segmented
            label="Metrics window"
            data-testid="home-window"
            [options]="windowOptions"
            [value]="fleet.window()"
            (valueChange)="setWindow($event)"
          />
        }
        <button
          flButton
          type="button"
          [iconOnly]="true"
          [disabled]="refreshing()"
          [title]="'Updated ' + refreshedAt()"
          aria-label="Refresh"
          (click)="refresh.emit()"
        >
          <fl-icon name="lucideRefreshCw" />
        </button>
        @if (canDeploy()) {
          <app-add-workload-menu label="Deploy" />
        }
      </ng-container>
    </fl-page-header>
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
    const showcase = groups.filter((group) =>
      group.components.some((c) => accessOf(c)?.showcase),
    ).length;
    return { showcase, own: groups.length - showcase };
  });

  protected readonly windowOptions = FLEET_WINDOWS.map((w) => ({ value: w, label: w }));
  protected readonly pulse = this.dashboard.pulseSummary;

  readonly showWindow = computed(() => !this.fresh() && this.fleet.metricsState() !== 'forbidden');
  readonly canDeploy = computed(() => this.permissions.hasSection('deploy'));

  protected readonly refreshedAt = computed(() =>
    this.dashboard
      .lastRefreshedAt()
      .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  );

  protected plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
  }

  protected setWindow(w: string): void {
    void this.fleet.setWindow(w as FleetWindow);
  }
}
