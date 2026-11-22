import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideStore } from '@ng-icons/lucide';
import { CatalogService } from '../../service/catalog.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { InstallPromptService } from '../../../core/services/install-prompt.service';
import { CatalogResponseDto } from '../../../core/api/model/models';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlErrorState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import {
  CatalogScope,
  CatalogSection,
  SECTION_LABEL,
  SECTION_ORDER,
  catalogScopeOf,
  catalogSectionOf,
  inCatalogScope,
  scopeCopy,
} from './catalog-scope';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  CatalogListSurfaceInput,
  CatalogListSurfaceRevision,
  buildCatalogListSurface,
  presentedContent as catalogListPresentedContent,
} from './catalog-list-surface';
import { CatalogListToolbar } from './catalog-list-toolbar';
import { CatalogListTable, CatalogRow, CatalogRowGroup } from './catalog-list-table';
import { installQueryParams } from './catalog-view';

const SHOW_SYSTEM_APPS_KEY = 'sidebar:showSystemApps';

interface CatalogSectionGroup {
  kind: CatalogSection;
  label: string;
  apps: CatalogResponseDto[];
}

@Component({
  selector: 'app-catalog-list',
  imports: [
    FlPageHeader,
    FlPanel,
    FlEmptyState,
    FlErrorState,
    FlLoadingState,
    FlButton,
    FlIcon,
    CatalogListToolbar,
    CatalogListTable,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideStore })],
  template: `
    <div class="fl-page">
      <fl-page-header
        [title]="heroTitle() + ' (' + availableCount() + ')'"
        [breadcrumb]="breadcrumb()"
      >
        <span headerMeta>{{ heroSubtitle() }}</span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            [disabled]="catalog.listLoading()"
            (click)="reload()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </fl-page-header>

      <fl-panel [flush]="true">
        <app-catalog-list-toolbar
          panelToolbar
          [search]="searchQuery()"
          [category]="activeCategory()"
          [categories]="categories()"
          [tags]="tags()"
          [activeTags]="activeTags()"
          [resultCount]="filteredApps().length"
          [systemToggle]="!scope()"
          [showSystemApps]="showSystemApps()"
          (searchChange)="searchQuery.set($event)"
          (categoryChange)="setCategory($event)"
          (tagToggle)="toggleTag($event)"
          (tagsClear)="clearTags()"
          (systemToggled)="toggleShowSystemApps()"
        />
        @if (catalog.listLoading()) {
          <fl-loading-state [rows]="6" />
        } @else if (catalog.listError()) {
          <fl-error-state
            title="Could not load the catalog"
            [reason]="catalog.listError()"
            (retry)="reload()"
          />
        } @else if (filteredApps().length === 0) {
          <fl-empty-state
            icon="lucideStore"
            title="No apps match your filters"
            body="Try a broader search or clear a tag."
          >
            @if (hasActiveFilters()) {
              <button flButton size="sm" type="button" (click)="resetFilters()">
                Reset filters
              </button>
            }
          </fl-empty-state>
        } @else {
          <app-catalog-list-table
            [groups]="tableGroups()"
            [grouped]="!flatGrid()"
            (install)="goToInstall($event)"
          />
        }
      </fl-panel>
    </div>
  `,
})
export class CatalogListComponent implements OnDestroy {
  protected readonly catalog = inject(CatalogService);
  private readonly sandbox = inject(SandboxService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly installPrompt = inject(InstallPromptService);

  readonly appKind = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly scope = computed<CatalogScope | null>(() => catalogScopeOf(this.appKind()));

  readonly heroTitle = computed(() => scopeCopy(this.scope())?.title ?? 'App catalog');

  readonly heroSubtitle = computed(
    () =>
      scopeCopy(this.scope())?.subtitle ??
      'Curated open-source apps. Pick one, choose a cluster, and Flui handles secrets, DNS and TLS.',
  );

  readonly flatGrid = computed(() => this.scope() === 'data' || this.scope() === 'system');

  readonly backLink = computed<string | null>(() => scopeCopy(this.scope())?.back ?? null);

  protected readonly breadcrumb = computed<Crumb[]>(() => {
    const copy = scopeCopy(this.scope());
    if (!copy) return [];
    return [{ label: copy.backLabel, link: copy.back }, { label: copy.title }];
  });

  readonly searchQuery = signal('');
  readonly activeCategory = signal<string | null>(null);
  readonly activeTags = signal<string[]>([]);
  readonly showSystemApps = signal<boolean>(this.readShowSystemApps());

  private readShowSystemApps(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(SHOW_SYSTEM_APPS_KEY) === 'true';
  }

  toggleShowSystemApps(): void {
    const next = !this.showSystemApps();
    this.showSystemApps.set(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SHOW_SYSTEM_APPS_KEY, String(next));
    }
  }

  readonly categories = this.catalog.categories;
  readonly tags = this.catalog.tags;

  readonly hasActiveFilters = computed(
    () =>
      this.searchQuery().trim() !== '' ||
      this.activeCategory() !== null ||
      this.activeTags().length > 0,
  );

  protected readonly availableCount = computed(() => {
    const scope = this.scope();
    const excluded = this.sandbox.catalogExcluded();
    return this.catalog
      .catalog()
      .filter((app) => !excluded.has(app.slug) && (!scope || inCatalogScope(app, scope))).length;
  });

  readonly filteredApps = computed<CatalogResponseDto[]>(() => {
    const all = this.catalog.catalog();
    const query = this.searchQuery().trim().toLowerCase();
    const category = this.activeCategory();
    const tags = this.activeTags();
    const scope = this.scope();
    const excluded = this.sandbox.catalogExcluded();

    return all.filter((app) => {
      if (excluded.has(app.slug)) return false;
      if (scope && !inCatalogScope(app, scope)) return false;
      if (category && app.category !== category) return false;
      if (tags.length > 0 && !tags.every((t) => app.tags?.includes(t))) return false;
      if (query) {
        const haystack = [
          app.name,
          app.slug,
          app.description ?? '',
          ...(app.alternativeTo ?? []),
          ...(app.tags ?? []),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  });

  readonly kindGroups = computed<CatalogSectionGroup[]>(() => {
    const showSystem = this.showSystemApps();
    const buckets = new Map<CatalogSection, CatalogResponseDto[]>();
    for (const app of this.filteredApps()) {
      const kind = catalogSectionOf(app);
      if (kind === 'system' && !showSystem) continue;
      const bucket = buckets.get(kind);
      if (bucket) {
        bucket.push(app);
      } else {
        buckets.set(kind, [app]);
      }
    }
    return SECTION_ORDER.filter((k) => buckets.has(k)).map((k) => ({
      kind: k,
      label: SECTION_LABEL[k],
      apps: buckets.get(k)!,
    }));
  });

  private rowOf(app: CatalogResponseDto): CatalogRow {
    return {
      app,
      installedCount: this.catalog.getInstalledFor(app.slug).length,
      updateAvailable: this.catalog.hasUpdateAvailable(app.slug, app.version),
    };
  }

  protected readonly tableGroups = computed<CatalogRowGroup[]>(() => {
    const scoped = this.scope();
    if (scoped && this.flatGrid()) {
      return [
        {
          kind: scoped,
          label: SECTION_LABEL[scoped],
          rows: this.filteredApps().map((a) => this.rowOf(a)),
        },
      ];
    }
    return this.kindGroups().map((g) => ({
      kind: g.kind,
      label: g.label,
      rows: g.apps.map((a) => this.rowOf(a)),
    }));
  });

  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new CatalogListSurfaceRevision();

  private readonly surfaceInput = computed<CatalogListSurfaceInput>(() => ({
    heroTitle: this.heroTitle(),
    scopedKind: this.scope(),
    hasQuery: this.searchQuery().trim() !== '',
    activeCategory: this.activeCategory(),
    activeTagCount: this.activeTags().length,
    showSystemApps: this.showSystemApps(),
    totalCount: this.catalog.catalog().length,
    shownCount: this.filteredApps().length,
    groups: this.tableGroups().map((g) => ({
      kind: g.kind,
      label: g.label,
      rows: g.rows.map((r) => ({
        slug: r.app.slug,
        name: r.app.name,
        category: r.app.category,
        installedCount: r.installedCount,
        updateAvailable: r.updateAvailable,
      })),
    })),
    isLoading: this.catalog.listLoading(),
    hasListError: Boolean(this.catalog.listError()),
  }));

  readonly surface = computed(() => {
    const input = this.surfaceInput();
    return buildCatalogListSurface(input, {
      revision: this.surfaceRevision.next(catalogListPresentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });

    effect(() => {
      const cat = this.activeCategory();
      queueMicrotask(() => this.catalog.loadCatalog({ category: cat ?? undefined }));
    });
    queueMicrotask(() => this.catalog.ensureApplicationsLoaded());
  }

  reload(): void {
    this.catalog.loadCatalog({ category: this.activeCategory() ?? undefined });
  }

  setCategory(cat: string | null): void {
    this.activeCategory.set(cat);
  }

  toggleTag(tag: string): void {
    this.activeTags.update((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  }

  clearTags(): void {
    this.activeTags.set([]);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.activeCategory.set(null);
    this.activeTags.set([]);
  }

  goToInstall(slug: string): void {
    const autoConnectTo = this.route.snapshot.queryParamMap.get('autoConnectTo');
    const install = this.router.createUrlTree(['/apps/deploy/new'], {
      queryParams: installQueryParams(slug, autoConnectTo),
    });
    if (this.installPrompt.requireInstall()) return;
    void this.router.navigateByUrl(install);
  }
}
