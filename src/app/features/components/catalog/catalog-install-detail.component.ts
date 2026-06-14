import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, firstValueFrom } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCircleAlert,
  lucideExternalLink,
  lucideGlobe,
  lucideLoader,
  lucideRocket,
} from '@ng-icons/lucide';
import { CatalogService } from '../../service/catalog.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { DbConsoleService } from '../../service/db-console.service';
import { evaluateEndpointReadiness } from '../../model/endpoint-readiness';
import { buildOpenAppUrl } from '../../model/open-app-url';
import { DbConnectionInfo } from '../../model/db-console.models';
import { databaseEngineOf } from '../../model/db-engine';
import {
  CatalogInstallResponseDto,
  ApplicationResponseDto,
} from '../../../core/api/model/models';
import { CatalogInstallStatusBadgeComponent } from './catalog-install-status-badge.component';
import { AppDbConnectCardComponent } from '../application/app-db-connect-card.component';
import { AppComponentsListComponent } from '../application/app-components-list.component';


const TERMINAL_STATES: Set<CatalogInstallResponseDto.StatusEnum> = new Set([
  CatalogInstallResponseDto.StatusEnum.Running,
  CatalogInstallResponseDto.StatusEnum.Failed,
  CatalogInstallResponseDto.StatusEnum.Uninstalled,
]);

@Component({
  selector: 'app-catalog-install-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NgIcon,
    CatalogInstallStatusBadgeComponent,
    AppDbConnectCardComponent,
    AppComponentsListComponent,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideCircleAlert,
      lucideExternalLink,
      lucideGlobe,
      lucideLoader,
      lucideRocket,
    }),
  ],
  template: `
    <div class="mx-auto max-w-3xl space-y-6 p-6">
      <a
        [routerLink]="backLink()"
        class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        {{ backLabel() }}
      </a>

      @let inst = install();
      @if (loading()) {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Loading install…
        </div>
      } @else if (errorMessage()) {
        <div
          class="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center"
        >
          <ng-icon name="lucideCircleAlert" class="h-8 w-8 text-destructive" />
          <p class="text-sm text-destructive">{{ errorMessage() }}</p>
        </div>
      } @else if (inst) {
        <section class="rounded-2xl border border-border bg-card p-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <h1 class="text-xl font-bold text-foreground">{{ inst.displayName }}</h1>
              <p class="text-xs text-muted-foreground">
                {{ inst.slug }} · Created {{ formatDate(inst.createdAt) }}
              </p>
            </div>
            <app-catalog-install-status-badge [status]="inst.status" />
          </div>

          @if (inst.status === 'INSTALLING' || inst.status === 'PENDING') {
            <div class="mt-6 space-y-3">
              <div class="flex items-center justify-between text-sm">
                <span class="font-medium">{{ currentStepLabel() }}</span>
                <span class="text-muted-foreground">{{ progressPct() }}%</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full bg-primary transition-all duration-500"
                  [style.width.%]="progressPct()"
                ></div>
              </div>
            </div>
          }

          @if (inst.status === 'RUNNING') {
            @if (dbApps().length) {
              @for (db of dbApps(); track db.id) {
                <app-db-connect-card [app]="db" [connInfo]="connInfoFor(db.id)" />
              }
            } @else if (inst.resolvedFqdn) {
              @let r = readiness();
              <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <div class="min-w-0 flex-1">
                  <p class="text-xs uppercase tracking-wide text-muted-foreground">Endpoint</p>
                  <p class="mt-0.5 truncate text-sm font-mono">{{ inst.resolvedFqdn }}</p>
                  @if (!r.isReady) {
                    <p class="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      @if (r.state === 'failed') {
                        <ng-icon name="lucideCircleAlert" class="h-3.5 w-3.5 text-destructive" />
                        <span class="font-medium text-destructive">{{ r.label }}</span>
                      } @else {
                        <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin text-primary" />
                        <span>{{ r.label }}</span>
                      }
                    </p>
                    @if (r.detail) {
                      <p class="mt-0.5 text-xs text-muted-foreground">{{ r.detail }}</p>
                    }
                  }
                </div>
                @if (r.isReady) {
                  <a
                    [href]="openAppUrl()"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium
                           text-primary-foreground hover:bg-primary/90"
                  >
                    <ng-icon name="lucideRocket" class="h-4 w-4" />
                    Open app
                    <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
                  </a>
                } @else if (dnsAppId()) {
                  <a
                    [routerLink]="['/apps/applications', dnsAppId(), 'dns']"
                    class="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    <ng-icon name="lucideGlobe" class="h-4 w-4" />
                    DNS tab
                  </a>
                }
              </div>
            } @else if (dnsAppId()) {
              <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
                    No endpoint configured
                  </p>
                  <p class="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                    @if (inst.skipEndpoint) {
                      Endpoint provisioning was skipped at install time.
                    } @else {
                      The cluster had no DNS zone or wildcard issuer at install time.
                    }
                    Add a domain from the app's DNS tab to make it reachable.
                  </p>
                </div>
                <a
                  [routerLink]="['/apps/applications', dnsAppId(), 'dns']"
                  class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium
                         text-primary-foreground hover:bg-primary/90"
                >
                  <ng-icon name="lucideGlobe" class="h-4 w-4" />
                  Configure domain
                </a>
              </div>
            }
          }

          @if (inst.status === 'FAILED' && inst.errorMessage) {
            <div class="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p class="text-sm font-medium text-destructive">Install failed</p>
              <p class="mt-1 text-xs text-destructive/90">{{ inst.errorMessage }}</p>
            </div>
          }

        </section>

        <app-components-list [components]="components()" [primaryComponentId]="primaryId()" />
      }
    </div>
  `,
})
export class CatalogInstallDetailComponent implements OnInit, OnDestroy {
  private readonly catalog = inject(CatalogService);
  private readonly endpointsService = inject(AppEndpointsService);
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly dbConsole = inject(DbConsoleService);
  private readonly route = inject(ActivatedRoute);

  // Per-component connection coordinates (no password), keyed by application id.
  protected readonly connInfo = signal<Record<string, DbConnectionInfo>>({});
  private readonly connRequested = new Set<string>();

  // Every component that is a database/cache (composed apps may bundle several, e.g. postgres + valkey).
  protected readonly dbApps = computed(() =>
    this.components().filter((c) => databaseEngineOf(c)),
  );

  protected connInfoFor(appId: string): DbConnectionInfo | null {
    return this.connInfo()[appId] ?? null;
  }

  protected readonly components = signal<ApplicationResponseDto[]>([]);
  protected readonly primaryId = signal<string | undefined>(undefined);
  private readonly componentsKey = signal<string | null>(null);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  private readonly from = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('from'))),
    { initialValue: this.route.snapshot.queryParamMap.get('from') },
  );
  protected readonly backLink = computed(() =>
    this.from() === 'applications' ? '/apps/applications' : '/apps/catalog',
  );
  protected readonly backLabel = computed(() =>
    this.from() === 'applications' ? 'Back to applications' : 'Back to catalog',
  );

  protected readonly install = this.catalog.currentInstall;
  protected readonly progress = this.catalog.installProgress;
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly progressPct = computed(() => this.progress()?.overallProgress ?? 0);
  protected readonly currentStepLabel = computed(
    () => this.progress()?.stepLabel ?? 'Preparing…',
  );
  protected readonly firstAppId = computed(
    () => this.install()?.applicationIds?.[0] ?? null,
  );
  protected readonly dnsAppId = computed(
    () => this.primaryId() ?? this.firstAppId(),
  );

  protected readonly matchedEndpoint = computed(() => {
    const fqdn = this.install()?.resolvedFqdn;
    if (!fqdn) return null;
    return this.endpointsService.endpoints().find((e) => e.fqdn === fqdn) ?? null;
  });
  protected readonly readiness = computed(() =>
    evaluateEndpointReadiness(this.matchedEndpoint()),
  );

  /** entrypointPath of the catalog app this install belongs to, looked up via `catalogAppDefinitionId`. */
  private readonly entrypointPath = signal<string | undefined>(undefined);
  protected readonly openAppUrl = computed(() =>
    buildOpenAppUrl(this.install()?.resolvedFqdn, this.entrypointPath()),
  );

  private readonly endpointClusterLoaded = signal<string | null>(null);
  private endpointPollingAbort = false;
  private pollingAbort = false;

  constructor() {
    effect(() => {
      const inst = this.install();
      if (!inst?.resolvedFqdn || !inst.clusterId) return;
      if (this.endpointClusterLoaded() === inst.clusterId) return;
      this.endpointClusterLoaded.set(inst.clusterId);
      this.bootstrapEndpointReadiness(inst.clusterId);
    });

    effect(async () => {
      const defId = this.install()?.catalogAppDefinitionId;
      if (!defId) return;
      const path = await this.catalog.getEntrypointPathByDefinitionId(defId);
      this.entrypointPath.set(path);
    });

    effect(() => {
      const inst = this.install();
      if (!inst?.clusterId) return;
      const key = `${inst.id}:${inst.status}`;
      if (this.componentsKey() === key) return;
      this.componentsKey.set(key);
      void this.loadComponents(inst.clusterId, inst.id);
    });

    // Load connection coordinates (no password) for each bundled database/cache.
    effect(() => {
      for (const db of this.dbApps()) {
        if (this.connRequested.has(db.id)) continue;
        this.connRequested.add(db.id);
        void this.loadConnInfo(db.id);
      }
    });
  }

  private async loadConnInfo(appId: string): Promise<void> {
    try {
      const info = await firstValueFrom(this.dbConsole.getConnectionInfo(appId));
      this.connInfo.update((m) => ({ ...m, [appId]: info }));
    } catch {
      /* leave coordinates blank; the console link still works */
    }
  }

  private async loadComponents(clusterId: string, installId: string): Promise<void> {
    try {
      const groups = await firstValueFrom(
        this.applicationsApi.applicationsControllerListGroupedByCluster(clusterId),
      );
      const group = groups.find((g) => g.catalogInstallId === installId);
      this.components.set(group?.components ?? []);
      this.primaryId.set(group?.primaryComponentId);
    } catch {
    }
  }

  ngOnInit(): void {
    void (async () => {
      const id = this.id();
      if (!id) return;
  
      this.loading.set(true);
      this.errorMessage.set(null);
      const first = await this.catalog.getInstall(id);
      this.loading.set(false);
      if (!first) {
        this.errorMessage.set('Install not found.');
        return;
      }
      if (!TERMINAL_STATES.has(first.status)) {
        this.startPolling(first);
      }
    })();
  }

  ngOnDestroy(): void {
    this.pollingAbort = true;
    this.endpointPollingAbort = true;
    this.catalog.resetInstall();
  }

  private async bootstrapEndpointReadiness(clusterId: string): Promise<void> {
    await this.endpointsService.loadEndpoints(clusterId);
    const ep = this.matchedEndpoint();
    if (!ep || evaluateEndpointReadiness(ep).isTerminal) return;

    this.endpointPollingAbort = false;
    const start = Date.now();
    const timeoutMs = 5 * 60_000;
    const interval = 8000;
    while (!this.endpointPollingAbort && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, interval));
      if (this.endpointPollingAbort) return;
      const refreshed = await this.endpointsService.getEndpointStatus(ep.id);
      if (!refreshed) continue;
      if (evaluateEndpointReadiness(refreshed).isTerminal) return;
    }
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  private async startPolling(initial: CatalogInstallResponseDto): Promise<void> {
    this.pollingAbort = false;
    try {
      await this.catalog.pollInstall(initial.id, initial.operationId, () => {
        if (this.pollingAbort) throw new Error('aborted');
      });
    } catch {
      // aborted or timed out — either way, last known state stays in the signal
    }
  }
}
