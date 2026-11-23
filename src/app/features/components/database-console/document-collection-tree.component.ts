import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideDatabase,
  lucideEye,
  lucideFileText,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { DocumentCollection, DocumentDatabase } from '../../model/document-console.models';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlTag } from '../../../ui/primitives/tag';

/**
 * Compass-style left tree: databases → collections. Collections load lazily for
 * the selected database (the page fetches them and feeds `collections`). Mirror
 * of db-schema-tree.component for the document family.
 */
@Component({
  selector: 'app-document-collection-tree',
  host: { class: 'contents' },
  imports: [FlEmptyState, FlLoadingState, FlButton, FlIcon, FlTag],
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
    <aside
      class="fl-panel flex max-h-screen w-full shrink-0 xl:sticky xl:top-0 xl:w-64 flex-col self-stretch"
      aria-label="Databases"
    >
      <header class="fl-panel__header">
        <h2 class="fl-panel__title">Databases</h2>
        <div class="fl-panel__actions">
          <button
            flButton="ghost"
            size="sm"
            [iconOnly]="true"
            type="button"
            (click)="refresh.emit()"
            [disabled]="loading()"
            aria-label="Refresh databases"
            title="Refresh databases"
          >
            <fl-icon name="lucideRefreshCw" [size]="14" />
          </button>
          <button
            flButton="ghost"
            size="sm"
            [iconOnly]="true"
            type="button"
            (click)="collapse.emit()"
            aria-label="Hide databases"
            title="Hide databases"
          >
            <fl-icon name="lucideChevronLeft" [size]="14" />
          </button>
        </div>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto">
        @if (loading()) {
          <fl-loading-state [rows]="6" />
        } @else if (databases().length === 0) {
          <fl-empty-state [compact]="true" icon="lucideDatabase" title="No databases" />
        } @else {
          <ul class="m-0 list-none py-1 pl-0">
            @for (db of databases(); track db.name) {
              <li>
                <button
                  type="button"
                  (click)="selectDb.emit(db.name)"
                  class="flex w-full items-center gap-1.5 px-3 py-1.5 text-left font-mono text-fl-mono-sm hover:bg-fl-surface-hover"
                  [attr.aria-expanded]="selectedDb() === db.name"
                  [title]="db.name"
                >
                  <fl-icon
                    class="text-fl-ink-muted"
                    name="lucideChevronRight"
                    [size]="14"
                    [class.rotate-90]="selectedDb() === db.name"
                  />
                  <fl-icon class="text-fl-ink-muted" name="lucideDatabase" [size]="14" />
                  <span
                    class="min-w-0 flex-1 truncate"
                    [class.font-semibold]="selectedDb() === db.name"
                    >{{ db.name }}</span
                  >
                </button>

                @if (selectedDb() === db.name) {
                  @if (loadingCollections()) {
                    <p class="m-0 py-1.5 pl-10 text-fl-caption text-fl-ink-muted">
                      Loading collections
                    </p>
                  } @else if (collections().length === 0) {
                    <p class="m-0 py-1.5 pl-10 text-fl-caption text-fl-ink-muted">No collections</p>
                  } @else {
                    <ul class="m-0 list-none py-0.5 pl-0">
                      @for (c of collections(); track c.name) {
                        <li>
                          <button
                            type="button"
                            (click)="selectCollection.emit(c.name)"
                            class="flex w-full items-center gap-1.5 py-1.5 pl-8 pr-3 text-left font-mono text-fl-mono-sm hover:bg-fl-surface-hover"
                            [class.bg-fl-accent-soft]="selectedCollection() === c.name"
                            [class.text-fl-accent]="selectedCollection() === c.name"
                            [attr.aria-current]="selectedCollection() === c.name ? 'true' : null"
                            [title]="c.name"
                          >
                            <fl-icon
                              class="text-fl-ink-muted"
                              [name]="c.type === 'view' ? 'lucideEye' : 'lucideFileText'"
                              [size]="14"
                            />
                            <span class="min-w-0 flex-1 truncate">{{ c.name }}</span>
                            @if (c.type === 'view') {
                              <fl-tag>view</fl-tag>
                            }
                            @if (c.estimatedCount !== undefined) {
                              <span
                                class="fl-num shrink-0 font-sans text-fl-caption text-fl-ink-muted"
                                >{{ formatCount(c.estimatedCount) }}</span
                              >
                            }
                          </button>
                        </li>
                      }
                    </ul>
                  }
                }
              </li>
            }
          </ul>
        }
      </div>
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

  readonly selectDb = output<string>();
  readonly selectCollection = output<string>();
  readonly refresh = output<void>();
  readonly collapse = output<void>();

  formatCount(n: number): string {
    if (n < 1000) return `${n}`;
    if (n < 1_000_000) return `~${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
    return `~${(n / 1_000_000).toFixed(1)}M`;
  }
}
