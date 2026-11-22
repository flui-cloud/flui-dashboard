import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { TemplateService } from '../../service/template.service';
import { RepositoryService } from '../../service/repository.service';
import { ClusterService } from '../../service/cluster.service';
import { TemplateResponseDto } from '../../../core/api/model/templateResponseDto';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlSearchInput, FlSegmented, FlToolbar } from '../../../ui/patterns/filter-bar';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import {
  TemplatesCatalogSurfaceInput,
  TemplatesCatalogSurfaceRevision,
  buildTemplatesCatalogSurface,
  presentedContent,
} from './templates-catalog-surface';
import {
  CATEGORY_FILTERS,
  TemplateCategory,
  filterTemplates,
  templateCategory,
} from './templates-catalog-rows';
import { TemplatesCatalogTable } from './templates-catalog-table';

@Component({
  selector: 'app-templates-catalog',
  imports: [
    FlAlert,
    FlButton,
    FlEmptyState,
    FlIcon,
    FlLoadingState,
    FlPageHeader,
    FlPanel,
    FlSearchInput,
    FlSegmented,
    FlToolbar,
    TemplatesCatalogTable,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  template: `
    <div class="fl-page">
      <fl-page-header [title]="'Templates (' + totalCount() + ')'">
        <span headerMeta>
          Production-ready Dockerfiles per framework. Start a repository from one and deploy it.
        </span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            [disabled]="isLoading()"
            (click)="refreshTemplates()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </fl-page-header>

      @if (templateService.errorMessage()) {
        <fl-alert tone="error" title="Could not load the templates">
          {{ templateService.errorMessage() }}
        </fl-alert>
      }

      <fl-panel [flush]="true">
        <fl-toolbar panelToolbar>
          <fl-search-input
            label="Search templates"
            placeholder="Search frameworks"
            [(value)]="searchQuery"
          />
          <fl-segmented
            label="Category"
            [options]="categoryFilters"
            [value]="categoryFilter()"
            (valueChange)="setCategory($event)"
          />
          <span toolbarEnd class="fl-toolbar__info">
            {{ filteredTemplates().length }}
            {{ filteredTemplates().length === 1 ? 'template' : 'templates' }}
          </span>
        </fl-toolbar>

        @if (isLoading()) {
          <fl-loading-state [rows]="5" />
        } @else if (filteredTemplates().length === 0) {
          <fl-empty-state title="No templates found" body="Try another search or category." />
        } @else {
          <app-templates-catalog-table
            [rows]="filteredTemplates()"
            [highlighted]="highlightedFramework()"
            [canUse]="repositoryService.hasRepoScope()"
            [disabledReason]="disabledTooltip()"
            (useTemplate)="openUseTemplate($event)"
          />
        }
      </fl-panel>
    </div>
  `,
})
export class TemplatesCatalogComponent implements OnInit, OnDestroy {
  templateService = inject(TemplateService);
  repositoryService = inject(RepositoryService);
  private readonly clusterService = inject(ClusterService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly currentSurface = inject(CurrentSurfaceService);

  searchQuery = signal('');
  categoryFilter = signal<'' | TemplateCategory>('');
  highlightedFramework = signal<string | null>(null);

  isLoading = this.templateService.loading;

  protected readonly categoryFilters = CATEGORY_FILTERS;

  disabledTooltip = computed(() =>
    this.repositoryService.setupStatus()?.authMethod === 'github_app'
      ? 'Install the Flui GitHub App first'
      : 'Connect GitHub with the repo scope first',
  );

  filteredTemplates = computed(() =>
    filterTemplates(this.templateService.templates(), this.searchQuery(), this.categoryFilter()),
  );

  protected readonly totalCount = computed(
    () => this.templateService.templates().filter((t) => !t.isDeprecated).length,
  );

  getCategory(template: TemplateResponseDto): TemplateCategory {
    return templateCategory(template);
  }

  private readonly surfaceRevision = new TemplatesCatalogSurfaceRevision();

  readonly surface = computed(() => {
    const input: TemplatesCatalogSurfaceInput = {
      allTemplates: this.templateService.templates(),
      filteredTemplates: this.filteredTemplates(),
      categoryOf: (template) => this.getCategory(template),
      categoryFilter: this.categoryFilter(),
      hasActiveSearch: this.searchQuery().trim().length > 0,
      highlightedFramework: this.highlightedFramework(),
      isLoading: this.isLoading(),
      hasLoadError: !!this.templateService.errorMessage(),
    };
    return buildTemplatesCatalogSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  ngOnInit(): void {
    void (async () => {
      const fw = this.route.snapshot.queryParamMap.get('framework');
      if (fw) this.highlightedFramework.set(fw);

      await Promise.allSettled([
        this.loadTemplates(),
        this.repositoryService.checkSetupStatus(),
        this.repositoryService.checkOAuthStatus(),
        this.clusterService.loadClusters(),
      ]);
    })();
  }

  protected setCategory(value: string): void {
    this.categoryFilter.set(value as '' | TemplateCategory);
  }

  openUseTemplate(template: TemplateResponseDto): void {
    if (!this.repositoryService.hasRepoScope()) return;
    this.router.navigate(['/apps/deploy/new'], {
      queryParams: { template: template.framework },
    });
  }

  async loadTemplates(): Promise<void> {
    try {
      await this.templateService.loadTemplates();
    } catch {
      return;
    }
  }

  async refreshTemplates(): Promise<void> {
    await this.loadTemplates();
  }
}
