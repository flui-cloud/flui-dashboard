import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, firstValueFrom } from 'rxjs';
import { CatalogService } from '../../service/catalog.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { DbConsoleService } from '../../service/db-console.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { evaluateEndpointReadiness } from '../../model/endpoint-readiness';
import { buildOpenAppUrl } from '../../model/open-app-url';
import { DbConnectionInfo } from '../../model/db-console.models';
import { databaseEngineOf } from '../../model/db-engine';
import { CatalogInstallResponseDto, ApplicationResponseDto } from '../../../core/api/model/models';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { FlAlert } from '../../../ui/patterns/alert';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlButton } from '../../../ui/primitives/button';
import { CatalogInstallStatusBadgeComponent } from './catalog-install-status-badge.component';
import { CatalogInstallEndpoint } from './catalog-install-endpoint';
import { CatalogInstallResources } from './catalog-install-resources';
import { AppDbConnectCardComponent } from '../application/app-db-connect-card.component';
import {
  CatalogInstallSurfaceInput,
  CatalogInstallSurfaceRevision,
  buildCatalogInstallSurface,
  presentedContent as catalogInstallPresentedContent,
} from './catalog-install-surface';

const TERMINAL_STATES: Set<CatalogInstallResponseDto.StatusEnum> = new Set([
  CatalogInstallResponseDto.StatusEnum.Running,
  CatalogInstallResponseDto.StatusEnum.Failed,
  CatalogInstallResponseDto.StatusEnum.Uninstalled,
]);

@Component({
  selector: 'app-catalog-install-detail',
  imports: [
    RouterLink,
    MaskIdPipe,
    FlAlert,
    FlCopyId,
    FlKeyValue,
    FlKvItem,
    FlPageHeader,
    FlPanel,
    FlLoadingState,
    FlUsageBar,
    FlButton,
    CatalogInstallStatusBadgeComponent,
    CatalogInstallEndpoint,
    CatalogInstallResources,
    AppDbConnectCardComponent,
  ],
  template: `
    @let inst = install();
    <div class="fl-page">
      <fl-page-header [title]="inst?.displayName ?? 'Install'" [breadcrumb]="breadcrumb()">
        @if (inst) {
          <app-catalog-install-status-badge headerStatus [status]="inst.status" />
        }
        @if (inst) {
          <fl-copy-id
            headerMeta
            [value]="inst.id"
            [display]="inst.id | maskId"
            label="install ID"
          />
        }
        @if (inst) {
          <span headerMeta>Created {{ formatDate(inst.createdAt) }}</span>
        }
      </fl-page-header>

      @if (loading()) {
        <fl-panel><fl-loading-state [rows]="4" /></fl-panel>
      } @else if (errorMessage()) {
        <fl-alert tone="error" title="Could not load the install">{{ errorMessage() }}</fl-alert>
      } @else if (inst) {
        @if (inst.status === 'FAILED' && inst.errorMessage) {
          <fl-alert tone="error" title="Install failed">{{ inst.errorMessage }}</fl-alert>
        }

        @if (inst.status === 'INSTALLING' || inst.status === 'PENDING') {
          <fl-panel title="Progress">
            <fl-usage-bar
              label="Install progress"
              [percent]="progressPct()"
              [aside]="currentStepLabel()"
              [warnAt]="101"
              [criticalAt]="101"
            />
          </fl-panel>
        }

        @if (inst.status === 'RUNNING') {
          @if (dbApps().length) {
            @for (db of dbApps(); track db.id) {
              <fl-panel [title]="dbApps().length > 1 ? 'Connect to ' + db.name : 'Connect'">
                <app-db-connect-card [app]="db" [connInfo]="connInfoFor(db.id)" variant="block" />
              </fl-panel>
            }
          } @else if (inst.resolvedFqdn) {
            <app-catalog-install-endpoint
              [fqdn]="inst.resolvedFqdn"
              [readiness]="readiness()"
              [openUrl]="openAppUrl()"
              [dnsAppId]="dnsAppId()"
            />
          } @else if (dnsAppId()) {
            <fl-alert tone="warning" title="No endpoint configured">
              @if (inst.skipEndpoint) {
                Endpoint provisioning was skipped at install time.
              } @else {
                The cluster had no DNS zone or wildcard issuer at install time.
              }
              Add a domain from the app's DNS settings to make it reachable.
              <a
                alertActions
                flButton
                size="sm"
                [routerLink]="['/apps/applications', dnsAppId(), 'dns']"
                >Configure domain</a
              >
            </fl-alert>
          }
        }

        <fl-panel title="Details">
          <fl-key-value>
            <fl-kv-item key="Catalog app">
              <a class="fl-link fl-mono" [routerLink]="['/apps/catalog', inst.slug]">{{
                inst.slug
              }}</a>
            </fl-kv-item>
            <fl-kv-item key="Application">
              @if (dnsAppId(); as appId) {
                <a class="fl-link" [routerLink]="['/apps/applications', appId]">Open application</a>
              } @else {
                <span class="text-fl-ink-muted">Not created yet</span>
              }
            </fl-kv-item>
            <fl-kv-item key="Cluster" [mono]="true">
              <a class="fl-link" [routerLink]="['/cluster', inst.clusterId]">{{
                inst.clusterId | maskId
              }}</a>
            </fl-kv-item>
            @if (inst.requestedDomain) {
              <fl-kv-item key="Requested domain" [mono]="true">{{
                inst.requestedDomain
              }}</fl-kv-item>
            }
            @if (inst.connectedInstallId) {
              <fl-kv-item key="Connected to">
                <a
                  class="fl-link fl-mono"
                  [routerLink]="['/apps/catalog/installs', inst.connectedInstallId]"
                  >{{ inst.connectedSlug ?? (inst.connectedInstallId | maskId) }}</a
                >
              </fl-kv-item>
            }
            <fl-kv-item key="Updated">{{ formatDate(inst.updatedAt) }}</fl-kv-item>
          </fl-key-value>
        </fl-panel>

        @if (components().length > 0) {
          <app-catalog-install-resources
            [components]="components()"
            [primaryComponentId]="primaryId()"
          />
        }
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
  private readonly maskMode = inject(MaskModeService);

  protected readonly connInfo = signal<Record<string, DbConnectionInfo>>({});
  private readonly connRequested = new Set<string>();

  protected readonly dbApps = computed(() => this.components().filter((c) => databaseEngineOf(c)));

  protected connInfoFor(appId: string): DbConnectionInfo | null {
    return this.connInfo()[appId] ?? null;
  }

  protected readonly components = signal<ApplicationResponseDto[]>([]);
  protected readonly primaryId = signal<string | undefined>(undefined);
  private readonly componentsKey = signal<string | null>(null);

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  private readonly from = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('from'))), {
    initialValue: this.route.snapshot.queryParamMap.get('from'),
  });
  protected readonly backLink = computed(() =>
    this.from() === 'applications' ? '/apps/applications' : '/apps/catalog',
  );
  protected readonly backLabel = computed(() =>
    this.from() === 'applications' ? 'Applications' : 'App catalog',
  );

  protected readonly breadcrumb = computed<Crumb[]>(() => [
    { label: this.backLabel(), link: this.backLink() },
    { label: this.install()?.displayName ?? 'Install' },
  ]);

  protected readonly install = this.catalog.currentInstall;
  protected readonly progress = this.catalog.installProgress;
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly progressPct = computed(() => this.progress()?.overallProgress ?? 0);
  protected readonly currentStepLabel = computed(() => this.progress()?.stepLabel ?? 'Preparing…');
  protected readonly firstAppId = computed(() => this.install()?.applicationIds?.[0] ?? null);
  protected readonly dnsAppId = computed(() => this.primaryId() ?? this.firstAppId());

  protected readonly matchedEndpoint = computed(() => {
    const fqdn = this.install()?.resolvedFqdn;
    if (!fqdn) return null;
    return this.endpointsService.endpoints().find((e) => e.fqdn === fqdn) ?? null;
  });
  protected readonly readiness = computed(() => evaluateEndpointReadiness(this.matchedEndpoint()));

  private readonly entrypointPath = signal<string | undefined>(undefined);
  protected readonly openAppUrl = computed(() =>
    buildOpenAppUrl(this.install()?.resolvedFqdn, this.entrypointPath()),
  );

  private readonly endpointClusterLoaded = signal<string | null>(null);
  private endpointPollingAbort = false;
  private pollingAbort = false;

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });

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

    effect(() => {
      for (const db of this.dbApps()) {
        if (this.connRequested.has(db.id)) continue;
        this.connRequested.add(db.id);
        void this.loadConnInfo(db.id);
      }
    });

    let first = true;
    effect(() => {
      this.maskMode.enabled();
      if (first) {
        first = false;
        return;
      }
      this.connRequested.clear();
      this.connInfo.set({});
      for (const db of this.dbApps()) {
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
      return;
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
    } catch {}
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

  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new CatalogInstallSurfaceRevision();

  private readonly surfaceInput = computed<CatalogInstallSurfaceInput>(() => {
    const inst = this.install();
    const readiness = this.readiness();
    return {
      installId: this.id(),
      install: inst
        ? {
            id: inst.id,
            slug: inst.slug,
            displayName: inst.displayName,
            status: inst.status,
            skipEndpoint: inst.skipEndpoint,
            hasEndpoint: Boolean(inst.resolvedFqdn),
            hasError: Boolean(inst.errorMessage),
          }
        : null,
      isLoading: this.loading(),
      hasLoadError: Boolean(this.errorMessage()),
      progressPct: this.progressPct(),
      endpointState: this.matchedEndpoint() ? readiness.state : null,
      endpointReady: readiness.isReady,
      components: this.components().map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        isPrimary: c.id === this.primaryId(),
      })),
      databaseComponentCount: this.dbApps().length,
    };
  });

  protected readonly surface = computed(() => {
    const input = this.surfaceInput();
    return buildCatalogInstallSurface(input, {
      revision: this.surfaceRevision.next(catalogInstallPresentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  ngOnDestroy(): void {
    this.pollingAbort = true;
    this.endpointPollingAbort = true;
    this.catalog.resetInstall();
    this.currentSurface.set(null);
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
      return new Date(iso).toLocaleString('en');
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
      return;
    }
  }
}
