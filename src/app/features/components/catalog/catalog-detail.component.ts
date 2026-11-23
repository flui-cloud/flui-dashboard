import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { CatalogService } from '../../service/catalog.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { InstallPromptService } from '../../../core/services/install-prompt.service';
import { Application } from '../../model/application.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlTag } from '../../../ui/primitives/tag';
import { CatalogIconComponent } from './catalog-icon.component';
import { CatalogManifestTabComponent } from './catalog-manifest-tab.component';
import { CatalogDetailConfig } from './catalog-detail-config';
import { CatalogDetailInstances } from './catalog-detail-instances';
import { CatalogDetailOverview } from './catalog-detail-overview';
import {
  CatalogLinks,
  DETAIL_TABS,
  DetailTab,
  categoryLabel,
  installQueryParams,
  linksOf,
} from './catalog-view';
import {
  CatalogDetailSurfaceInput,
  CatalogDetailSurfaceRevision,
  buildCatalogDetailSurface,
  presentedContent as catalogDetailPresentedContent,
} from './catalog-detail-surface';

@Component({
  selector: 'app-catalog-detail',
  imports: [
    FlAlert,
    FlPageHeader,
    FlPanel,
    FlLoadingState,
    FlButton,
    FlTag,
    CatalogIconComponent,
    CatalogManifestTabComponent,
    CatalogDetailConfig,
    CatalogDetailInstances,
    CatalogDetailOverview,
  ],
  template: `
    @let app = detail();
    <div class="fl-page">
      <fl-page-header [title]="app?.name ?? slug() ?? 'App'" [breadcrumb]="breadcrumb()">
        @if (app) {
          <fl-tag headerStatus>{{ categoryLabel(app.category) }}</fl-tag>
        }
        @if (app) {
          <span headerMeta class="inline-flex items-center gap-2">
            <app-catalog-icon
              [slug]="app.slug"
              [name]="app.name"
              [iconUrl]="app.iconUrl"
              size="xs"
            />
            <span class="fl-mono">{{ app.version }}</span>
          </span>
        }
        @if (app?.license) {
          <span headerMeta>{{ app?.license }}</span>
        }
        @if (app && !excludedInTrial()) {
          <button flButton="primary" headerActions type="button" (click)="goToInstall(app.slug)">
            Install
          </button>
        }
      </fl-page-header>

      @if (catalog.detailLoading()) {
        <fl-panel><fl-loading-state [rows]="6" /></fl-panel>
      } @else if (catalog.detailError()) {
        <fl-alert tone="error" title="Could not load the app">{{ catalog.detailError() }}</fl-alert>
      } @else if (app) {
        @if (excludedInTrial()) {
          <fl-alert tone="info" title="Not part of the trial" data-testid="trial-excluded"
            >Available on your own Flui or the managed offer.</fl-alert
          >
        }

        @if (installedInstances().length > 0) {
          <app-catalog-detail-instances
            [instances]="installedInstances()"
            [updateAvailable]="updateAvailable()"
            [version]="app.version"
          />
        }

        <div
          class="fl-tabs"
          role="tablist"
          aria-label="App sections"
          (keydown)="onTabKeydown($event)"
        >
          @for (t of tabs; track t.key) {
            <button
              type="button"
              role="tab"
              class="fl-tab"
              [id]="'catalog-tab-' + t.key"
              aria-controls="catalog-tab-panel"
              [attr.aria-selected]="activeTab() === t.key"
              [attr.tabindex]="activeTab() === t.key ? 0 : -1"
              (click)="setTab(t.key)"
            >
              {{ t.label }}
            </button>
          }
        </div>

        <div
          id="catalog-tab-panel"
          role="tabpanel"
          class="fl-stack"
          [attr.aria-labelledby]="'catalog-tab-' + activeTab()"
        >
          @switch (activeTab()) {
            @case ('description') {
              <app-catalog-detail-overview [app]="app" />
            }
            @case ('configuration') {
              <app-catalog-detail-config [app]="app" />
            }
            @case ('manifest') {
              <app-catalog-manifest-tab [slug]="app.slug" />
            }
          }
        </div>
      }
    </div>
  `,
})
export class CatalogDetailComponent implements OnDestroy {
  protected readonly categoryLabel = categoryLabel;
  protected readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly installPrompt = inject(InstallPromptService);
  private readonly sandbox = inject(SandboxService);

  protected readonly detail = this.catalog.detail;
  protected readonly excludedInTrial = computed(() => {
    const slug = this.detail()?.slug;
    return !!slug && this.sandbox.catalogExcluded().has(slug);
  });
  protected readonly activeTab = signal<DetailTab>('description');

  protected readonly tabs = DETAIL_TABS;

  protected readonly links = computed<CatalogLinks>(() => linksOf(this.detail()?.links));

  protected readonly installedInstances = computed<Application[]>(() => {
    const slug = this.detail()?.slug;
    return this.catalog.getInstalledFor(slug);
  });

  protected readonly updateAvailable = computed(() => {
    const app = this.detail();
    return app ? this.catalog.hasUpdateAvailable(app.slug, app.version) : false;
  });

  protected readonly slug = toSignal(this.route.paramMap.pipe(map((p) => p.get('slug'))), {
    initialValue: this.route.snapshot.paramMap.get('slug'),
  });

  private readonly returnTo = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('returnTo'))),
    { initialValue: this.route.snapshot.queryParamMap.get('returnTo') },
  );

  protected readonly backLink = computed(() => this.returnTo() || '/apps/catalog');
  protected readonly backLabel = computed(() => (this.returnTo() ? 'Back' : 'App catalog'));

  protected readonly breadcrumb = computed<Crumb[]>(() => [
    { label: this.backLabel(), link: this.backLink() },
    { label: this.detail()?.name ?? this.slug() ?? 'App' },
  ]);

  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new CatalogDetailSurfaceRevision();

  private readonly surfaceInput = computed<CatalogDetailSurfaceInput>(() => {
    const app = this.detail();
    const links = this.links();
    return {
      slug: this.slug(),
      detail: app
        ? {
            slug: app.slug,
            name: app.name,
            version: app.version,
            license: app.license,
            category: app.category,
            alternativeCount: app.alternativeTo.length,
            tagCount: app.tags.length,
            hasWebsite: Boolean(links.website),
            hasDocs: Boolean(links.docs),
            hasSource: Boolean(links.source),
            promptCount: app.userInputPrompts.length,
            sensitivePromptCount: app.userInputPrompts.filter((p) => p.sensitive).length,
            editableEnvCount: app.editableEnv.length,
          }
        : null,
      isLoading: this.catalog.detailLoading(),
      hasDetailError: Boolean(this.catalog.detailError()),
      activeTab: this.activeTab(),
      instances: this.installedInstances().map((i) => ({
        id: i.id,
        name: i.name,
        status: i.status,
        catalogVersion: i.catalogVersion,
      })),
      updateAvailable: this.updateAvailable(),
    };
  });

  protected readonly surface = computed(() => {
    const input = this.surfaceInput();
    return buildCatalogDetailSurface(input, {
      revision: this.surfaceRevision.next(catalogDetailPresentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug) this.catalog.loadDetail(slug);
    });
    queueMicrotask(() => this.catalog.ensureApplicationsLoaded());

    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.catalog.resetDetail();
    this.currentSurface.set(null);
  }

  setTab(tab: DetailTab): void {
    this.activeTab.set(tab);
  }

  protected onTabKeydown(event: KeyboardEvent): void {
    const count = this.tabs.length;
    const current = this.tabs.findIndex((t) => t.key === this.activeTab());
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (current + 1) % count;
        break;
      case 'ArrowLeft':
        next = (current - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const tab = this.tabs[next];
    this.setTab(tab.key);
    document.getElementById('catalog-tab-' + tab.key)?.focus();
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
