import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideLoader,
  lucidePencil,
  lucideSearch,
  lucideSparkles,
  lucideX,
  lucideShieldCheck,
  lucideGlobe,
  lucidePin,
} from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { CatalogService } from '../../../service/catalog.service';
import { CatalogResponseDto } from '../../../../core/api/model/models';
import { CatalogIconComponent } from '../../catalog/catalog-icon.component';

@Component({
  selector: 'app-catalog-overview-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon, CatalogIconComponent],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideLoader,
      lucidePencil,
      lucideSearch,
      lucideSparkles,
      lucideX,
      lucideShieldCheck,
      lucideGlobe,
      lucidePin,
    }),
  ],
  template: `
    @if (catalog.detailLoading()) {
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
        Loading app details…
      </div>
    } @else if (!detail()) {
      <!-- Picker: no app selected yet -->
      <div class="space-y-5">
        <div>
          <h3 class="text-base font-semibold">Pick an app from the marketplace</h3>
          <p class="text-sm text-muted-foreground">
            Browse the catalog and select the app you'd like to install.
          </p>
        </div>

        <div class="relative">
          <ng-icon
            name="lucideSearch"
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            placeholder="Search by name, category, or tag…"
            [(ngModel)]="query"
            class="h-10 w-full rounded-md border border-input bg-background pl-10 pr-9 text-sm
                   focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          @if (query()) {
            <button
              type="button"
              (click)="query.set('')"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <ng-icon name="lucideX" class="h-4 w-4" />
            </button>
          }
        </div>

        @if (catalog.listLoading()) {
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            @for (_ of skeletonSlots; track $index) {
              <div class="h-24 animate-pulse rounded-lg border border-border bg-muted/30"></div>
            }
          </div>
        } @else if (catalog.listError()) {
          <div
            class="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <ng-icon name="lucideCircleAlert" class="h-4 w-4" />
            {{ catalog.listError() }}
          </div>
        } @else if (results().length === 0) {
          <p class="text-sm text-muted-foreground">No apps match your search.</p>
        } @else {
          <div class="grid max-h-[60vh] grid-cols-1 gap-2.5 overflow-y-auto pr-1 md:grid-cols-2">
            @for (app of results(); track app.id) {
              <button
                type="button"
                (click)="selectApp(app)"
                [disabled]="loadingSlug() === app.slug"
                class="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left
                       transition hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60"
              >
                <app-catalog-icon
                  [slug]="app.slug"
                  [name]="app.name"
                  [iconUrl]="app.iconUrl"
                  size="md"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <span class="truncate text-sm font-medium">{{ app.name }}</span>
                    <span class="shrink-0 text-[11px] text-muted-foreground">v{{ app.version }}</span>
                  </div>
                  <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span class="capitalize">{{ app.category }}</span>
                    @if (app.alternativeTo.length) {
                      <span>·</span>
                      <span class="truncate">Alt. to {{ app.alternativeTo.slice(0, 2).join(', ') }}</span>
                    }
                  </div>
                  @if (app.description) {
                    <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ app.description }}</p>
                  }
                </div>
                @if (loadingSlug() === app.slug) {
                  <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin text-primary" />
                }
              </button>
            }
          </div>
        }
      </div>
    } @else {
      <!-- Overview: an app is selected -->
      <div class="space-y-5">
        <div class="flex items-start gap-4">
          <app-catalog-icon
            [slug]="detail()!.slug"
            [name]="detail()!.name"
            [iconUrl]="detail()!.iconUrl"
            size="lg"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-semibold text-foreground">{{ detail()!.name }}</h3>
              <button
                type="button"
                (click)="changeSelection()"
                class="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <ng-icon name="lucidePencil" class="h-3 w-3" />
                Change
              </button>
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              v{{ detail()!.version }} · <span class="capitalize">{{ detail()!.category }}</span>
              @if (detail()!.license) {
                · {{ detail()!.license }}
              }
            </p>
            @if (detail()!.description) {
              <p class="mt-2 text-sm text-muted-foreground">{{ detail()!.description }}</p>
            }
          </div>
        </div>

        <div
          class="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-primary"
        >
          <ng-icon name="lucideSparkles" class="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This app comes with sensible defaults defined in its manifest. Most steps are
            pre-filled — just confirm or override what you need.
          </p>
        </div>

        <!-- Access mode indicator (read-only — set by the manifest) -->
        @if (detail()!.exposure === 'internal' && detail()!.appType !== 'building-block') {
          <div class="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <ng-icon name="lucideShieldCheck" class="h-3.5 w-3.5 shrink-0 text-foreground/60" />
            <span><span class="font-medium text-foreground">Internal app</span> — gets a private URL on your cluster's internal domain, protected by Flui authentication. Accessible from the internet — login required.</span>
          </div>
        } @else if (detail()!.exposure === 'public' && detail()!.appType !== 'building-block') {
          <div class="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <ng-icon name="lucideGlobe" class="h-3.5 w-3.5 shrink-0 text-foreground/60" />
            <span><span class="font-medium text-foreground">Public app</span> — will get a public URL and DNS record on your cluster.</span>
          </div>
        }

        <!-- Placement hint — shown when the manifest pins the app to a single node (databases & friends). -->
        @if (detail()!.persistenceScope === 'dedicated') {
          <div class="flex items-start gap-2 rounded-md border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-2 text-xs">
            <ng-icon name="lucidePin" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span class="text-indigo-900 dark:text-indigo-200">
              <span class="font-medium">Pinned to one node</span> — this app keeps its data on a single node's disk (the master, by default).
              That gives databases the disk guarantees they need, but it means resizing that node will briefly stop the app.
            </span>
          </div>
        }

        <div>
          <label class="mb-1.5 block text-sm font-medium">
            Display name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            [ngModel]="state.catalogDisplayName()"
            (ngModelChange)="state.catalogDisplayName.set($event)"
            placeholder="How should this install appear in your dashboard?"
            class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm
                   focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p class="mt-1 text-xs text-muted-foreground">
            You can have multiple installs of the same app — a clear name helps tell them apart.
          </p>
        </div>
      </div>
    }
  `,
})
export class CatalogOverviewStepComponent implements OnInit {
  protected readonly state = inject(DeployWizardStateService);
  protected readonly catalog = inject(CatalogService);

  protected readonly detail = computed(() => this.state.catalogDetail());
  protected readonly query = signal('');
  protected readonly loadingSlug = signal<string | null>(null);
  protected readonly skeletonSlots = new Array(4).fill(0);

  protected readonly results = computed<CatalogResponseDto[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.catalog.catalog();
    if (!q) return all;
    return all.filter((app) => {
      const haystack = [
        app.name,
        app.slug,
        app.category,
        app.description ?? '',
        ...(app.alternativeTo ?? []),
        ...(app.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  ngOnInit(): void {
    if (!this.detail() && this.catalog.catalog().length === 0) {
      this.catalog.loadCatalog();
    }
  }

  async selectApp(app: CatalogResponseDto): Promise<void> {
    this.loadingSlug.set(app.slug);
    try {
      const detail = await this.catalog.loadDetail(app.slug);
      if (detail) this.state.initializeFromCatalog(detail);
    } finally {
      this.loadingSlug.set(null);
    }
  }

  changeSelection(): void {
    this.catalog.resetDetail();
    this.state.catalogDetail.set(null);
    this.state.catalogSlug.set(null);
    this.state.catalogDisplayName.set('');
    this.state.userInputs.set({});
    this.state.envOverrides.set({});
  }
}
