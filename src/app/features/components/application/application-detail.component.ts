import { Component, OnDestroy, inject, signal, computed, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { Router, ActivatedRoute, RouterModule, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { LowerCasePipe } from '@angular/common';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlResourceNav } from '../../../ui/frame/resource-nav';
import { FlToast } from '../../../ui/overlays/toast';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { FlButton } from '../../../ui/primitives/button';
import { appDetailNav } from './app-detail-sections';
import { openUrlOf } from './app-recap-header';
import { statusTone } from './applications-list-rows';
import { statusToneOf } from '../dashboard/home-state';

import { ApplicationService } from '../../service/application.service';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';
import { AppHealthChecksService } from '../../service/app-health-checks.service';
import { AppRuntimeService } from '../../service/app-runtime.service';
import { CrashDiagnosesService } from '../../service/crash-diagnoses.service';
import { AppRuntimeWebSocketService } from '../../service/app-runtime-websocket.service';
import {
  ApplicationStatus,
  getStatusLabel,
  getCategoryLabel,
  getReconciliationLabel,
  availabilityOf,
} from '../../model/application.models';
import { isActionAvailable } from '../../model/app-status-actions';
import { hasPublicEndpoint, isBuildingBlock } from '../../model/app-exposure';
import { databaseEngineOf } from '../../model/db-engine';
import {
  WORKLOAD_LIST_LABEL,
  WORKLOAD_LIST_ROUTE,
  WorkloadList,
  workloadListOf,
} from '../../model/workload-list';
import { accessOf, allowsTab } from '../../model/app-access';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  ApplicationSurfaceInput,
  ApplicationSurfaceRevision,
  buildApplicationSurface,
  presentedContent,
} from './application-surface';
import { replicaCountsOf } from './replica-counts';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';

interface TabItem {
  label: string;
  route: string;
  icon?: string;
}

@Component({
  selector: 'app-application-detail',
  imports: [
    LowerCasePipe,
    MaskIdPipe,
    RouterModule,
    FlPageHeader,
    FlStatus,
    FlTag,
    FlCopyId,
    FlButton,
    FlAlert,
    FlResourceNav,
    FlPanel,
    FlLoadingState,
    FlToast,
  ],
  templateUrl: './application-detail.component.html',
})
export class ApplicationDetailComponent implements OnDestroy {
  private readonly appService = inject(ApplicationService);
  protected monitoringService = inject(ApplicationMonitoringService);
  private readonly healthChecksService = inject(AppHealthChecksService);
  protected runtimeService = inject(AppRuntimeService);
  protected diagnosesService = inject(CrashDiagnosesService);
  private readonly ws = inject(AppRuntimeWebSocketService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly currentSurface = inject(CurrentSurfaceService);

  readonly diagnosesCount = computed(() => this.diagnosesService.unresolvedRecent().length);

  readonly advancedTabs: TabItem[] = [
    { label: 'Diagnoses', route: 'diagnoses', icon: 'lucideShieldAlert' },
    { label: 'Debug pods', route: 'debug-pods', icon: 'lucideBug' },
  ];

  application = this.appService.selectedApplication;
  isLoading = this.appService.loading;
  runtime = this.runtimeService.runtime;

  /** Live replica counts — prefer polled metrics, fall back to runtime snapshot. */
  readonly replicaCounts = computed(() =>
    replicaCountsOf(
      this.runtimeService.runtime(),
      this.monitoringService.statusMetrics(),
      this.application()?.replicas,
    ),
  );

  private pollingAppId: string | null = null;

  showErrorToast = signal(false);
  errorToastMessage = signal('');
  private readonly _appWasLoaded = signal(false);
  private readonly lastKnownList = signal<WorkloadList>('applications');

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  // The Semantic Surface's tab scope reads this — the same source the routerLinkActive
  // bindings in the template read from, not a second notion of "which tab is open".
  private readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.route.snapshot.firstChild?.routeConfig?.path ?? null),
    ),
    { initialValue: this.route.snapshot.firstChild?.routeConfig?.path ?? null },
  );

  constructor() {
    effect(() => {
      const app = this.application();
      if (app) this.lastKnownList.set(workloadListOf(app));
    });
    // A tab the caller may not open, reached by its address, lands on the overview instead of a refusal.
    effect(() => {
      const tab = this.activeTab();
      const access = this.access();
      if (tab && tab !== 'overview' && access && !allowsTab(access, tab)) {
        void this.router.navigate(['overview'], { relativeTo: this.route, replaceUrl: true });
      }
    });

    effect(() => {
      if (this._appWasLoaded() && !this.application() && !this.isLoading()) {
        this.router.navigate([this.listRouteForKind()]);
      }
    });

    // React to :id changes — handles both initial load and in-place navigation
    // between different applications (Angular reuses the component on the same
    // route config), which ngOnInit alone would miss.
    effect(() => {
      const id = this.routeId();
      if (!id) return;
      untracked(() => this.loadApplication(id));
    });

    // Publish this page's own Semantic Surface snapshot into the shared registry
    // whenever it changes. ngOnDestroy clears it, so the snapshot never outlives
    // this page (e.g. the assistant widget staying open across a navigation away).
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  private async loadApplication(id: string): Promise<void> {
    if (this.pollingAppId && this.pollingAppId !== id) {
      this.monitoringService.stopPolling();
      this.diagnosesService.clear();
      this.pollingAppId = null;
    }
    // Drop stale app immediately so the view shows the skeleton instead of the
    // previous application while the new one is fetched.
    this.appService.clearSelectedApplication();

    try {
      await this.appService.getApplication(id);
      if (this.appService.applications().length === 0) void this.appService.loadApplications();
      this._appWasLoaded.set(true);
      this.monitoringService.startPolling(id);
      this.pollingAppId = id;
      this.runtimeService.loadRuntime(id);
      this.ws.onDiagnosis(id, (d) => this.diagnosesService.pushRealtime(d));
      this.ws.ensureAppSubscription(id);
      this.diagnosesService.loadList(id, { limit: 10 });
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'The application could not be found.';
      this.errorToastMessage.set(msg);
      this.showErrorToast.set(true);
      setTimeout(() => {
        this.router.navigate([this.listRouteForKind()]);
      }, 3000);
    }
  }

  readonly tabs = computed<TabItem[]>(() => {
    const app = this.application();

    const baseTabs: TabItem[] = [
      { label: 'Overview', route: 'overview', icon: 'lucideLayoutDashboard' },
    ];
    // A database/cache — either a standalone building-block or one bundled inside a composed
    // catalog install (e.g. immich's postgres/valkey, wordpress's mariadb). Both get the Access
    // tab so the console/connection details are reachable from the component's own detail page.
    const isDatabase = isBuildingBlock(app) || !!databaseEngineOf(app);
    if (isDatabase) {
      baseTabs.push({ label: 'Access', route: 'clients', icon: 'lucidePlug' });
    }
    if (databaseEngineOf(app) === 'postgres' && accessOf(app)?.dataAccess !== false) {
      baseTabs.push({ label: 'Sessions', route: 'sessions', icon: 'lucideActivity' });
    }
    baseTabs.push(
      { label: 'Monitoring', route: 'monitoring', icon: 'lucideChartArea' },
      { label: 'Logs', route: 'logs', icon: 'lucideFileText' },
      { label: 'Revisions', route: 'revisions', icon: 'lucideHistory' },
      { label: 'Configuration', route: 'configuration', icon: 'lucideSettings' },
      { label: 'Resources', route: 'resources', icon: 'lucideCpu' },
    );
    // Hide DNS tab for databases/caches (cluster-local services, no endpoint at all) — both
    // standalone building blocks and composed-install DB components.
    // Internal apps (exposure=internal) DO have endpoints — just with endpointType='internal'
    // — so the DNS tab is shown and renders a simplified card for them.
    if (!isDatabase) {
      baseTabs.push({ label: 'DNS', route: 'dns', icon: 'lucideGlobe' });
    }
    if (app?.sourceType === 'git_build') {
      baseTabs.push({ label: 'Builds', route: 'builds', icon: 'lucideHammer' });
    }
    baseTabs.push(
      { label: 'Releases', route: 'releases', icon: 'lucideRocket' },
      { label: 'Backup', route: 'snapshots', icon: 'lucideShieldCheck' },
    );
    // Scheduled jobs (cron) run the app's own command/image — not relevant for
    // building-block databases/caches (fixed server processes).
    if (!isDatabase) {
      baseTabs.push(
        { label: 'Schedules', route: 'schedules', icon: 'lucideClock' },
        { label: 'Gateway', route: 'gateway', icon: 'lucideNetwork' },
        { label: 'Sign-in', route: 'identity', icon: 'lucideKeyRound' },
        { label: 'Messaging', route: 'messaging', icon: 'lucideMessagesSquare' },
      );
    }
    const access = accessOf(app);
    return baseTabs.filter((t) => allowsTab(access, t.route));
  });

  readonly access = computed(() => accessOf(this.application()));

  protected readonly sections = computed(() =>
    appDetailNav([...this.tabs(), ...this.advancedTabs], {
      off: (route) => this.tabOff(route),
      diagnoses: this.diagnosesCount(),
    }),
  );

  protected readonly breadcrumb = computed(() => {
    const app = this.application();
    const list = app ? workloadListOf(app) : this.lastKnownList();
    const crumbs: Crumb[] = [{ label: WORKLOAD_LIST_LABEL[list], link: WORKLOAD_LIST_ROUTE[list] }];
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    if (returnTo) {
      const group = this.appService
        .applicationGroups()
        .find((g) => g.components.some((c) => c.id === app?.id));
      const name = this.title() ?? app?.name;
      if (group && group.name !== name) crumbs.push({ label: group.name, link: returnTo });
    }
    crumbs.push({ label: this.title() ?? app?.name ?? '' });
    return crumbs;
  });

  protected readonly openUrl = computed(() => {
    const app = this.application();
    return app && hasPublicEndpoint(app) ? openUrlOf(app.url ?? '', null) : '';
  });

  protected statusOf(status: string): StatusTone {
    return statusToneOf(statusTone(status));
  }

  /**
   * In the showcase an application is named after what it is part of — "Live
   * Activity", not the slug its install generated. Elsewhere the name stands.
   */
  protected readonly title = computed(() => {
    const app = this.application();
    if (!app || !this.access()?.showcase) return null;
    const group = this.appService
      .applicationGroups()
      .find((g) => g.components.some((c) => c.id === app.id));
    if (!group || group.components.length < 2) return null;
    const part = (app.metadata as { composedComponent?: unknown } | undefined)?.composedComponent;
    return group.primaryComponentId === app.id || typeof part !== 'string'
      ? group.name
      : `${group.name} · ${part}`;
  });

  private readonly surfaceRevision = new ApplicationSurfaceRevision();

  readonly surface = computed(() => {
    const input: ApplicationSurfaceInput = {
      application: this.application(),
      runtime: this.runtime(),
      replicaCounts: this.replicaCounts(),
      diagnosesCount: this.diagnosesCount(),
      access: this.access(),
      activeTab: this.activeTab(),
      healthChecks: this.healthChecksService.checks(),
    };
    const content = presentedContent(input);
    if (!content) return null;
    return buildApplicationSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  ngOnDestroy(): void {
    if (this.pollingAppId) {
      this.monitoringService.stopPolling();
      this.pollingAppId = null;
    }
    this.diagnosesService.clear();
    this.appService.clearSelectedApplication();
    this.currentSurface.set(null);
  }

  private listRouteForKind(): string {
    const app = this.application();
    return WORKLOAD_LIST_ROUTE[app ? workloadListOf(app) : this.lastKnownList()];
  }

  getStatusDisplayLabel(status: ApplicationStatus): string {
    return getStatusLabel(status);
  }

  getCategoryDisplayLabel(category: string): string {
    return getCategoryLabel(category as any);
  }

  getReconciliationDisplayLabel(status: string): string {
    return getReconciliationLabel(status as any);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return (
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    );
  }

  /** The API's reason a tab is off in this state, or null when it is on. */
  tabOff(route: string): string | null {
    const a = availabilityOf(this.application(), route);
    return a.state === 'disabled' ? (a.reason ?? 'Not available in this state') : null;
  }

  readonly restartOff = computed(() => {
    const a = availabilityOf(this.application(), 'restart');
    return a.state === 'available' ? null : a.reason;
  });

  canRestart(status: ApplicationStatus): boolean {
    return isActionAvailable(status, 'deploy');
  }

  async onRollingRestart(appId: string): Promise<void> {
    await this.runtimeService.restart(appId);
  }
}
