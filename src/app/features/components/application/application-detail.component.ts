import { Component, OnDestroy, inject, signal, computed, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { map } from 'rxjs/operators';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideLayoutDashboard,
  lucideChartArea,
  lucideFileText,
  lucideHistory,
  lucideSettings,
  lucideCpu,
  lucideGlobe,
  lucideCircleX,
  lucideCircleAlert,
  lucideX,
  lucideCopy,
  lucideCheck,
  lucideRotateCcw,
  lucideLoader,
  lucideHammer,
  lucideRocket,
  lucideCamera,
  lucideClock,
  lucidePlug,
  lucideShieldAlert,
  lucideBug,
  lucideChevronDown,
} from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';
import { AppRuntimeService } from '../../service/app-runtime.service';
import { CrashDiagnosesService } from '../../service/crash-diagnoses.service';
import { AppRuntimeWebSocketService } from '../../service/app-runtime-websocket.service';
import {
  ApplicationStatus,
  ApplicationKind,
  ApplicationKindEnum,
  getStatusLabel,
  getCategoryLabel,
  getReconciliationLabel,
  getStatusBadgeClass,
  getCategoryBadgeClass,
  getReconciliationBadgeClass,
} from '../../model/application.models';
import { isActionAvailable } from '../../model/app-status-actions';
import { isBuildingBlock } from '../../model/app-exposure';
import { databaseEngineOf } from '../../model/db-engine';

interface TabItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-application-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideLayoutDashboard,
      lucideChartArea,
      lucideFileText,
      lucideHistory,
      lucideSettings,
      lucideCpu,
      lucideGlobe,
      lucideCircleX,
      lucideCircleAlert,
      lucideX,
      lucideCopy,
      lucideCheck,
      lucideRotateCcw,
      lucideLoader,
      lucideHammer,
  lucideRocket,
  lucideCamera,
  lucideClock,
      lucidePlug,
      lucideShieldAlert,
      lucideBug,
      lucideChevronDown,
    }),
  ],
  template: `
    <!-- Error Toast -->
    @if (showErrorToast()) {
      <div
        class="fixed top-4 right-4 z-50 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 shadow-lg animate-slide-in-right max-w-md"
      >
        <div class="flex items-start gap-3">
          <ng-icon
            name="lucideCircleX"
            class="h-6 w-6 flex-shrink-0 text-red-600 dark:text-red-400"
          />
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-red-900 dark:text-red-100">
              Application not found
            </h3>
            <p class="text-sm text-red-700 dark:text-red-300 mt-1">
              {{ errorToastMessage() }}
            </p>
          </div>
          <button
            (click)="showErrorToast.set(false)"
            class="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <ng-icon name="lucideX" class="h-5 w-5" />
          </button>
        </div>
      </div>
    }

    <div class="space-y-6 p-6">
      @if (isLoading() && !application()) {
        <!-- Skeleton loader -->
        <div class="animate-pulse space-y-6">
          <!-- Header skeleton -->
          <div class="flex items-start gap-4">
            <div
              class="mt-1 h-9 w-9 rounded-lg bg-gray-200 dark:bg-gray-700"
            ></div>
            <div class="space-y-2">
              <div class="flex items-center gap-3">
                <div
                  class="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700"
                ></div>
                <div
                  class="h-5 w-16 rounded bg-gray-200 dark:bg-gray-700"
                ></div>
              </div>
              <div class="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="flex gap-2">
                <div
                  class="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-700"
                ></div>
              </div>
            </div>
          </div>
          <!-- Stats skeleton -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            @for (i of [1, 2, 3, 4]; track i) {
              <div
                class="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-2"
              >
                <div
                  class="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700"
                ></div>
                <div
                  class="h-6 w-24 rounded bg-gray-200 dark:bg-gray-700"
                ></div>
              </div>
            }
          </div>
          <!-- Tab skeleton -->
          <div class="bg-white dark:bg-gray-800 border rounded-lg">
            <div
              class="border-b border-gray-200 dark:border-gray-700 flex gap-1 px-2"
            >
              @for (i of [1, 2, 3, 4, 5, 6]; track i) {
                <div
                  class="h-10 w-24 my-2 rounded bg-gray-200 dark:bg-gray-700"
                ></div>
              }
            </div>
            <div class="p-6 space-y-3">
              <div class="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-64">
                <div
                  class="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700"
                ></div>
                <div
                  class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700"
                ></div>
                <div
                  class="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700"
                ></div>
              </div>
            </div>
          </div>
        </div>
      }

      @if (application(); as app) {
        <!-- Header -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-4">
            <button
              (click)="backToList()"
              class="mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
            </button>
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                  {{ app.name }}
                </h1>
                <span [class]="getBadgeCategory(app.category)">
                  {{ getCategoryDisplayLabel(app.category) }}
                </span>
              </div>
              <div class="flex items-center gap-3 mt-2">
                <span [class]="getBadgeStatus(app.status)">
                  {{ getStatusDisplayLabel(app.status) }}
                </span>
                @if (app.id) {
                  <div class="flex items-center gap-1">
                    <span class="font-mono text-xs text-gray-400 dark:text-gray-500">{{ app.id }}</span>
                    <button
                      (click)="copyId(app.id)"
                      class="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      [title]="copiedId() ? 'Copied!' : 'Copy ID'"
                    >
                      @if (copiedId()) {
                        <ng-icon name="lucideCheck" class="h-3 w-3 text-green-500" />
                      } @else {
                        <ng-icon name="lucideCopy" class="h-3 w-3 text-gray-400 dark:text-gray-500" />
                      }
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Quick actions toolbar -->
          <div class="flex items-center gap-1 mt-1 flex-shrink-0">
            <button
              (click)="onRollingRestart(app.id)"
              [disabled]="runtimeService.savingRestart() || !canRestart(app.status)"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Rolling restart"
            >
              @if (runtimeService.savingRestart()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
              } @else {
                <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" />
              }
              Restart
            </button>
          </div>
        </div>

        <!-- Deleted notice -->
        @if (app.status === 'deleted') {
          <div class="flex items-center gap-3 px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400">
            <ng-icon name="lucideCircleX" class="h-4 w-4 flex-shrink-0" />
            This application has been deleted and is no longer active.
          </div>
        }

        <!-- Reconciliation error (build/deploy failures) -->
        @if (app.status === 'failed' && app.reconciliationError) {
          <div class="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            <ng-icon name="lucideCircleAlert" class="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div class="space-y-0.5 min-w-0">
              <p class="font-medium">Deploy failed</p>
              <p class="text-xs whitespace-pre-wrap break-words">{{ app.reconciliationError }}</p>
            </div>
          </div>
        }

        <!-- Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white dark:bg-gray-800 border rounded-lg p-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">Replicas</p>
            <p class="text-lg font-bold tabular-nums">
              {{ replicaCounts().ready
              }}<span
                class="text-sm font-normal text-gray-400 dark:text-gray-500"
              >
                / {{ replicaCounts().desired }}</span
              >
            </p>
          </div>
          <a [routerLink]="['images']" class="bg-white dark:bg-gray-800 border rounded-lg p-4 min-w-0 block hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
            <p class="text-sm text-gray-600 dark:text-gray-400">Image</p>
            @if (runtime()?.containers?.[0]?.image; as img) {
              <p class="text-sm font-mono font-medium truncate" [title]="img">{{ img }}</p>
            } @else if (app.imageRef) {
              <p class="text-sm font-mono font-medium truncate" [title]="app.imageRef">{{ app.imageRef }}</p>
            } @else {
              <p class="text-sm text-gray-400 dark:text-gray-500">—</p>
            }
          </a>
          <div class="bg-white dark:bg-gray-800 border rounded-lg p-4 min-w-0">
            <p class="text-sm text-gray-600 dark:text-gray-400">CPU / Memory</p>
            @if (runtime()?.containers?.[0]; as c) {
              <p class="text-sm font-mono font-medium">
                {{ c.requests.cpu ?? '—' }} · {{ c.requests.memory ?? '—' }}
              </p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                limits: {{ c.limits.cpu ?? '—' }} · {{ c.limits.memory ?? '—' }}
              </p>
            } @else {
              <p class="text-sm text-gray-400 dark:text-gray-500">—</p>
            }
          </div>
          <div class="bg-white dark:bg-gray-800 border rounded-lg p-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">Last Deploy</p>
            @if (app.lastDeployedAt) {
              <p class="text-sm font-medium">
                {{ formatDate(app.lastDeployedAt) }}
              </p>
            } @else {
              <p class="text-sm text-gray-400 dark:text-gray-500">—</p>
            }
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="bg-white dark:bg-gray-800 border rounded-lg">
          <div class="border-b border-gray-200 dark:border-gray-700 relative flex items-stretch">
            <nav class="flex -mb-px gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0 items-stretch">
              @for (tab of tabs(); track tab.route) {
                <a
                  [routerLink]="[tab.route]"
                  routerLinkActive
                  #rla="routerLinkActive"
                  [routerLinkActiveOptions]="{ exact: true }"
                  [title]="tab.label"
                  class="inline-flex items-center gap-1.5 px-3 md:px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0"
                  [class]="
                    rla.isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'
                  "
                >
                  <ng-icon [name]="tab.icon" class="h-4 w-4 flex-shrink-0" />
                  <span class="hidden md:inline">{{ tab.label }}</span>
                </a>
              }
            </nav>
            <!-- Advanced dropdown (outside nav scroll so the menu isn't clipped) -->
            <div class="relative flex items-stretch border-l border-gray-200 dark:border-gray-700 -mb-px">
              <button
                type="button"
                (click)="toggleAdvanced(); $event.stopPropagation()"
                title="Advanced"
                class="inline-flex items-center gap-1.5 px-3 md:px-5 py-3 text-sm font-medium border-b-2 border-transparent transition-colors whitespace-nowrap flex-shrink-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600"
              >
                <ng-icon name="lucideSettings" class="h-4 w-4 flex-shrink-0" />
                <span class="hidden md:inline">Advanced</span>
                @if (diagnosesCount() > 0) {
                  <span class="ml-0.5 text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-semibold tabular-nums">
                    {{ diagnosesCount() }}
                  </span>
                }
                <ng-icon name="lucideChevronDown" class="h-3.5 w-3.5 flex-shrink-0" />
              </button>
              @if (advancedOpen()) {
                <div
                  class="fixed inset-0 z-40"
                  (click)="advancedOpen.set(false)"
                ></div>
                <div
                  class="absolute right-0 top-full mt-1 w-52 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1"
                  (click)="advancedOpen.set(false)"
                >
                  @for (item of advancedTabs; track item.route) {
                    <a
                      [routerLink]="[item.route]"
                      routerLinkActive="bg-gray-100 dark:bg-gray-700/60 text-blue-600 dark:text-blue-400"
                      [routerLinkActiveOptions]="{ exact: true }"
                      class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                    >
                      <ng-icon [name]="item.icon" class="h-4 w-4" />
                      <span class="flex-1">{{ item.label }}</span>
                      @if (item.route === 'diagnoses' && diagnosesCount() > 0) {
                        <span class="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-semibold tabular-nums">
                          {{ diagnosesCount() }}
                        </span>
                      }
                    </a>
                  }
                </div>
              }
            </div>
          </div>
          <div class="p-6">
            <router-outlet />
          </div>
        </div>
      }
    </div>
  `,
})
export class ApplicationDetailComponent implements OnDestroy {
  copiedId = signal(false);
  private readonly appService = inject(ApplicationService);
  protected monitoringService = inject(ApplicationMonitoringService);
  protected runtimeService = inject(AppRuntimeService);
  protected diagnosesService = inject(CrashDiagnosesService);
  private readonly ws = inject(AppRuntimeWebSocketService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly diagnosesCount = computed(() => this.diagnosesService.unresolvedRecent().length);

  readonly advancedTabs: TabItem[] = [
    { label: 'Diagnoses', route: 'diagnoses', icon: 'lucideShieldAlert' },
    { label: 'Debug pods', route: 'debug-pods', icon: 'lucideBug' },
  ];

  advancedOpen = signal(false);

  toggleAdvanced(): void {
    this.advancedOpen.update(v => !v);
  }

  application = this.appService.selectedApplication;
  isLoading = this.appService.loading;
  runtime = this.runtimeService.runtime;

  /** Live replica counts — prefer polled metrics, fall back to runtime snapshot. */
  readonly replicaCounts = computed(() => {
    const status = this.monitoringService.statusMetrics();
    const rt = this.runtimeService.runtime();
    const app = this.application();
    const ready = status?.replicas_ready ?? rt?.replicas?.ready ?? 0;
    const desired =
      status?.replicas_desired ?? rt?.replicas?.desired ?? app?.replicas ?? 0;
    return { ready, desired };
  });

  private pollingAppId: string | null = null;

  showErrorToast = signal(false);
  errorToastMessage = signal('');
  private readonly _appWasLoaded = signal(false);
  private readonly lastKnownKind = signal<ApplicationKind | undefined>(undefined);

  private readonly routeId = toSignal(
    this.route.paramMap.pipe(map(p => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  constructor() {
    effect(() => {
      const kind = this.application()?.kind;
      if (kind) this.lastKnownKind.set(kind);
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
      this._appWasLoaded.set(true);
      this.monitoringService.startPolling(id);
      this.pollingAppId = id;
      this.runtimeService.loadRuntime(id);
      this.ws.onDiagnosis(id, d => this.diagnosesService.pushRealtime(d));
      this.ws.onAutoRemediation(id, e => this.diagnosesService.applyAutoRemediation(e));
      this.ws.ensureAppSubscription(id);
      this.diagnosesService.loadList(id, { limit: 10 });
    } catch (error: any) {
      const msg =
        error?.error?.message ||
        error?.message ||
        'The application could not be found.';
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
      { label: 'Snapshots', route: 'snapshots', icon: 'lucideCamera' },
    );
    // Scheduled jobs (cron) run the app's own command/image — not relevant for
    // building-block databases/caches (fixed server processes).
    if (!isDatabase) {
      baseTabs.push({
        label: 'Schedules',
        route: 'schedules',
        icon: 'lucideClock',
      });
    }
    return baseTabs;
  });

  ngOnDestroy(): void {
    if (this.pollingAppId) {
      this.monitoringService.stopPolling();
      this.pollingAppId = null;
    }
    this.diagnosesService.clear();
    this.appService.clearSelectedApplication();
  }

  backToList() {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    if (returnTo) {
      void this.router.navigateByUrl(returnTo);
      return;
    }
    this.router.navigate([this.listRouteForKind()]);
  }

  private listRouteForKind(): string {
    switch (this.application()?.kind ?? this.lastKnownKind()) {
      case ApplicationKindEnum.Database:
        return '/apps/databases';
      case ApplicationKindEnum.Tool:
        return '/apps/tools';
      case ApplicationKindEnum.System:
        return '/apps/system';
      default:
        return '/apps/applications';
    }
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

  getBadgeStatus(status: ApplicationStatus): string {
    return getStatusBadgeClass(status);
  }

  getBadgeCategory(category: string): string {
    return getCategoryBadgeClass(category);
  }

  getBadgeReconciliation(status: string): string {
    return getReconciliationBadgeClass(status);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return (
      d.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      }) +
      ' ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    );
  }

  copyId(id: string): void {
    navigator.clipboard.writeText(id);
    this.copiedId.set(true);
    setTimeout(() => this.copiedId.set(false), 2000);
  }

  canRestart(status: ApplicationStatus): boolean {
    return isActionAvailable(status, 'deploy');
  }

  async onRollingRestart(appId: string): Promise<void> {
    await this.runtimeService.restart(appId);
  }

}
