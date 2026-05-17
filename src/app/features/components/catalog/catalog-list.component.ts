import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideStore,
  lucideSparkles,
  lucideX,
  lucideRefreshCw,
  lucideCircleAlert,
  lucideChevronDown,
  lucideChevronUp,
  lucideArrowLeft,
} from '@ng-icons/lucide';
import { CatalogService } from '../../service/catalog.service';
import { CatalogResponseDto } from '../../../core/api/model/models';
import { CatalogCardComponent } from './catalog-card.component';
import { ApplicationKind, ApplicationKindEnum, getKindLabel } from '../../model/application.models';

const SHOW_SYSTEM_APPS_KEY = 'sidebar:showSystemApps';

interface CatalogKindGroup {
  kind: ApplicationKind;
  label: string;
  apps: CatalogResponseDto[];
}

function readAppKind(app: CatalogResponseDto): ApplicationKind {
  const raw = (app as unknown as { appKind?: string }).appKind;
  switch (raw) {
    case 'DATABASE':
      return ApplicationKindEnum.Database;
    case 'TOOL':
      return ApplicationKindEnum.Tool;
    case 'SYSTEM':
      return ApplicationKindEnum.System;
    case 'APPLICATION':
    default:
      return ApplicationKindEnum.Application;
  }
}

const KIND_ORDER: ApplicationKind[] = [
  ApplicationKindEnum.Database,
  ApplicationKindEnum.Application,
  ApplicationKindEnum.Tool,
  ApplicationKindEnum.System,
];

@Component({
  selector: 'app-catalog-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon, CatalogCardComponent, RouterLink],
  providers: [
    provideIcons({
      lucideSearch,
      lucideStore,
      lucideSparkles,
      lucideX,
      lucideRefreshCw,
      lucideCircleAlert,
      lucideChevronDown,
      lucideChevronUp,
      lucideArrowLeft,
    }),
  ],
  template: `
    <div class="mx-auto max-w-7xl space-y-8 p-6">
      <!-- Hero banner -->
      <section
        class="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br
               from-primary/10 via-primary/5 to-transparent p-8"
      >
        <div class="relative flex flex-col gap-2">
          @if (backLink(); as link) {
            <a
              [routerLink]="link"
              class="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
            >
              <ng-icon name="lucideArrowLeft" class="h-3.5 w-3.5" />
              <span>Back</span>
            </a>
          }
          <div class="flex items-center gap-2 text-primary">
            <ng-icon name="lucideSparkles" class="h-5 w-5" />
            <span class="text-xs font-semibold uppercase tracking-wider">App Marketplace</span>
          </div>
          <h1 class="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {{ heroTitle() }}
          </h1>
          <p class="max-w-2xl text-sm text-muted-foreground md:text-base">
            {{ heroSubtitle() }}
          </p>
        </div>

        <div
          class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        ></div>
        <div
          class="pointer-events-none absolute -bottom-20 right-12 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl"
          aria-hidden="true"
        ></div>
      </section>

      <!-- Search + filters -->
      <section class="space-y-4">
        <div class="relative">
          <ng-icon
            name="lucideSearch"
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            placeholder="Search apps — try &quot;password manager&quot; or &quot;analytics&quot;..."
            [(ngModel)]="searchQuery"
            class="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-10 text-sm
                   text-foreground placeholder:text-muted-foreground
                   focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          @if (searchQuery()) {
            <button
              type="button"
              (click)="clearSearch()"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <ng-icon name="lucideX" class="h-4 w-4" />
            </button>
          }
        </div>

        @if (categories().length > 0) {
          <div class="space-y-2">
            <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Categories
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                (click)="setCategory(null)"
                [class]="chipClass(activeCategory() === null)"
              >
                All
              </button>
              @for (cat of categories(); track cat) {
                <button
                  type="button"
                  (click)="setCategory(cat)"
                  [class]="chipClass(activeCategory() === cat)"
                >
                  <span class="capitalize">{{ cat }}</span>
                </button>
              }
            </div>
          </div>
        }

        @if (tags().length > 0) {
          <div class="space-y-2">
            <button
              type="button"
              (click)="toggleTagsExpanded()"
              [attr.aria-expanded]="tagsExpanded()"
              class="group inline-flex items-center gap-2 rounded-md py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              <ng-icon
                [name]="tagsExpanded() ? 'lucideChevronUp' : 'lucideChevronDown'"
                class="h-3.5 w-3.5"
              />
              <span>Tags</span>
              @if (activeTags().length > 0) {
                <span class="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-primary">
                  {{ activeTags().length }} selected
                </span>
              }
              <span class="text-[11px] normal-case tracking-normal text-muted-foreground/70 group-hover:text-foreground/70">
                {{ tagsExpanded() ? '— hide' : '— show all ' + tags().length }}
              </span>
            </button>
            @if (tagsExpanded()) {
              <div class="flex flex-wrap gap-2">
                @for (tag of tags(); track tag) {
                  <button
                    type="button"
                    (click)="toggleTag(tag)"
                    [class]="chipClass(activeTags().includes(tag))"
                  >
                    {{ tag }}
                  </button>
                }
                @if (activeTags().length > 0) {
                  <button
                    type="button"
                    (click)="clearTags()"
                    class="inline-flex items-center gap-1 rounded-full border border-dashed border-border
                           px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ng-icon name="lucideX" class="h-3 w-3" />
                    Clear tags
                  </button>
                }
              </div>
            } @else if (activeTags().length > 0) {
              <div class="flex flex-wrap gap-2">
                @for (tag of activeTags(); track tag) {
                  <button
                    type="button"
                    (click)="toggleTag(tag)"
                    [class]="chipClass(true)"
                  >
                    {{ tag }}
                  </button>
                }
                <button
                  type="button"
                  (click)="clearTags()"
                  class="inline-flex items-center gap-1 rounded-full border border-dashed border-border
                         px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ng-icon name="lucideX" class="h-3 w-3" />
                  Clear tags
                </button>
              </div>
            }
          </div>
        }
      </section>

      <!-- Results -->
      <section>
        @if (catalog.listLoading()) {
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            @for (_ of skeletonSlots; track $index) {
              <div class="h-56 animate-pulse rounded-xl border border-border bg-muted/30"></div>
            }
          </div>
        } @else if (catalog.listError()) {
          <div
            class="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center"
          >
            <ng-icon name="lucideCircleAlert" class="h-8 w-8 text-destructive" />
            <p class="text-sm text-destructive">{{ catalog.listError() }}</p>
            <button
              type="button"
              (click)="reload()"
              class="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5
                     text-sm font-medium hover:bg-muted"
            >
              <ng-icon name="lucideRefreshCw" class="h-4 w-4" />
              Retry
            </button>
          </div>
        } @else if (filteredApps().length === 0) {
          <div class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
            <ng-icon name="lucideStore" class="h-10 w-10 text-muted-foreground" />
            <div class="space-y-1">
              <p class="text-sm font-medium text-foreground">No apps match your filters</p>
              <p class="text-xs text-muted-foreground">
                Try broadening the search or clearing a tag.
              </p>
            </div>
            @if (hasActiveFilters()) {
              <button
                type="button"
                (click)="resetFilters()"
                class="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                Reset filters
              </button>
            }
          </div>
        } @else {
          <div class="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ filteredApps().length }} app{{ filteredApps().length === 1 ? '' : 's' }}</span>
            @if (!scopedKind()) {
              <button
                type="button"
                (click)="toggleShowSystemApps()"
                class="text-xs text-muted-foreground hover:text-foreground"
              >
                {{ showSystemApps() ? 'Hide' : 'Show' }} system apps
              </button>
            }
          </div>
          @if (scopedKind()) {
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              @for (app of filteredApps(); track app.id) {
                <app-catalog-card [app]="app" />
              }
            </div>
          } @else {
            @for (group of kindGroups(); track group.kind) {
              <div class="mb-8">
                <h3 class="mb-3 text-sm font-semibold text-foreground">
                  {{ group.label }}
                  <span class="ml-1 text-xs font-normal text-muted-foreground">({{ group.apps.length }})</span>
                </h3>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  @for (app of group.apps; track app.id) {
                    <app-catalog-card [app]="app" />
                  }
                </div>
              </div>
            }
          }
        }
      </section>
    </div>
  `,
})
export class CatalogListComponent {
  protected readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);

  readonly appKind = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly scopedKind = computed<ApplicationKind | null>(() => {
    const raw = this.appKind().get('appKind');
    switch (raw) {
      case 'DATABASE':
        return ApplicationKindEnum.Database;
      case 'TOOL':
        return ApplicationKindEnum.Tool;
      case 'SYSTEM':
        return ApplicationKindEnum.System;
      case 'APPLICATION':
        return ApplicationKindEnum.Application;
      default:
        return null;
    }
  });

  readonly heroTitle = computed(() => {
    const k = this.scopedKind();
    if (!k) return 'Deploy open-source apps in one click';
    return `Add a ${getKindLabel(k).replace(/s$/, '').toLowerCase()}`;
  });

  readonly heroSubtitle = computed(() => {
    switch (this.scopedKind()) {
      case ApplicationKindEnum.Database:
        return 'Pick a database engine — Flui provisions storage, secrets, backups and connection envs for you.';
      case ApplicationKindEnum.Tool:
        return 'Browse admin UIs, ops tools and developer utilities. Many can connect to a running building block.';
      case ApplicationKindEnum.System:
        return 'Internal platform components — usually managed automatically.';
      case ApplicationKindEnum.Application:
        return 'Curated open-source applications ready to deploy on your cluster.';
      default:
        return 'Curated, EU-friendly alternatives to the tools you already use. Pick an app, choose a cluster, and Flui handles the rest — secrets, DNS, TLS and all.';
    }
  });

  readonly backLink = computed<string | null>(() => {
    switch (this.scopedKind()) {
      case ApplicationKindEnum.Database:
        return '/apps/databases';
      case ApplicationKindEnum.Tool:
        return '/apps/tools';
      case ApplicationKindEnum.System:
        return '/apps/system';
      case ApplicationKindEnum.Application:
        return '/apps/applications';
      default:
        return null;
    }
  });

  readonly searchQuery = signal('');
  readonly activeCategory = signal<string | null>(null);
  readonly activeTags = signal<string[]>([]);
  readonly tagsExpanded = signal(false);
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

  readonly skeletonSlots = new Array(8).fill(0);

  readonly categories = this.catalog.categories;
  readonly tags = this.catalog.tags;

  readonly hasActiveFilters = computed(
    () =>
      this.searchQuery().trim() !== '' ||
      this.activeCategory() !== null ||
      this.activeTags().length > 0,
  );

  readonly filteredApps = computed<CatalogResponseDto[]>(() => {
    const all = this.catalog.catalog();
    const query = this.searchQuery().trim().toLowerCase();
    const category = this.activeCategory();
    const tags = this.activeTags();

    return all.filter((app) => {
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

  readonly kindGroups = computed<CatalogKindGroup[]>(() => {
    const showSystem = this.showSystemApps();
    const buckets = new Map<ApplicationKind, CatalogResponseDto[]>();
    for (const app of this.filteredApps()) {
      const kind = readAppKind(app);
      if (kind === ApplicationKindEnum.System && !showSystem) continue;
      const bucket = buckets.get(kind);
      if (bucket) {
        bucket.push(app);
      } else {
        buckets.set(kind, [app]);
      }
    }
    return KIND_ORDER
      .filter((k) => buckets.has(k))
      .map((k) => ({ kind: k, label: getKindLabel(k), apps: buckets.get(k)! }));
  });

  constructor() {
    effect(() => {
      const cat = this.activeCategory();
      const kind = this.scopedKind();
      queueMicrotask(() =>
        this.catalog.loadCatalog({
          category: cat ?? undefined,
          appKind: kind ?? undefined,
        }),
      );
    });
    queueMicrotask(() => this.catalog.ensureApplicationsLoaded());
  }

  reload(): void {
    this.catalog.loadCatalog({
      category: this.activeCategory() ?? undefined,
      appKind: this.scopedKind() ?? undefined,
    });
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

  toggleTagsExpanded(): void {
    this.tagsExpanded.update((v) => !v);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.activeCategory.set(null);
    this.activeTags.set([]);
  }

  chipClass(active: boolean): string {
    const base =
      'rounded-full px-3 py-1 text-xs font-medium transition border';
    return active
      ? `${base} bg-primary text-primary-foreground border-primary`
      : `${base} bg-background text-foreground border-border hover:border-primary/50 hover:text-primary`;
  }
}
