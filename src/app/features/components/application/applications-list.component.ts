import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideLoader, lucidePackage, lucideRefreshCw, lucideRocket } from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { ClusterService } from '../../service/cluster.service';
import { ProvidersService } from '../../service/providers.service';
import { ProjectsService } from '../../service/projects.service';
import { FleetService } from '../../service/fleet.service';
import { ApplicationMetricsService } from '../../../core/api/api/applicationMetrics.service';
import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import { AppGroupView, ApplicationKind, ApplicationKindEnum, getKindLabel } from '../../model/application.models';
import { ClusterStatus } from '../../model/cluster.models';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { accessOf } from '../../model/app-access';
import {
  ApplicationsListSurfaceInput,
  ApplicationsListSurfaceRevision,
  buildApplicationsListSurface,
  presentedContent,
} from './applications-list-surface';
import { ListFilters, ListRow, buildListRow, matchesView, primaryOf, sortRows, viewCounts } from './applications-list-rows';
import { EMPTY_FILTERS, activeFilterCount, deployTarget, kindCopy, listSummary, providerName } from './applications-list-kind';
import { ApplicationsListShowcaseComponent } from './applications-list-showcase.component';
import { ApplicationsListTableComponent } from './applications-list-table.component';
import { ApplicationsListToolbarComponent } from './applications-list-toolbar.component';

@Component({
  selector: 'app-applications-list',
  standalone: true,
  imports: [NgIconComponent, ApplicationsListToolbarComponent, ApplicationsListTableComponent, ApplicationsListShowcaseComponent],
  providers: [provideIcons({ lucideRefreshCw, lucidePackage, lucideLoader, lucideCircleAlert, lucideRocket })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="space-y-5 p-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-foreground">{{ pageTitle() }}</h1>
          <p class="mt-1 text-sm text-muted-foreground" data-testid="apps-summary">{{ summary() }}</p>
        </div>
        <div class="flex items-center gap-3">
          @if (isBackgroundRefreshing()) {
            <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
              Syncing...
            </span>
          }
          <button
            (click)="refreshApplications()"
            [disabled]="isLoading()"
            class="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 text-sm"
          >
            <ng-icon name="lucideRefreshCw" class="h-4 w-4" [class.animate-spin]="isLoading()" />
            Refresh
          </button>
          @if (canDeploy()) {
            <button
              (click)="deployNewApp()"
              class="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <ng-icon name="lucideRocket" class="h-4 w-4" />
              {{ ctaLabel() }}
            </button>
          }
        </div>
      </div>

      <app-applications-list-toolbar
        [filters]="filtersState()"
        [counts]="counts()"
        [backupKnown]="coverageById() !== null"
        [clusterOptions]="clusterOptions()"
        [projectOptions]="projectOptions()"
        (filterChange)="updateFilter($event.field, $event.value)"
      />

      @if (errorMessage() && !isLoading()) {
        <div class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <ng-icon name="lucideCircleAlert" class="h-4 w-4 text-destructive" />
          <p class="text-sm text-foreground">{{ errorMessage() }}</p>
        </div>
      }

      @if (isInitialLoading()) {
        <div class="flex flex-col gap-1">
          @for (i of skeletonRows; track i) {
            <div class="skeleton h-14"></div>
          }
        </div>
      } @else if (ownRows().length === 0) {
        <div class="flex flex-col items-center justify-center py-16">
          <ng-icon name="lucidePackage" class="h-12 w-12 text-muted-foreground/50 mb-3" />
          <p class="text-sm font-medium text-foreground mb-1">{{ emptyTitle() }}</p>
          <p class="text-xs text-muted-foreground mb-4">
            @if (activeFiltersCount() > 0) {
              Nothing matches these filters.
              <button type="button" (click)="clearFilters()" class="text-primary hover:underline">Clear filters</button>
            } @else {
              {{ emptySubtitle() }}
            }
          </p>
          @if (activeFiltersCount() === 0 && canDeploy()) {
            <button
              (click)="deployNewApp()"
              class="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
            >
              <ng-icon name="lucideRocket" class="h-4 w-4" />
              {{ ctaLabel() }}
            </button>
          }
        </div>
      } @else {
        <app-applications-list-table [rows]="ownRows()" (open)="openRecap($event)" />
      }

      @if (showcaseRows().length > 0) {
        <app-applications-list-showcase
          [rows]="showcaseRows()"
          [readOnly]="showcaseReadOnly()"
          [why]="showcaseWhy()"
          (open)="openRecap($event)"
        />
      }
    </div>
  `,
})

export class ApplicationsListComponent implements OnInit, OnDestroy {
  private readonly appService = inject(ApplicationService);
  private readonly clusterService = inject(ClusterService);
  private readonly providers = inject(ProvidersService);
  private readonly projects = inject(ProjectsService);
  private readonly fleet = inject(FleetService);
  private readonly metricsApi = inject(ApplicationMetricsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly sandbox = inject(SandboxService);

  readonly skeletonRows = [1, 2, 3, 4, 5];

  kind = signal<ApplicationKind>(
    (this.route.snapshot.data['kind'] as ApplicationKind | undefined) ??
      ApplicationKindEnum.Application,
  );
  filtersState = signal<ListFilters>(EMPTY_FILTERS);

  allApplications = this.appService.applications;
  isLoading = this.appService.loading;
  isBackgroundRefreshing = this.appService.backgroundRefreshing;
  errorMessage = this.appService.errorMessage;

  private readonly usage = signal<ReadonlyMap<string, AppMetricsDto>>(new Map());

  pageTitle = computed(() => getKindLabel(this.kind()));
  canDeploy = computed(() => this.kind() !== ApplicationKindEnum.System);
  private readonly copy = computed(() => kindCopy(this.kind()));
  ctaLabel = computed(() => this.copy().cta);
  emptyTitle = computed(() => this.copy().emptyTitle);
  emptySubtitle = computed(() => this.copy().emptySubtitle);

  allGroups = this.appService.applicationGroups;

  kindScopedGroups = computed(() =>
    this.allGroups().filter((g) => this.groupKind(g) === this.kind()),
  );

  /** The counts are the caller's own: the showcase belongs to whoever runs this instance. */
  kindOwnGroups = computed(() =>
    this.kindScopedGroups().filter((g) => !this.isShowcase(g)),
  );

  protected readonly coverageById = computed(() => {
    const coverage = this.fleet.coverage();
    if (this.fleet.coverageState() !== 'ready' || !coverage) return null;
    return new Map(coverage.applications.map((r) => [r.applicationId, r]));
  });

  private readonly rowsById = computed(() => {
    const clusters = new Map(this.clusterService.clusters().map((c) => [c.id, c]));
    const projects = new Map(this.projects.projects().map((p) => [p.id, p]));
    const usage = this.usage();
    const coverage = this.coverageById();
    const now = Date.now();
    const rows = new Map<string, ListRow>();
    for (const g of this.kindScopedGroups()) {
      const cluster = clusters.get(g.clusterId);
      const projectId = this.projectIdOf(g);
      rows.set(
        g.id,
        buildListRow(g, {
          clusterName: cluster?.name ?? '',
          providerName: providerName(cluster?.provider, (id) => this.providers.getProviderById(id)?.displayName),
          project: (projectId && projects.get(projectId)) || null,
          usage,
          coverage,
          now,
        }),
      );
    }
    return rows;
  });

  private rowsOf(groups: AppGroupView[]): ListRow[] {
    const byId = this.rowsById();
    return groups.map((g) => byId.get(g.id)).filter((r): r is ListRow => !!r);
  }

  private readonly ownAllRows = computed(() => this.rowsOf(this.kindOwnGroups()));

  readonly counts = computed(() => viewCounts(this.ownAllRows()));

  kindRunningCount = computed(() => this.counts().running);
  kindFailedCount = computed(
    () => this.kindOwnGroups().filter((g) => g.status === 'failed').length,
  );

  summary = computed(() => listSummary(this.kindOwnGroups(), this.pageTitle()));

  clusterOptions = computed(() => {
    const used = new Set(this.kindScopedGroups().map((g) => g.clusterId));
    return this.clusterService
      .clusters()
      .filter((c) => !!c.id && used.has(c.id))
      .map((c) => ({ id: c.id!, name: c.name ?? c.id! }));
  });

  projectOptions = computed(() => {
    const used = new Set(
      this.kindScopedGroups()
        .map((g) => this.projectIdOf(g))
        .filter((id): id is string => !!id),
    );
    return this.projects.projects().filter((p) => used.has(p.id));
  });

  isInitialLoading = computed(
    () => this.isLoading() && this.allApplications().length === 0,
  );

  filteredGroups = computed(() => {
    const f = this.filtersState();
    const search = f.search.trim().toLowerCase();
    const byId = this.rowsById();
    return this.kindScopedGroups().filter((g) => {
      const row = byId.get(g.id);
      if (!row) return false;
      if (search && !row.searchText.includes(search)) return false;
      if (!matchesView(row, f.view)) return false;
      if (f.cluster && g.clusterId !== f.cluster) return false;
      if (f.project && this.projectIdOf(g) !== f.project) return false;
      return true;
    });
  });

  private projectIdOf(g: AppGroupView): string | null | undefined {
    return g.projectId ?? primaryOf(g)?.projectId;
  }

  /**
   * The showcase is drawn apart from the rest, under its own heading, read off
   * `access.showcase`, which the API decides.
   */
  private isShowcase(g: AppGroupView): boolean {
    return !!accessOf(primaryOf(g))?.showcase;
  }

  ownGroups = computed(() =>
    this.filteredGroups().filter((g) => !this.isShowcase(g)),
  );
  showcaseGroups = computed(() =>
    this.filteredGroups().filter((g) => this.isShowcase(g)),
  );

  ownRows = computed(() => sortRows(this.rowsOf(this.ownGroups())));
  showcaseRows = computed(() => sortRows(this.rowsOf(this.showcaseGroups())));

  /** "read-only" is a fact about the caller: the operator running these applications may change them. */
  showcaseReadOnly = computed(() =>
    this.showcaseGroups().every((g) => !!accessOf(primaryOf(g))?.readOnly),
  );

  showcaseWhy = computed(() => this.sandbox.whyFor('showcase'));

  private groupKind(g: AppGroupView): ApplicationKind {
    return primaryOf(g)?.kind ?? ApplicationKindEnum.Application;
  }

  activeFiltersCount = computed(() => activeFilterCount(this.filtersState()));

  private readonly surfaceRevision = new ApplicationsListSurfaceRevision();

  readonly surface = computed(() => {
    const input: ApplicationsListSurfaceInput = {
      kind: this.kind(),
      filteredGroups: this.filteredGroups(),
      totalForKind: this.kindScopedGroups().length,
      runningCount: this.kindRunningCount(),
      failedCount: this.kindFailedCount(),
      attentionCount: this.counts().attention,
      noBackupCount: this.coverageById() === null ? null : this.counts().no_backup,
      filters: this.filtersState(),
      activeFiltersCount: this.activeFiltersCount(),
      isInitialLoading: this.isInitialLoading(),
      hasLoadError: !!this.errorMessage() && !this.isLoading(),
    };
    return buildApplicationsListSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnInit(): void {
    if (this.clusterService.clusters().length === 0) {
      this.clusterService.loadClusters().catch(() => undefined);
    }
    if (this.projects.projects().length === 0) this.projects.loadProjects();
    void this.refreshApplications();
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  async refreshApplications() {
    try {
      await this.appService.loadApplications();
    } catch (error) {
      console.error('Failed to refresh applications:', error);
    }
    void this.fleet.loadCoverage();
    void this.loadUsage();
  }

  /** Readings per cluster, as the cluster Monitoring page reads them; a cluster that does not answer leaves its rows at a dash. */
  private async loadUsage(): Promise<void> {
    const status = new Map(this.clusterService.clusters().map((c) => [c.id, c.status]));
    const ids = [...new Set(this.kindScopedGroups().map((g) => g.clusterId))].filter((id) => {
      const s = status.get(id);
      return !s || s === ClusterStatus.ACTIVE;
    });
    const results = await Promise.allSettled(
      ids.map((id) => firstValueFrom(this.metricsApi.applicationMetricsControllerGetClusterAppsMetrics(id))),
    );
    const next = new Map<string, AppMetricsDto>();
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const app of r.value.applications ?? []) next.set(app.app_id, app);
    }
    this.usage.set(next);
  }

  updateFilter<K extends keyof ListFilters>(field: K, value: ListFilters[K]) {
    this.filtersState.update((current) => ({ ...current, [field]: value }));
  }

  clearFilters() {
    this.filtersState.set(EMPTY_FILTERS);
  }

  openRecap(groupId: string) {
    this.router.navigate(['/apps/recap', groupId], {
      queryParams: { from: this.copy().listName },
    });
  }

  deployNewApp() {
    const kind = this.kind();
    this.router.navigate([deployTarget(kind)], { queryParams: { appKind: kind } });
  }
}
