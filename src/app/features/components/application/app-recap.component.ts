import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, firstValueFrom } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCircleAlert,
  lucideExternalLink,
  lucideLayoutDashboard,
  lucideLoader,
  lucideRocket,
} from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { ClusterService } from '../../service/cluster.service';
import { DbConsoleService } from '../../service/db-console.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { databaseEngineOf } from '../../model/db-engine';
import { DbConnectionInfo } from '../../model/db-console.models';
import {
  ApplicationKind,
  ApplicationKindEnum,
  ApplicationStatus,
  getCategoryBadgeClass,
  getCategoryLabel,
  getKindLabel,
  getSourceTypeLabel,
  getStatusBadgeClass,
  getStatusLabel,
} from '../../model/application.models';
import { AppDbConnectCardComponent } from './app-db-connect-card.component';
import { AppComponentsListComponent } from './app-components-list.component';
import { AppDeleteDialogComponent } from './app-delete-dialog.component';

interface RecapFact {
  label: string;
  value: string;
}

const DETAIL_TABS = [
  'Overview',
  'Logs',
  'Monitoring',
  'Configuration',
  'Resources',
  'Releases',
  'Snapshots',
];
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  AppRecapSurfaceInput,
  AppRecapSurfaceRevision,
  buildAppRecapSurface,
  presentedContent as appRecapPresentedContent,
} from './app-recap-surface';

@Component({
  selector: 'app-recap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NgIcon,
    AppDbConnectCardComponent,
    AppComponentsListComponent,
    AppDeleteDialogComponent,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCircleAlert,
      lucideExternalLink,
      lucideLayoutDashboard,
      lucideLoader,
      lucideRocket,
    }),
  ],
  template: `
    <div class="space-y-6 p-6">
      @let g = group();
      @if (!g) {
        <a
          [routerLink]="backLink()"
          [attr.aria-label]="backLabel()"
          [title]="backLabel()"
          class="inline-flex p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
        </a>
      }
      @if (g) {
        @let primaryApp = primary();
        <div class="flex items-start gap-4" data-testid="recap-header">
          <a
            [routerLink]="backLink()"
            [attr.aria-label]="backLabel()"
            [title]="backLabel()"
            class="mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
          </a>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ g.name }}</h1>
              <span [class]="getCategoryBadgeClass(g.category)">
                {{ getCategoryLabel(g.category) }}
              </span>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-3">
              <span [class]="statusBadge(g.status)" class="inline-flex items-center gap-1">
                {{ statusText(g.status) }}
              </span>
              <span class="font-mono text-sm text-muted-foreground">
                {{ primaryApp?.slug ?? g.id }} · Created {{ formatDate(g.createdAt) }}
              </span>
            </div>
          </div>
        </div>

        <section class="rounded-2xl border border-border bg-card p-6">

          @if (accessKind() === 'db' && primaryApp) {
            <app-db-connect-card [app]="primaryApp" [connInfo]="connInfoFor(primaryApp.id)" />
          } @else if (accessKind() === 'web' && primaryApp) {
            <div class="rounded-lg border border-border bg-muted/30 p-4">
              <p class="text-xs uppercase tracking-wide text-muted-foreground">Endpoint</p>
              <a
                [href]="openUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-0.5 inline-flex max-w-full items-center gap-1.5 text-sm font-mono text-primary hover:underline"
                title="Open in a new tab"
                data-testid="recap-endpoint"
              >
                <span class="truncate">{{ endpointHost() }}</span>
                <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5 shrink-0" />
              </a>
            </div>
          }

          @if (facts().length > 0) {
            <dl class="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-6 sm:grid-cols-3">
              @for (f of facts(); track f.label) {
                <div class="min-w-0">
                  <dt class="text-xs uppercase tracking-wide text-muted-foreground">{{ f.label }}</dt>
                  <dd class="mt-0.5 truncate text-sm text-foreground" [title]="f.value">{{ f.value }}</dd>
                </div>
              }
              @if (imageRef()) {
                <div class="col-span-full min-w-0">
                  <dt class="text-xs uppercase tracking-wide text-muted-foreground">Image</dt>
                  <dd class="mt-0.5 truncate font-mono text-xs text-foreground" [title]="imageRef()">{{ imageRef() }}</dd>
                </div>
              }
            </dl>
          }
        </section>

        @if (g.type === 'standalone' && primaryApp) {
          <a
            [routerLink]="['/apps/applications', primaryApp.id]"
            [queryParams]="{ returnTo: '/apps/recap/' + g.id }"
            class="block rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-muted"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <ng-icon name="lucideLayoutDashboard" class="h-5 w-5 text-primary" />
                <div>
                  <p class="text-sm font-semibold text-foreground">Manage application</p>
                  <p class="text-xs text-muted-foreground">
                    Full control panel — metrics, logs, configuration, rollouts, and more.
                  </p>
                </div>
              </div>
              <span class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                Open
                <ng-icon name="lucideArrowRight" class="h-4 w-4" />
              </span>
            </div>
            <div class="mt-4 flex flex-wrap gap-1.5">
              @for (t of detailTabs; track t) {
                <span class="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{{ t }}</span>
              }
            </div>
          </a>
        } @else {
          <app-components-list
            [components]="g.components"
            [primaryComponentId]="g.primaryComponentId"
            [returnTo]="'/apps/recap/' + g.id"
          />
        }

        @for (db of extraDbApps(); track db.id) {
          <app-db-connect-card [app]="db" [connInfo]="connInfoFor(db.id)" />
        }

        <app-delete-dialog
          [group]="g"
          [primary]="primaryApp"
          [listRoute]="listRouteForKind()"
        />
      } @else if (loadAttempted()) {
        <div
          class="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center"
        >
          <ng-icon name="lucideCircleAlert" class="h-8 w-8 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">Application not found.</p>
        </div>
      } @else {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Loading…
        </div>
      }
    </div>
  `,
})
export class AppRecapComponent implements OnInit, OnDestroy {
  private readonly appService = inject(ApplicationService);
  private readonly endpointsService = inject(AppEndpointsService);
  private readonly clusterService = inject(ClusterService);
  private readonly dbConsole = inject(DbConsoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly maskMode = inject(MaskModeService);

  protected readonly getCategoryBadgeClass = getCategoryBadgeClass;
  protected readonly getCategoryLabel = getCategoryLabel;
  protected readonly detailTabs = DETAIL_TABS;

  protected readonly connInfo = signal<Record<string, DbConnectionInfo>>({});
  private readonly connRequested = new Set<string>();
  protected readonly loadAttempted = signal(false);

  protected connInfoFor(appId: string): DbConnectionInfo | null {
    return this.connInfo()[appId] ?? null;
  }

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  private readonly from = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('from'))),
    { initialValue: this.route.snapshot.queryParamMap.get('from') },
  );

  protected readonly listRouteForKind = computed(() => {
    switch (this.primary()?.kind) {
      case ApplicationKindEnum.Database:
        return '/apps/databases';
      case ApplicationKindEnum.Tool:
        return '/apps/tools';
      case ApplicationKindEnum.System:
        return '/apps/system';
      default:
        return '/apps/applications';
    }
  });

  protected readonly backLink = computed(() =>
    this.from() === 'catalog' ? '/apps/catalog' : this.listRouteForKind(),
  );
  protected readonly backLabel = computed(() => {
    if (this.from() === 'catalog') return 'Back to catalog';
    const kind = this.primary()?.kind ?? ApplicationKindEnum.Application;
    return `Back to ${getKindLabel(kind).toLowerCase()}`;
  });

  protected readonly group = computed(
    () => this.appService.applicationGroups().find((x) => x.id === this.id()) ?? null,
  );

  protected readonly primary = computed(() => {
    const g = this.group();
    if (!g) return null;
    return g.components.find((c) => c.id === g.primaryComponentId) ?? g.components[0] ?? null;
  });

  protected readonly dbComponents = computed(() =>
    (this.group()?.components ?? []).filter((c) => databaseEngineOf(c)),
  );
  protected readonly extraDbApps = computed(() =>
    this.dbComponents().filter((c) => c.id !== this.primary()?.id),
  );

  protected readonly rawUrl = computed(() => this.group()?.url ?? this.primary()?.url ?? '');

  protected readonly accessKind = computed<'db' | 'web' | 'none'>(() => {
    const p = this.primary();
    if (!p) return 'none';
    if (databaseEngineOf(p)) return 'db';
    if (this.rawUrl()) return 'web';
    return 'none';
  });

  protected readonly endpointHost = computed(() => {
    const url = this.rawUrl();
    if (!url) return '';
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  });

  protected readonly webEndpoint = computed(() => {
    const raw = this.rawUrl();
    if (!raw) return null;
    let host: string;
    try {
      host = new URL(raw).hostname;
    } catch {
      host = raw.replace(/^https?:\/\//, '').split('/')[0];
    }
    return this.endpointsService.endpoints().find((e) => e.fqdn === host) ?? null;
  });

  protected readonly openUrl = computed(() => {
    const raw = this.rawUrl();
    if (!raw) return '';
    const ep = this.webEndpoint();
    if (ep && !ep.tlsEnabled) return raw.replace(/^https:\/\//i, 'http://');
    return raw;
  });

  protected readonly imageRef = computed(() => this.primary()?.imageRef ?? '');

  protected readonly facts = computed<RecapFact[]>(() => {
    const p = this.primary();
    if (!p || this.group()?.type !== 'standalone') return [];
    const list: RecapFact[] = [
      { label: 'Type', value: this.kindLabel(p.kind) },
      { label: 'Source', value: getSourceTypeLabel(p.sourceType) },
      { label: 'Cluster', value: this.clusterName() || '—' },
      { label: 'Exposure', value: this.titleCase(p.exposure) },
      { label: 'Replicas', value: String(p.replicas ?? 0) },
      { label: 'Namespace', value: p.k8sNamespace || '—' },
    ];
    if (p.catalogVersion) list.push({ label: 'Version', value: `v${p.catalogVersion}` });
    return list;
  });

  protected readonly clusterName = computed(() => {
    const clusterId = this.group()?.clusterId;
    if (!clusterId) return '';
    return this.clusterService.clusters().find((c) => c.id === clusterId)?.name ?? '';
  });

  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new AppRecapSurfaceRevision();

  /** Reads the same computeds the card renders. `connInfo()`, `endpointHost()`, `imageRef()`
   * and the Namespace fact are deliberately not among them — see app-recap-surface.ts. */
  private readonly surfaceInput = computed<AppRecapSurfaceInput>(() => {
    const g = this.group();
    const p = this.primary();
    return {
      groupId: this.id(),
      group: g
        ? {
            id: g.id,
            name: g.name,
            type: g.type,
            status: g.status,
            category: g.category,
            createdAt: g.createdAt,
            clusterId: g.clusterId,
            clusterName: this.clusterName() || undefined,
          }
        : null,
      primary: p
        ? {
            id: p.id,
            slug: p.slug,
            kindLabel: this.kindLabel(p.kind),
            sourceLabel: getSourceTypeLabel(p.sourceType),
            exposure: p.exposure,
            replicas: p.replicas ?? 0,
            catalogVersion: p.catalogVersion,
          }
        : null,
      accessKind: this.accessKind(),
      notFound: this.loadAttempted() && !g,
      isLoading: !this.loadAttempted(),
      extraDatabases: this.extraDbApps().map((db) => ({ id: db.id, name: db.name, status: db.status })),
    };
  });

  protected readonly surface = computed(() => {
    const input = this.surfaceInput();
    return buildAppRecapSurface(input, {
      revision: this.surfaceRevision.next(appRecapPresentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  constructor() {
    // Publish this page's snapshot whenever it changes; ngOnDestroy clears it so it never
    // outlives the page it describes.
    effect(() => {
      this.currentSurface.set(this.surface());
    });

    effect(() => {
      for (const db of this.dbComponents()) {
        if (this.connRequested.has(db.id)) continue;
        this.connRequested.add(db.id);
        void this.loadConnInfo(db.id);
      }
    });

    // `connRequested` fetches each app's connection info once, so a mask-mode
    // toggle mid-visit would leave the connect card rendering the host string
    // fetched under the previous state. Clear the cache and re-request.
    let first = true;
    effect(() => {
      this.maskMode.enabled();
      if (first) {
        first = false;
        return;
      }
      this.connRequested.clear();
      this.connInfo.set({});
      for (const db of this.dbComponents()) {
        this.connRequested.add(db.id);
        void this.loadConnInfo(db.id);
      }
    });
  }

  ngOnInit(): void {
    void (async () => {
      if (this.appService.applications().length === 0 || !this.group()) {
        try {
          await this.appService.loadApplications();
        } catch {
          return;
        }
      }
      this.loadAttempted.set(true);
      const clusterId = this.group()?.clusterId;
      if (clusterId && this.rawUrl()) {
        void this.endpointsService.loadEndpoints(clusterId);
      }
    })();
  }

  private async loadConnInfo(appId: string): Promise<void> {
    try {
      const info = await firstValueFrom(this.dbConsole.getConnectionInfo(appId));
      this.connInfo.update((m) => ({ ...m, [appId]: info }));
    } catch {
      return;
    }
  }

  private kindLabel(kind: ApplicationKind): string {
    switch (kind) {
      case ApplicationKindEnum.Database:
        return 'Database';
      case ApplicationKindEnum.Tool:
        return 'Tool';
      case ApplicationKindEnum.System:
        return 'System';
      default:
        return 'Application';
    }
  }

  private titleCase(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  protected statusBadge(status: ApplicationStatus): string {
    return getStatusBadgeClass(status);
  }

  protected statusText(status: ApplicationStatus): string {
    return getStatusLabel(status);
  }

  protected formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }
}
