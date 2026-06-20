import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  input,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { JsonViewerComponent } from './json-viewer.component';

/** Paged result list (Compass-style): a fixed page of documents + prev/next. */
@Component({
  selector: 'app-document-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [NgIcon, JsonViewerComponent],
  providers: [
    provideIcons({ lucideChevronLeft, lucideChevronRight, lucideTriangleAlert }),
  ],
  template: `
    @if (error(); as e) {
      <div
        class="mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      >
        <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
        <span class="whitespace-pre-wrap">{{ e }}</span>
      </div>
    }

    <div class="mb-2 flex items-center gap-2">
      <span class="text-xs tabular-nums text-muted-foreground">{{ rangeLabel() }}</span>
      <div class="ml-auto flex items-center gap-1">
        <button
          type="button"
          (click)="prevPage.emit()"
          [disabled]="loading() || page() === 0"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
          title="Previous page"
        >
          <ng-icon name="lucideChevronLeft" class="h-4 w-4" />
        </button>
        <span class="px-1 text-xs tabular-nums text-muted-foreground">{{ page() + 1 }}</span>
        <button
          type="button"
          (click)="nextPage.emit()"
          [disabled]="loading() || !hasNext()"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
          title="Next page"
        >
          <ng-icon name="lucideChevronRight" class="h-4 w-4" />
        </button>
      </div>
    </div>

    @if (loading()) {
      @for (i of skeletonRows; track i) {
        <div class="mb-2 h-16 animate-pulse rounded-lg bg-muted/50"></div>
      }
    } @else {
      @for (doc of documents(); track $index) {
        <div class="mb-2 rounded-lg border border-border bg-muted/20 p-2.5">
          <app-json-viewer [value]="doc" [autoExpandDepth]="1" />
        </div>
      } @empty {
        <p class="py-6 text-center text-xs text-muted-foreground">No documents match.</p>
      }
    }
  `,
})
export class DocumentListComponent {
  readonly documents = input<unknown[]>([]);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** 0-based current page. */
  readonly page = input(0);
  readonly pageSize = input(20);
  /** Whether a further page exists (server reported more than pageSize rows). */
  readonly hasNext = input(false);

  @Output() readonly prevPage = new EventEmitter<void>();
  @Output() readonly nextPage = new EventEmitter<void>();

  protected readonly skeletonRows = Array.from({ length: 5 }, (_, i) => i);

  protected readonly rangeLabel = computed(() => {
    const n = this.documents().length;
    if (n === 0) return '0 documents';
    const start = this.page() * this.pageSize() + 1;
    return `${start}–${start + n - 1}`;
  });
}
