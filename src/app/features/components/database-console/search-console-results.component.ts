import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCode,
  lucideLayers,
  lucideLoader,
  lucidePlay,
  lucideSearch,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { SearchConsoleStateService } from './search-console-state.service';
import { pretty } from './search-format';

@Component({
  selector: 'app-search-console-results',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, FormsModule, DecimalPipe],
  providers: [
    provideIcons({
      lucideCode,
      lucideLayers,
      lucideLoader,
      lucidePlay,
      lucideSearch,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <!-- Index list -->
    <aside
      class="flex w-56 shrink-0 flex-col overflow-hidden rounded-md border border-border"
    >
      <div
        class="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground"
      >
        <ng-icon name="lucideLayers" class="h-3.5 w-3.5" /> Indices
      </div>
      <ul class="flex-1 overflow-auto py-1">
        @for (idx of state.indices(); track idx.name) {
          <li>
            <button
              type="button"
              (click)="state.selectIndex(idx.name)"
              class="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
              [class.bg-muted]="state.selectedIndex() === idx.name"
            >
              <span class="truncate text-foreground">{{ idx.name }}</span>
              <span class="shrink-0 font-mono text-xs text-muted-foreground">
                {{ idx.docsCount ?? 0 }}
              </span>
            </button>
          </li>
        }
        @if (state.indices().length === 0) {
          <li class="px-3 py-4 text-center text-xs text-muted-foreground">
            No indices yet.
          </li>
        }
      </ul>
    </aside>

    <!-- Query + results -->
    <section class="flex min-w-0 flex-1 flex-col overflow-auto">
      @if (!state.selectedIndex()) {
        <div
          class="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground"
        >
          Select an index to search.
        </div>
      } @else {
        <!-- Mode toggle -->
        <div class="mb-2 flex items-center gap-2">
          <div
            class="inline-flex overflow-hidden rounded-md border border-border"
          >
            <button
              type="button"
              (click)="state.mode.set('simple')"
              class="px-2.5 py-1 text-xs"
              [class.bg-muted]="state.mode() === 'simple'"
              [class.text-foreground]="state.mode() === 'simple'"
              [class.text-muted-foreground]="state.mode() !== 'simple'"
            >
              <ng-icon name="lucideSearch" class="mr-1 inline h-3 w-3" />
              Search
            </button>
            <button
              type="button"
              (click)="state.mode.set('dsl')"
              class="border-l border-border px-2.5 py-1 text-xs"
              [class.bg-muted]="state.mode() === 'dsl'"
              [class.text-foreground]="state.mode() === 'dsl'"
              [class.text-muted-foreground]="state.mode() !== 'dsl'"
            >
              <ng-icon name="lucideCode" class="mr-1 inline h-3 w-3" />
              Query DSL
            </button>
          </div>
          <span class="font-mono text-xs text-muted-foreground">{{
            state.selectedIndex()
          }}</span>
        </div>

        @if (state.mode() === 'simple') {
          <div class="flex items-center gap-2">
            <input
              type="text"
              [(ngModel)]="state.simpleQuery"
              (keydown.enter)="state.run()"
              placeholder="Full-text search (e.g. blue widget, name:red, price:>10)"
              class="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            />
            <button
              type="button"
              (click)="state.run()"
              [disabled]="state.loading()"
              class="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <ng-icon name="lucidePlay" class="h-3.5 w-3.5" /> Search
            </button>
          </div>
        } @else {
          <textarea
            [(ngModel)]="state.dslText"
            rows="8"
            spellcheck="false"
            class="min-h-[12rem] w-full shrink-0 resize-y rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          ></textarea>
          <div class="mt-2 flex justify-end">
            <button
              type="button"
              (click)="state.run()"
              [disabled]="state.loading()"
              class="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <ng-icon name="lucidePlay" class="h-3.5 w-3.5" /> Run query
            </button>
          </div>
        }

        @if (state.queryError(); as e) {
          <div
            class="mt-2 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <ng-icon name="lucideTriangleAlert" class="h-3.5 w-3.5" />
            {{ e }}
          </div>
        }

        <!-- Results -->
        @if (state.result(); as r) {
          <div
            class="mt-3 flex items-center gap-3 text-xs text-muted-foreground"
          >
            <span>
              <strong class="text-foreground">{{ r.total }}</strong>
              {{ r.totalRelation === 'gte' ? '+ ' : ' ' }}hits
            </span>
            <span>· {{ r.tookMs }} ms</span>
            @if (r.maxScore !== null) {
              <span>· max score {{ r.maxScore | number: '1.0-3' }}</span>
            }
          </div>

          <div class="mt-2 space-y-2">
            @for (h of r.hits; track h.id) {
              <div class="rounded-md border border-border">
                <div
                  class="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs"
                >
                  <span class="font-mono text-foreground">_id: {{ h.id }}</span>
                  @if (h.score !== null) {
                    <span class="ml-auto text-muted-foreground">
                      score {{ h.score | number: '1.0-3' }}
                    </span>
                  }
                </div>
                <pre
                  class="overflow-auto px-3 py-2 font-mono text-xs text-foreground"
                  >{{ format(h.source) }}</pre
                >
              </div>
            }
            @if (r.hits.length === 0) {
              <div
                class="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
              >
                No documents matched.
              </div>
            }
          </div>
        } @else if (state.loading()) {
          <div
            class="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
            Searching…
          </div>
        }
      }
    </section>
  `,
})
export class SearchConsoleResultsComponent {
  protected readonly state = inject(SearchConsoleStateService);

  protected format(value: unknown): string {
    return pretty(value);
  }
}
