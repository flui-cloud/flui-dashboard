import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideCircleAlert,
  lucideExternalLink,
  lucideFileText,
  lucideGithub,
  lucideGlobe,
  lucideRocket,
  lucideSettings,
  lucideStar,
} from '@ng-icons/lucide';
import { CatalogService } from '../../service/catalog.service';
import { CatalogIconComponent } from './catalog-icon.component';
import { CatalogManifestTabComponent } from './catalog-manifest-tab.component';
import { Application } from '../../model/application.models';

type DetailTab = 'description' | 'configuration' | 'install' | 'manifest';

interface Links {
  website?: string;
  docs?: string;
  source?: string;
}

interface Ratings {
  wow?: number;
  utility?: number;
  euFit?: number;
  community?: number;
}

@Component({
  selector: 'app-catalog-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIcon, CatalogIconComponent, CatalogManifestTabComponent],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideCheck,
      lucideCircleAlert,
      lucideExternalLink,
      lucideFileText,
      lucideGithub,
      lucideGlobe,
      lucideRocket,
      lucideSettings,
      lucideStar,
    }),
  ],
  template: `
    <div class="mx-auto max-w-5xl space-y-6 p-6">
      <a
        [routerLink]="backLink()"
        class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        {{ backLabel() }}
      </a>

      @let app = detail();
      @if (catalog.detailLoading()) {
        <div class="h-56 animate-pulse rounded-2xl border border-border bg-muted/30"></div>
      } @else if (catalog.detailError()) {
        <div
          class="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center"
        >
          <ng-icon name="lucideCircleAlert" class="h-8 w-8 text-destructive" />
          <p class="text-sm text-destructive">{{ catalog.detailError() }}</p>
        </div>
      } @else if (app) {
        <!-- Hero -->
        <section class="rounded-2xl border border-border bg-card p-6 md:p-8">
          <div class="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
            <app-catalog-icon
              [slug]="app.slug"
              [name]="app.name"
              [iconUrl]="app.iconUrl"
              size="xl"
            />
            <div class="min-w-0 flex-1 space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  {{ app.name }}
                </h1>
                <span
                  class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  v{{ app.version }}
                </span>
                <span
                  class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize text-primary"
                >
                  {{ app.category }}
                </span>
                @if (app.license) {
                  <span class="text-xs text-muted-foreground">{{ app.license }}</span>
                }
                @if (app.clientFor.length) {
                  <span
                    class="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-300"
                    [title]="app.clientFor.length > 1 ? 'Compatible with ' + app.clientFor.length + ' building blocks' : ''"
                  >
                    🔌 Compatible with {{ app.clientFor.join(' · ') }}
                  </span>
                }
              </div>

              @if (app.description) {
                <p class="max-w-2xl text-sm text-muted-foreground md:text-base">
                  {{ app.description }}
                </p>
              }

              @if (app.alternativeTo.length) {
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-xs uppercase tracking-wide text-muted-foreground">
                    Alternative to
                  </span>
                  @for (alt of app.alternativeTo; track alt) {
                    <span
                      class="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium"
                    >
                      {{ alt }}
                    </span>
                  }
                </div>
              }

              <div class="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  (click)="goToInstall(app.slug)"
                  class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium
                         text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  <ng-icon name="lucideRocket" class="h-4 w-4" />
                  Deploy to cluster
                </button>

                @if (links().website) {
                  <a
                    [href]="links().website"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ng-icon name="lucideGlobe" class="h-4 w-4" />
                    Website
                    <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                  </a>
                }
                @if (links().docs) {
                  <a
                    [href]="links().docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ng-icon name="lucideFileText" class="h-4 w-4" />
                    Docs
                    <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                  </a>
                }
                @if (links().source) {
                  <a
                    [href]="links().source"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ng-icon name="lucideGithub" class="h-4 w-4" />
                    Source
                    <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                  </a>
                }
              </div>
            </div>
          </div>
        </section>

        <!-- Your instances -->
        @if (installedInstances().length > 0) {
          <section class="rounded-2xl border border-border bg-card p-5">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <ng-icon name="lucideCheck" class="h-4 w-4 text-emerald-600" />
                <h2 class="text-sm font-semibold text-foreground">
                  Your instances ({{ installedInstances().length }})
                </h2>
              </div>
              @if (updateAvailable()) {
                <span
                  class="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                  title="A newer catalog version is available"
                >
                  Update available · v{{ app.version }}
                </span>
              }
            </div>

            <ul class="mt-3 divide-y divide-border">
              @for (inst of installedInstances(); track inst.id) {
                <li class="flex items-center justify-between gap-3 py-2.5">
                  <div class="min-w-0 flex-1">
                    <a
                      [routerLink]="['/apps/applications', inst.id]"
                      class="truncate text-sm font-medium text-foreground hover:text-primary"
                    >
                      {{ inst.name }}
                    </a>
                    <div class="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span class="font-mono">{{ inst.k8sNamespace }}</span>
                      @if (inst.catalogVersion) {
                        <span>· v{{ inst.catalogVersion }}</span>
                      }
                      <span
                        class="rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize"
                        [class]="statusClass(inst.status)"
                      >
                        {{ inst.status }}
                      </span>
                    </div>
                  </div>
                  <a
                    [routerLink]="['/apps/applications', inst.id]"
                    class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Open
                    <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                  </a>
                </li>
              }
            </ul>
          </section>
        }

        <!-- Tabs -->
        <section>
          <div class="flex items-center gap-1 border-b border-border">
            @for (t of tabs; track t.key) {
              <button
                type="button"
                (click)="setTab(t.key)"
                [class]="tabClass(activeTab() === t.key)"
              >
                {{ t.label }}
              </button>
            }
          </div>

          <div class="pt-5">
            @switch (activeTab()) {
              @case ('description') {
                @if (app.description) {
                  <p class="whitespace-pre-line text-sm text-foreground md:text-base">
                    {{ app.description }}
                  </p>
                } @else {
                  <p class="text-sm text-muted-foreground">No description provided.</p>
                }

                @if (app.tags.length) {
                  <div class="mt-5 flex flex-wrap gap-1.5">
                    @for (tag of app.tags; track tag) {
                      <span
                        class="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                      >
                        {{ tag }}
                      </span>
                    }
                  </div>
                }

                @if (ratingRows().length > 0) {
                  <div class="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                    @for (r of ratingRows(); track r.key) {
                      <div class="rounded-lg border border-border bg-card p-3">
                        <div class="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {{ r.label }}
                        </div>
                        <div class="mt-1 flex items-center gap-1 text-lg font-semibold">
                          <ng-icon name="lucideStar" class="h-4 w-4 text-amber-500" />
                          {{ r.value }}/5
                        </div>
                      </div>
                    }
                  </div>
                }
              }
              @case ('configuration') {
                @if (app.userInputPrompts.length === 0 && app.editableEnv.length === 0) {
                  <p class="text-sm text-muted-foreground">
                    This app works out of the box — no configuration required.
                  </p>
                } @else {
                  @if (app.userInputPrompts.length > 0) {
                    <h3 class="text-sm font-semibold text-foreground">You'll be asked for</h3>
                    <ul class="mt-3 space-y-2">
                      @for (prompt of app.userInputPrompts; track prompt.name) {
                        <li class="rounded-lg border border-border bg-card p-3">
                          <div class="flex items-center gap-2">
                            <span class="font-mono text-xs text-foreground">{{ prompt.name }}</span>
                            @if (prompt.sensitive) {
                              <span
                                class="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                              >
                                Secret
                              </span>
                            }
                          </div>
                          @if (prompt.description) {
                            <p class="mt-1 text-xs text-muted-foreground">{{ prompt.description }}</p>
                          }
                        </li>
                      }
                    </ul>
                  }
                  @if (app.editableEnv.length > 0) {
                    <h3 class="mt-6 text-sm font-semibold text-foreground">Editable settings</h3>
                    <ul class="mt-3 space-y-2">
                      @for (env of app.editableEnv; track env.name) {
                        <li class="rounded-lg border border-border bg-card p-3">
                          <div class="flex items-center gap-2">
                            <span class="font-mono text-xs text-foreground">{{ env.name }}</span>
                            @if (env.default !== undefined) {
                              <span
                                class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                              >
                                default: {{ env.default }}
                              </span>
                            }
                          </div>
                          @if (env.description) {
                            <p class="mt-1 text-xs text-muted-foreground">{{ env.description }}</p>
                          }
                        </li>
                      }
                    </ul>
                  }
                }
              }
              @case ('manifest') {
                <app-catalog-manifest-tab [slug]="app.slug" />
              }
              @case ('install') {
                <div class="rounded-xl border border-border bg-card p-6 text-center">
                  <div
                    class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
                  >
                    <ng-icon name="lucideRocket" class="h-6 w-6 text-primary" />
                  </div>
                  <h3 class="mt-3 text-base font-semibold text-foreground">
                    Ready to deploy {{ app.name }}?
                  </h3>
                  <p class="mt-1 max-w-md text-sm text-muted-foreground" style="margin-inline:auto;">
                    Flui's deploy wizard will pick up this catalog entry, pre-fill the configuration,
                    and handle secrets, DNS and TLS for you.
                  </p>
                  <button
                    type="button"
                    (click)="goToInstall(app.slug)"
                    class="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm
                           font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                  >
                    <ng-icon name="lucideRocket" class="h-4 w-4" />
                    Deploy to cluster
                  </button>
                </div>
              }
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class CatalogDetailComponent implements OnDestroy {
  protected readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly detail = this.catalog.detail;
  protected readonly activeTab = signal<DetailTab>('description');

  protected readonly tabs: { key: DetailTab; label: string }[] = [
    { key: 'description', label: 'Description' },
    { key: 'configuration', label: 'Configuration' },
    { key: 'install', label: 'Install' },
    { key: 'manifest', label: 'Manifest' },
  ];

  protected readonly links = computed<Links>(() => {
    const raw = this.detail()?.links as Links | undefined;
    return raw ?? {};
  });

  protected readonly installedInstances = computed<Application[]>(() => {
    const slug = this.detail()?.slug;
    return this.catalog.getInstalledFor(slug);
  });

  protected readonly updateAvailable = computed(() => {
    const app = this.detail();
    return app ? this.catalog.hasUpdateAvailable(app.slug, app.version) : false;
  });

  protected readonly ratingRows = computed(() => {
    const r = this.detail()?.ratings as Ratings | undefined;
    if (!r) return [];
    const entries: { key: keyof Ratings; label: string; value: number }[] = [];
    if (typeof r.wow === 'number') entries.push({ key: 'wow', label: 'Wow', value: r.wow });
    if (typeof r.utility === 'number') entries.push({ key: 'utility', label: 'Utility', value: r.utility });
    if (typeof r.euFit === 'number') entries.push({ key: 'euFit', label: 'EU fit', value: r.euFit });
    if (typeof r.community === 'number')
      entries.push({ key: 'community', label: 'Community', value: r.community });
    return entries;
  });

  private readonly slug = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('slug'))),
    { initialValue: this.route.snapshot.paramMap.get('slug') },
  );

  private readonly returnTo = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('returnTo'))),
    { initialValue: this.route.snapshot.queryParamMap.get('returnTo') },
  );

  protected readonly backLink = computed(() => this.returnTo() || '/apps/catalog');
  protected readonly backLabel = computed(() =>
    this.returnTo() ? 'Back' : 'Back to catalog',
  );

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug) this.catalog.loadDetail(slug);
    });
    queueMicrotask(() => this.catalog.ensureApplicationsLoaded());
  }

  ngOnDestroy(): void {
    this.catalog.resetDetail();
  }

  setTab(tab: DetailTab): void {
    this.activeTab.set(tab);
  }

  goToInstall(slug: string): void {
    const autoConnectTo = this.route.snapshot.queryParamMap.get('autoConnectTo');
    const queryParams: Record<string, string> = { catalogSlug: slug };
    if (autoConnectTo) queryParams['autoConnectTo'] = autoConnectTo;
    this.router.navigate(['/apps/deploy/new'], { queryParams });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'running':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
      case 'failed':
      case 'degraded':
        return 'bg-destructive/10 text-destructive';
      case 'stopped':
      case 'deleted':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
    }
  }

  tabClass(active: boolean): string {
    const base =
      '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition';
    return active
      ? `${base} border-primary text-primary`
      : `${base} border-transparent text-muted-foreground hover:text-foreground`;
  }
}
