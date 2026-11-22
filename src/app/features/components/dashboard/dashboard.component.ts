import { SandboxService } from '../../../core/services/sandbox.service';
import { GuestHomeComponent } from './guest-home.component';
import {
  Component,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  DestroyRef,
} from '@angular/core';
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
import { DashboardCertsComponent } from './dashboard-certs.component';
import { DashboardBackupsComponent } from './dashboard-backups.component';
import { DashboardAgentStatusComponent } from './dashboard-agent-status.component';
import { DashboardHealthStrip } from './dashboard-health-strip';
import { poll } from '../../../core/state/poll';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlPanel } from '../../../ui/patterns/panel';
import { FleetService } from '../../service/fleet.service';
import { ClusterService } from '../../service/cluster.service';
import { PermissionService } from '../../../core/services/permission.service';
import { isFreshInstall } from './home-state';

const FLEET_REFRESH_MS = 60_000;

@Component({
  selector: 'app-dashboard',
  imports: [
    DashboardHomeHeaderComponent,
    DashboardHealthStrip,
    DashboardFleetTilesComponent,
    DashboardClustersTableComponent,
    DashboardNeedsYouComponent,
    DashboardCertsComponent,
    DashboardBackupsComponent,
    DashboardAgentStatusComponent,
    GuestHomeComponent,
    FlLoadingState,
    FlPanel,
  ],
  template: `
    <div class="fl-page">
      <app-dashboard-home-header
        [fresh]="fresh()"
        [refreshing]="refreshing()"
        (refresh)="refresh()"
      />

      @if (guest()) {
        <app-guest-home />
      } @else if (isInitializing()) {
        <fl-panel data-testid="home-skeleton"><fl-loading-state [rows]="4" /></fl-panel>
      } @else if (fresh()) {
        <div data-testid="home-fresh" class="fl-stack">
          <app-dashboard-certs [firstStep]="true" />
          <app-dashboard-fleet-tiles [fresh]="true" />
          <app-dashboard-clusters-table [fresh]="true" />
          <div class="fl-grid-3" data-testid="home-columns">
            <app-dashboard-needs-you />
            <app-dashboard-agent-status />
            <app-dashboard-backups />
          </div>
        </div>
      } @else {
        <div data-testid="home-control-room" class="fl-stack">
          <app-dashboard-health-strip />
          <app-dashboard-needs-you />
          <app-dashboard-fleet-tiles />
          <app-dashboard-clusters-table />
          <div class="fl-grid-3" data-testid="home-columns">
            <app-dashboard-backups />
            <app-dashboard-certs />
            <app-dashboard-agent-status />
          </div>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly dashboardService = inject(DashboardService);
  private readonly sandbox = inject(SandboxService);
  /** A demo guest gets their own first screen: the operator's control room is not theirs. */
  protected readonly guest = computed(() => this.sandbox.inSandbox());
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly fleet = inject(FleetService);
  private readonly clusterService = inject(ClusterService);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

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
      const surface = this.surface();
      if (!this.guest()) this.currentSurface.set(surface);
    });
  }

  ngOnInit(): void {
    this.permissions.loadSections();
    void (async () => {
      if (await this.sandbox.whenKnown()) {
        this.isInitializing.set(false);
        await this.dashboardService.checkBackendHealth();
        return;
      }
      void this.fleet.loadAll();
      poll(
        () => {
          void this.fleet.loadMetrics();
          void this.fleet.loadNeedsYou();
        },
        FLEET_REFRESH_MS,
        { destroyRef: this.destroyRef },
      );
      await this.dashboardService.initialize();
      this.isInitializing.set(false);
    })();
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
    this.currentSurface.set(null);
  }
}
