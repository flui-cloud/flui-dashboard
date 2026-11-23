import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlay, lucideSearch } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { SearchConsoleStateService } from './search-console-state.service';
import { pretty } from './search-format';

@Component({
  selector: 'app-search-console-results',
  imports: [
    FormsModule,
    DecimalPipe,
    FlAlert,
    FlButton,
    FlEmptyState,
    FlField,
    FlIcon,
    FlLoadingState,
    FlPanel,
  ],
  providers: [provideIcons({ lucidePlay, lucideSearch })],
  host: { class: 'flex min-w-0 flex-1 flex-col gap-5 xl:flex-row xl:items-start' },
  template: `
    <fl-panel
      class="w-full shrink-0 xl:w-60"
      title="Indices"
      [count]="state.indices().length"
      [flush]="true"
    >
      @if (state.indices().length === 0) {
        <fl-empty-state [compact]="true" title="No indices yet" />
      } @else {
        <ul class="max-h-96 overflow-auto py-1">
          @for (idx of state.indices(); track idx.name) {
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-2 px-4 py-2 text-left text-fl-body-sm hover:bg-fl-surface-hover"
                [class.bg-fl-accent-soft]="state.selectedIndex() === idx.name"
                [attr.aria-current]="state.selectedIndex() === idx.name ? 'true' : null"
                (click)="state.selectIndex(idx.name)"
              >
                <span class="fl-mono min-w-0 flex-1 truncate">{{ idx.name }}</span>
                <span class="fl-num text-fl-caption text-fl-ink-muted">{{
                  idx.docsCount ?? 0
                }}</span>
              </button>
            </li>
          }
        </ul>
      }
    </fl-panel>

    <div class="flex min-w-0 flex-1 flex-col gap-5">
      @if (!state.selectedIndex()) {
        <fl-panel>
          <fl-empty-state [compact]="true" icon="lucideSearch" title="Select an index to search" />
        </fl-panel>
      } @else {
        <fl-panel [title]="'Search ' + state.selectedIndex()">
          <div panelActions class="fl-segmented" role="group" aria-label="Query mode">
            <button
              type="button"
              [attr.aria-pressed]="state.mode() === 'simple'"
              (click)="state.mode.set('simple')"
            >
              Search
            </button>
            <button
              type="button"
              [attr.aria-pressed]="state.mode() === 'dsl'"
              (click)="state.mode.set('dsl')"
            >
              Query DSL
            </button>
          </div>

          <div class="flex flex-col gap-4">
            @if (state.mode() === 'simple') {
              <div class="flex items-end gap-2">
                <fl-field class="min-w-0 flex-1" label="Full-text search" for="search-simple">
                  <div class="fl-input fl-input--lg">
                    <input
                      id="search-simple"
                      type="text"
                      placeholder="blue widget, name:red, price:>10"
                      [(ngModel)]="state.simpleQuery"
                      (keydown.enter)="state.run()"
                    />
                  </div>
                </fl-field>
                <button
                  flButton="primary"
                  type="button"
                  [disabled]="state.loading()"
                  (click)="state.run()"
                >
                  <fl-icon name="lucidePlay" [size]="14" />
                  Search
                </button>
              </div>
            } @else {
              <fl-field label="Query DSL" for="search-dsl">
                <textarea
                  id="search-dsl"
                  class="fl-textarea font-mono"
                  rows="10"
                  spellcheck="false"
                  [(ngModel)]="state.dslText"
                ></textarea>
              </fl-field>
              <div class="fl-row justify-end">
                <button
                  flButton="primary"
                  type="button"
                  [disabled]="state.loading()"
                  (click)="state.run()"
                >
                  <fl-icon name="lucidePlay" [size]="14" />
                  Run query
                </button>
              </div>
            }

            @if (state.queryError(); as e) {
              <fl-alert tone="error" title="Query failed">{{ e }}</fl-alert>
            }
          </div>
        </fl-panel>

        @if (state.result(); as r) {
          <fl-panel title="Hits" [count]="r.total" [flush]="true">
            <span panelActions class="fl-num text-fl-caption text-fl-ink-muted">
              @if (r.totalRelation === 'gte') {
                At least {{ r.total }} hits ·
              }
              {{ r.tookMs }} ms
              @if (r.maxScore !== null) {
                · max score {{ r.maxScore | number: '1.0-3' }}
              }
            </span>
            @if (r.hits.length === 0) {
              <fl-empty-state [compact]="true" title="No documents matched" />
            } @else {
              <ul class="flex flex-col">
                @for (h of r.hits; track h.id) {
                  <li class="border-b border-fl-border-subtle last:border-b-0">
                    <div
                      class="flex items-center gap-2 px-4 pt-3 text-fl-caption text-fl-ink-muted"
                    >
                      <span class="fl-mono text-fl-ink">_id {{ h.id }}</span>
                      @if (h.score !== null) {
                        <span class="fl-num ml-auto">Score {{ h.score | number: '1.0-3' }}</span>
                      }
                    </div>
                    <pre class="fl-mono m-0 overflow-auto px-4 pb-3 pt-2">{{
                      format(h.source)
                    }}</pre>
                  </li>
                }
              </ul>
            }
          </fl-panel>
        } @else if (state.loading()) {
          <fl-panel title="Hits"><fl-loading-state [rows]="3" /></fl-panel>
        }
      }
    </div>
  `,
})
export class SearchConsoleResultsComponent {
  protected readonly state = inject(SearchConsoleStateService);

  protected format(value: unknown): string {
    return pretty(value);
  }
}
