import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideDatabase,
  lucideEye,
  lucideFileText,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { DocumentCollection, DocumentDatabase } from '../../model/document-console.models';

/**
 * Compass-style left tree: databases → collections. Collections load lazily for
 * the selected database (the page fetches them and feeds `collections`). Mirror
 * of db-schema-tree.component for the document family.
 */
@Component({
  selector: 'app-document-collection-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideChevronLeft,
      lucideChevronRight,
      lucideDatabase,
      lucideEye,
      lucideFileText,
      lucideRefreshCw,
    }),
  ],
  template: `
    <aside class="w-64 shrink-0 overflow-auto rounded-lg border border-border bg-card">
      <div
        class="sticky top-0 flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-sm font-medium"
      >
        <ng-icon name="lucideDatabase" class="h-4 w-4" /> Databases
        <div class="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            (click)="refresh.emit()"
            [disabled]="loading()"
            class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Refresh"
          >
            <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="loading()" />
          </button>
          <button
            type="button"
            (click)="collapse.emit()"
            class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Collapse"
          >
            <ng-icon name="lucideChevronLeft" class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="p-3 text-sm text-muted-foreground">Loading…</div>
      } @else if (databases().length === 0) {
        <div class="p-3 text-sm text-muted-foreground">No databases.</div>
      } @else {
        <div class="px-2 py-1">
          @for (db of databases(); track db.name) {
            <div>
              <button
                type="button"
                (click)="selectDb.emit(db.name)"
                class="group flex w-full items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-muted"
                [class.bg-muted]="selectedDb() === db.name"
                [title]="db.name"
              >
                <ng-icon
                  name="lucideChevronRight"
                  class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform"
                  [class.rotate-90]="selectedDb() === db.name"
                />
                <ng-icon name="lucideDatabase" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span class="min-w-0 flex-1 truncate text-sm">{{ db.name }}</span>
              </button>

              @if (selectedDb() === db.name) {
                @if (loadingCollections()) {
                  <div class="ml-6 py-1 text-xs text-muted-foreground">Loading…</div>
                } @else if (collections().length === 0) {
                  <div class="ml-6 py-1 text-xs text-muted-foreground">No collections.</div>
                } @else {
                  <ul class="ml-3 border-l border-border/60 pl-2">
                    @for (c of collections(); track c.name) {
                      <li>
                        <button
                          type="button"
                          (click)="selectCollection.emit(c.name)"
                          class="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-muted/70"
                          [class.bg-muted]="selectedCollection() === c.name"
                          [title]="c.name"
                        >
                          <ng-icon
                            [name]="c.type === 'view' ? 'lucideEye' : 'lucideFileText'"
                            class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          />
                          <span class="min-w-0 flex-1 truncate text-xs">{{ c.name }}</span>
                          @if (c.type === 'view') {
                            <span class="shrink-0 rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">view</span>
                          }
                          @if (c.estimatedCount !== undefined) {
                            <span class="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">{{ formatCount(c.estimatedCount) }}</span>
                          }
                        </button>
                      </li>
                    }
                  </ul>
                }
              }
            </div>
          }
        </div>
      }
    </aside>
  `,
})
export class DocumentCollectionTreeComponent {
  readonly databases = input<DocumentDatabase[]>([]);
  readonly selectedDb = input<string | null>(null);
  readonly collections = input<DocumentCollection[]>([]);
  readonly loadingCollections = input(false);
  readonly selectedCollection = input<string | null>(null);
  readonly loading = input(false);

  @Output() readonly selectDb = new EventEmitter<string>();
  @Output() readonly selectCollection = new EventEmitter<string>();
  @Output() readonly refresh = new EventEmitter<void>();
  @Output() readonly collapse = new EventEmitter<void>();

  formatCount(n: number): string {
    if (n < 1000) return `${n}`;
    if (n < 1_000_000) return `~${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
    return `~${(n / 1_000_000).toFixed(1)}M`;
  }
}
