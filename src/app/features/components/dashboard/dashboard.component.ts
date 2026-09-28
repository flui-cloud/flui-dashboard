import { Component, OnDestroy, inject, signal, computed, effect, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DashboardService } from '../../service/dashboard.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  DashboardSurfaceInput,
  DashboardSurfaceRevision,
  buildDashboardSurface,
  presentedContent,
} from './dashboard-surface';
import { DashboardHomeHeaderComponent } from './dashboard-home-header.component';
import { DashboardFleetTilesComponent } from './dashboard-fleet-tiles.component';
import { DashboardClustersTableComponent } from './dashboard-clusters-table.component';
import { DashboardNeedsYouComponent } from './dashboard-needs-you.component';
import { DashboardWorkloadsComponent } from './dashboard-workloads.component';
import { DashboardCertsComponent } from './dashboard-certs.component';
import { DashboardActivityComponent } from './dashboard-activity.component';
import { DashboardBackupsComponent } from './dashboard-backups.component';
import { PlatformUpdateBannerComponent } from '../platform-updates/platform-update-banner.component';
import { DashboardAgentStatusComponent } from './dashboard-agent-status.component';
import { SandboxGuideCardComponent } from '../sandbox/sandbox-guide-card.component';
import { FleetService } from '../../service/fleet.service';
import { ClusterService } from '../../service/cluster.service';
import { PermissionService } from '../../../core/services/permission.service';
import { isFreshInstall } from './home-state';

const FLEET_REFRESH_MS = 60_000;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DashboardHomeHeaderComponent,
    DashboardFleetTilesComponent,
    DashboardClustersTableComponent,
    DashboardNeedsYouComponent,
    DashboardWorkloadsComponent,
    DashboardCertsComponent,
    DashboardActivityComponent,
    DashboardBackupsComponent,
    PlatformUpdateBannerComponent,
    DashboardAgentStatusComponent,
    SandboxGuideCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-4 md:gap-5 p-4 md:p-6 min-h-full">
      <app-dashboard-home-header [fresh]="fresh()" [refreshing]="refreshing()" (refresh)="refresh()" />

      <app-platform-update-banner />
      <app-sandbox-guide-card />

      @if (isInitializing()) {
        <div class="grid grid-cols-2 xl:grid-cols-4 gap-4" data-testid="home-skeleton">
          @for (_ of [1, 2, 3, 4]; track _) {
            <div class="card-surface p-4 h-[112px] flex flex-col gap-3">
              <div class="h-2.5 w-16 skeleton"></div>
              <div class="h-6 w-20 skeleton"></div>
              <div class="h-6 w-full skeleton"></div>
            </div>
          }
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
          <div class="card-surface p-5 flex flex-col gap-3">
            <div class="h-4 w-24 skeleton"></div>
            @for (_ of [1, 2, 3]; track _) {
              <div class="h-10 w-full skeleton"></div>
            }
          </div>
          <div class="card-surface p-5 flex flex-col gap-3">
            <div class="h-4 w-24 skeleton"></div>
            <div class="h-14 w-full skeleton"></div>
          </div>
        </div>
      } @else if (fresh()) {
        <div data-testid="home-fresh" class="contents">
          <app-dashboard-certs [firstStep]="true" />
          <app-dashboard-fleet-tiles [fresh]="true" />
          <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
            <app-dashboard-clusters-table [fresh]="true" />
            <div class="flex flex-col gap-4">
              <app-dashboard-needs-you />
              <app-dashboard-agent-status />
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
            <app-dashboard-activity />
            <app-dashboard-backups />
          </div>
        </div>
      } @else {
        <div data-testid="home-control-room" class="contents">
          <app-dashboard-fleet-tiles />
          <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
            <app-dashboard-clusters-table />
            <div class="flex flex-col gap-4">
              <app-dashboard-needs-you />
              <app-dashboard-agent-status />
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
            <app-dashboard-certs />
            <app-dashboard-backups />
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
            <app-dashboard-activity />
            <app-dashboard-workloads />
          </div>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly dashboardService = inject(DashboardService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly fleet = inject(FleetService);
  private readonly clusterService = inject(ClusterService);
  private readonly permissions = inject(PermissionService);
  private fleetTimer: ReturnType<typeof setInterval> | null = null;

  isInitializing = signal(true);
  refreshing = signal(false);

  readonly fresh = computed(() =>
    isFreshInstall({
      loading: this.isInitializing(),
      userApps: this.dashboardService.userTotalApps(),
      clusters: this.clusterService.clusters(),
    }),
  );

  private readonly surfaceRevision = new DashboardSurfaceRevision();

  readonly surface = computed(() => {
    const input: DashboardSurfaceInput = {
      loading: this.isInitializing(),
      backendHealth: this.dashboardService.backendHealth(),
      activeOperations: this.dashboardService.clustersInOperation().length,
      providersConnected: this.dashboardService.activeProvidersCount(),
      clustersTotal: this.dashboardService.totalClusters(),
      clustersActive: this.dashboardService.activeClusters(),
      clustersUnhealthy: this.dashboardService.unhealthyClusters(),
      clusterNodesTotal: this.dashboardService.totalNodes(),
      appsTotal: this.dashboardService.userTotalApps(),
      appsRunning: this.dashboardService.runningApps(),
      appsFailed: this.dashboardService.failedApps(),
      appsDatabases: this.dashboardService.databasesApps(),
      appsApplications: this.dashboardService.applicationsApps(),
      appsTools: this.dashboardService.toolsApps(),
    };
    const content = presentedContent(input);
    return buildDashboardSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    // Publish this page's own Semantic Surface snapshot into the shared registry
    // whenever it changes. ngOnDestroy clears it, so the snapshot never outlives this
    // page — same discipline as every other producer in this repo.
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnInit(): void {
    this.permissions.loadSections();
    void this.fleet.loadAll();
    void (async () => {
      await this.dashboardService.initialize();
      this.isInitializing.set(false);
    })();
    this.fleetTimer = setInterval(() => {
      void this.fleet.loadMetrics();
      void this.fleet.loadNeedsYou();
    }, FLEET_REFRESH_MS);
  }

  async refresh(): Promise<void> {
    this.refreshing.set(true);
    try {
      await Promise.all([this.dashboardService.refresh(), this.fleet.loadAll()]);
    } finally {
      this.refreshing.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.fleetTimer) clearInterval(this.fleetTimer);
    this.fleetTimer = null;
    this.currentSurface.set(null);
  }
}
