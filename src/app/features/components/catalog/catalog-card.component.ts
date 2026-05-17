import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideStar, lucideArrowRight, lucideCheck } from '@ng-icons/lucide';
import { CatalogResponseDto } from '../../../core/api/model/models';
import { CatalogIconComponent } from './catalog-icon.component';
import { CatalogService } from '../../service/catalog.service';

interface Ratings {
  wow?: number;
  utility?: number;
  euFit?: number;
  community?: number;
}

@Component({
  selector: 'app-catalog-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIcon, CatalogIconComponent],
  providers: [provideIcons({ lucideStar, lucideArrowRight, lucideCheck })],
  template: `
    <a
      [routerLink]="['/apps/catalog', app().slug]"
      class="group block h-full rounded-xl border border-border bg-card p-5 shadow-sm transition
             hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      <div class="flex items-start gap-4">
        <app-catalog-icon
          [slug]="app().slug"
          [name]="app().name"
          [iconUrl]="app().iconUrl"
          size="lg"
        />
        <div class="min-w-0 flex-1">
          <div class="min-w-0">
            <h3 class="truncate text-base font-semibold text-foreground">
              {{ app().name }}
            </h3>
            <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="text-xs text-muted-foreground">v{{ app().version }}</span>
              <span
                class="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground"
              >
                {{ app().category }}
              </span>
            </div>
          </div>

          @if (installedCount() > 0) {
            <div class="mt-2 flex items-center gap-1.5">
              <span
                class="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                [attr.title]="installedCount() === 1 ? 'Installed once' : 'Installed ' + installedCount() + ' times'"
              >
                <ng-icon name="lucideCheck" class="h-3 w-3" />
                Installed@if (installedCount() > 1) { · {{ installedCount() }} }
              </span>
              @if (updateAvailable()) {
                <span
                  class="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                  title="A newer version of this app is available in the catalog"
                >
                  Update available
                </span>
              }
            </div>
          }

          @if (app().clientFor.length > 0) {
            <div class="mt-2 flex flex-wrap gap-1.5">
              @for (bb of app().clientFor; track bb) {
                <span
                  class="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-300"
                >
                  🔌 Client for {{ bb }}
                </span>
              }
            </div>
          }

          @if (app().description) {
            <p class="mt-3 line-clamp-2 text-sm text-muted-foreground">
              {{ app().description }}
            </p>
          }
        </div>
      </div>

      <div class="mt-4 space-y-3">
        @if (ratingScore() !== null) {
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ng-icon name="lucideStar" class="h-3.5 w-3.5 text-amber-500" />
            <span class="font-medium text-foreground">{{ ratingScore() }}</span>
            <span>/ 5</span>
          </div>
        }

        @if (app().alternativeTo.length) {
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-[11px] uppercase tracking-wide text-muted-foreground">
              Alternative to
            </span>
            @for (alt of app().alternativeTo.slice(0, 3); track alt) {
              <span
                class="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-foreground"
              >
                {{ alt }}
              </span>
            }
          </div>
        }

        @if (app().tags.length) {
          <div class="flex flex-wrap gap-1">
            @for (tag of app().tags.slice(0, 4); track tag) {
              <span
                class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                {{ tag }}
              </span>
            }
          </div>
        }
      </div>

      <div
        class="mt-5 flex items-center justify-between text-sm font-medium text-primary
               opacity-0 transition group-hover:opacity-100"
      >
        <span>View details</span>
        <ng-icon name="lucideArrowRight" class="h-4 w-4" />
      </div>
    </a>
  `,
})
export class CatalogCardComponent {
  private readonly catalogService = inject(CatalogService);

  readonly app = input.required<CatalogResponseDto>();

  readonly installedCount = computed(
    () => this.catalogService.getInstalledFor(this.app().slug).length,
  );

  readonly updateAvailable = computed(() =>
    this.catalogService.hasUpdateAvailable(this.app().slug, this.app().version),
  );

  readonly ratingScore = computed<number | null>(() => {
    const ratings = this.app().ratings as Ratings | undefined;
    if (!ratings) return null;
    const values = [ratings.wow, ratings.utility, ratings.euFit, ratings.community].filter(
      (v): v is number => typeof v === 'number',
    );
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(avg * 10) / 10;
  });
}
