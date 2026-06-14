import {
  ChangeDetectionStrategy,
  Component,
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
import { ClusterService } from '../../service/cluster.service';
import { DbConsoleService } from '../../service/db-console.service';
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
    <div class="mx-auto max-w-3xl space-y-6 p-6">
      <a
        [routerLink]="backLink()"
        class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        {{ backLabel() }}
      </a>

      @let g = group();
      @if (g) {
        @let primaryApp = primary();
        <section class="rounded-2xl border border-border bg-card p-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <h1 class="text-xl font-bold text-foreground">{{ g.name }}</h1>
              <p class="text-xs text-muted-foreground">
                {{ primaryApp?.slug ?? g.id }} · Created {{ formatDate(g.createdAt) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span [class]="getCategoryBadgeClass(g.category)">
                {{ getCategoryLabel(g.category) }}
              </span>
              <span [class]="statusBadge(g.status)" class="inline-flex items-center gap-1">
                {{ statusText(g.status) }}
              </span>
            </div>
          </div>

          @if (accessKind() === 'db' && primaryApp) {
            <app-db-connect-card [app]="primaryApp" [connInfo]="connInfoFor(primaryApp.id)" />
          } @else if (accessKind() === 'web' && primaryApp) {
            <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4">
              <div class="min-w-0 flex-1">
                <p class="text-xs uppercase tracking-wide text-muted-foreground">Endpoint</p>
                <p class="mt-0.5 truncate text-sm font-mono">{{ endpointHost() }}</p>
              </div>
              <a
                [href]="openUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium
                       text-primary-foreground hover:bg-primary/90"
              >
                <ng-icon name="lucideRocket" class="h-4 w-4" />
                Open app
                <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
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
export class AppRecapComponent implements OnInit {
  private readonly appService = inject(ApplicationService);
  private readonly clusterService = inject(ClusterService);
  private readonly dbConsole = inject(DbConsoleService);
  private readonly route = inject(ActivatedRoute);

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

  protected readonly openUrl = computed(() => this.group()?.url ?? this.primary()?.url ?? '');

  protected readonly accessKind = computed<'db' | 'web' | 'none'>(() => {
    const p = this.primary();
    if (!p) return 'none';
    if (databaseEngineOf(p)) return 'db';
    if (this.openUrl()) return 'web';
    return 'none';
  });

  protected readonly endpointHost = computed(() => {
    const url = this.openUrl();
    if (!url) return '';
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
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

  constructor() {
    effect(() => {
      for (const db of this.dbComponents()) {
        if (this.connRequested.has(db.id)) continue;
        this.connRequested.add(db.id);
        void this.loadConnInfo(db.id);
      }
    });
  }

  ngOnInit(): void {
    void (async () => {
      if (this.appService.applications().length === 0) {
        try {
          await this.appService.loadApplications();
        } catch {
          return;
        }
      }
      this.loadAttempted.set(true);
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
