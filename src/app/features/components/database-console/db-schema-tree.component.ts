import { Component, computed, input, signal, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideEye,
  lucideKeyRound,
  lucideRefreshCw,
  lucideTable,
} from '@ng-icons/lucide';
import { SchemaTree } from '../../model/db-console.models';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-db-schema-tree',
  host: { class: 'contents' },
  imports: [FlButton, FlIcon, FlEmptyState, FlLoadingState],
  providers: [
    provideIcons({
      lucideChevronLeft,
      lucideChevronRight,
      lucideEye,
      lucideKeyRound,
      lucideRefreshCw,
      lucideTable,
    }),
  ],
  template: `
    <aside
      class="fl-panel flex max-h-screen w-full shrink-0 xl:sticky xl:top-0 xl:w-64 flex-col self-stretch"
      aria-label="Schema"
    >
      <header class="fl-panel__header">
        <h2 class="fl-panel__title">Schema</h2>
        <div class="fl-panel__actions">
          <button
            flButton="ghost"
            size="sm"
            [iconOnly]="true"
            type="button"
            (click)="refresh.emit()"
            [disabled]="loading()"
            aria-label="Refresh tables"
            title="Refresh tables"
          >
            <fl-icon name="lucideRefreshCw" [size]="14" />
          </button>
          <button
            flButton="ghost"
            size="sm"
            [iconOnly]="true"
            type="button"
            (click)="collapse.emit()"
            aria-label="Hide schema"
            title="Hide schema"
          >
            <fl-icon name="lucideChevronLeft" [size]="14" />
          </button>
        </div>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto">
        @if (loading()) {
          <fl-loading-state [rows]="6" />
        } @else if (!hasTables()) {
          <fl-empty-state
            [compact]="true"
            icon="lucideTable"
            title="No tables yet"
            body="Ask the SQL assistant to create one."
          />
        } @else {
          @for (ns of schema()!.schemas; track ns.name) {
            <div class="py-1">
              <p class="m-0 px-3 pb-1 pt-2 font-mono text-fl-caption text-fl-ink-muted">
                {{ ns.name }}
              </p>
              <ul class="m-0 list-none p-0">
                @for (t of ns.tables; track t.name) {
                  <li>
                    <div
                      class="flex items-center gap-1 pl-1 pr-3 hover:bg-fl-surface-hover"
                      [class.bg-fl-accent-soft]="isSelected(ns.name, t.name)"
                    >
                      <button
                        type="button"
                        (click)="toggleTable(ns.name, t.name)"
                        class="flex h-7 w-6 shrink-0 items-center justify-center text-fl-ink-muted"
                        [attr.aria-expanded]="isExpanded(ns.name, t.name)"
                        [attr.aria-label]="
                          (isExpanded(ns.name, t.name) ? 'Hide columns of ' : 'Show columns of ') +
                          t.name
                        "
                      >
                        <fl-icon
                          name="lucideChevronRight"
                          [size]="14"
                          [class.rotate-90]="isExpanded(ns.name, t.name)"
                        />
                      </button>
                      <button
                        type="button"
                        (click)="onBrowse(ns.name, t.name)"
                        class="flex min-w-0 flex-1 items-center gap-2 py-1 text-left font-mono text-fl-mono-sm"
                        [class.text-fl-accent]="isSelected(ns.name, t.name)"
                        [attr.aria-current]="isSelected(ns.name, t.name) ? 'true' : null"
                        [title]="t.columns.length + ' columns, click to query'"
                      >
                        <fl-icon
                          class="text-fl-ink-muted"
                          [name]="t.type === 'view' ? 'lucideEye' : 'lucideTable'"
                          [size]="14"
                        />
                        <span class="truncate">{{ t.name }}</span>
                      </button>
                      @if (t.rowEstimate != null) {
                        <span
                          class="fl-num shrink-0 text-fl-caption text-fl-ink-muted"
                          title="Approximate row count"
                        >
                          {{ formatCount(t.rowEstimate) }}
                        </span>
                      }
                    </div>
                    @if (isExpanded(ns.name, t.name)) {
                      <ul
                        class="m-0 ml-4 list-none border-l border-fl-border-subtle py-1 pl-3 pr-3"
                      >
                        @for (c of t.columns; track c.name) {
                          <li class="flex items-center gap-1.5 py-0.5 font-mono text-fl-caption">
                            @if (c.isPrimaryKey) {
                              <fl-icon
                                class="text-fl-ink-muted"
                                name="lucideKeyRound"
                                [size]="13"
                                title="Primary key"
                              />
                            }
                            <span
                              class="truncate text-fl-ink"
                              [class.font-semibold]="c.isPrimaryKey"
                              >{{ c.name }}</span
                            >
                            <span class="shrink-0 text-fl-ink-muted">{{ c.dataType }}</span>
                            @if (c.nullable) {
                              <span class="shrink-0 text-fl-ink-muted">null</span>
                            }
                            @if (c.references; as r) {
                              <span
                                class="truncate text-fl-ink-secondary"
                                [title]="'References ' + r.schema + '.' + r.table + '.' + r.column"
                                >→ {{ r.table }}</span
                              >
                            }
                          </li>
                        }
                      </ul>
                    }
                  </li>
                }
              </ul>
            </div>
          }
        }
      </div>
    </aside>
  `,
})
export class DbSchemaTreeComponent {
  readonly schema = input<SchemaTree | null>(null);
  readonly loading = input(false);

  readonly refresh = output<void>();
  readonly collapse = output<void>();
  readonly browse = output<{
    schema: string;
    table: string;
  }>();

  readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly selected = signal<string | null>(null);

  readonly hasTables = computed(() =>
    (this.schema()?.schemas ?? []).some((s) => s.tables.length > 0),
  );

  private tableKey(schemaName: string, tableName: string): string {
    return `${schemaName}.${tableName}`;
  }

  isExpanded(schemaName: string, tableName: string): boolean {
    return this.expanded().has(this.tableKey(schemaName, tableName));
  }

  isSelected(schemaName: string, tableName: string): boolean {
    return this.selected() === this.tableKey(schemaName, tableName);
  }

  onBrowse(schemaName: string, tableName: string): void {
    this.selected.set(this.tableKey(schemaName, tableName));
    this.browse.emit({ schema: schemaName, table: tableName });
  }

  toggleTable(schemaName: string, tableName: string): void {
    const key = this.tableKey(schemaName, tableName);
    const next = new Set(this.expanded());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.expanded.set(next);
  }

  formatCount(n: number): string {
    if (n < 1000) return `${n}`;
    if (n < 1_000_000) return `~${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
    return `~${(n / 1_000_000).toFixed(1)}M`;
  }
}
