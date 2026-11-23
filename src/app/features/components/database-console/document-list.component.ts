import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight, lucideFileText } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { JsonViewerComponent } from './json-viewer.component';

/** Paged result list (Compass-style): a fixed page of documents + prev/next. */
@Component({
  selector: 'app-document-list',
  host: { class: 'block' },
  imports: [FlAlert, FlPanel, FlEmptyState, FlLoadingState, FlButton, FlIcon, JsonViewerComponent],
  providers: [provideIcons({ lucideChevronLeft, lucideChevronRight, lucideFileText })],
  template: `
    <fl-panel [title]="title()" [flush]="true" data-testid="document-results">
      <div panelActions class="fl-row">
        <span class="fl-toolbar__info fl-num">
          {{ rangeLabel() }}
          @if (durationMs() !== null) {
            · {{ durationMs() }} ms
          }
        </span>
        <button
          flButton="ghost"
          size="sm"
          [iconOnly]="true"
          type="button"
          (click)="prevPage.emit()"
          [disabled]="loading() || page() === 0"
          aria-label="Previous page"
          title="Previous page"
        >
          <fl-icon name="lucideChevronLeft" [size]="14" />
        </button>
        <span class="fl-toolbar__info fl-num">Page {{ page() + 1 }}</span>
        <button
          flButton="ghost"
          size="sm"
          [iconOnly]="true"
          type="button"
          (click)="nextPage.emit()"
          [disabled]="loading() || !hasNext()"
          aria-label="Next page"
          title="Next page"
        >
          <fl-icon name="lucideChevronRight" [size]="14" />
        </button>
      </div>

      @if (error(); as e) {
        <div class="p-4">
          <fl-alert tone="error" title="Query failed">
            <span class="whitespace-pre-wrap">{{ e }}</span>
          </fl-alert>
        </div>
      }

      @if (loading()) {
        <fl-loading-state [rows]="5" />
      } @else {
        <ul class="m-0 list-none p-0">
          @for (doc of documents(); track $index) {
            <li class="border-b border-fl-border-subtle px-4 py-2.5 last:border-b-0">
              <app-json-viewer [value]="doc" [autoExpandDepth]="1" />
            </li>
          }
        </ul>
        @if (documents().length === 0 && !error()) {
          <fl-empty-state [compact]="true" icon="lucideFileText" title="No documents match" />
        }
      }
    </fl-panel>
  `,
})
export class DocumentListComponent {
  readonly documents = input<unknown[]>([]);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly page = input(0);
  readonly pageSize = input(20);
  readonly hasNext = input(false);
  readonly title = input('Documents');
  readonly durationMs = input<number | null>(null);

  readonly prevPage = output<void>();
  readonly nextPage = output<void>();

  protected readonly rangeLabel = computed(() => {
    const n = this.documents().length;
    if (n === 0) return '0 documents';
    const start = this.page() * this.pageSize() + 1;
    return `${start}–${start + n - 1}`;
  });
}
