import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideDatabase,
  lucideEye,
  lucideKeyRound,
  lucideRefreshCw,
  lucideTable,
} from '@ng-icons/lucide';
import { SchemaTree } from '../../model/db-console.models';

@Component({
  selector: 'app-db-schema-tree',
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
      lucideKeyRound,
      lucideRefreshCw,
      lucideTable,
    }),
  ],
  template: `
    <aside class="w-64 shrink-0 overflow-auto rounded-lg border border-border bg-card">
      <div
        class="sticky top-0 flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-sm font-medium"
      >
        <ng-icon name="lucideDatabase" class="h-4 w-4" /> Schema
        <div class="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            (click)="refresh.emit()"
            [disabled]="loading()"
            class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Refresh tables"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-3.5 w-3.5"
              [class.animate-spin]="loading()"
            />
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
      } @else if (!hasTables()) {
        <div class="space-y-2 p-3 text-sm text-muted-foreground">
          <p>No tables yet.</p>
          <p class="text-xs">Ask the Flui SQL Assistant (on the right) to create one.</p>
        </div>
      } @else {
        @for (ns of schema()!.schemas; track ns.name) {
          <div class="px-2 py-1">
            <div
              class="px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70"
            >
              {{ ns.name }}
            </div>
            @for (t of ns.tables; track t.name) {
              <div>
                <div class="group flex items-center gap-1 rounded px-1 hover:bg-muted">
                  <button
                    type="button"
                    (click)="toggleTable(ns.name, t.name)"
                    class="flex h-6 w-5 shrink-0 items-center justify-center text-muted-foreground"
                    [title]="isExpanded(ns.name, t.name) ? 'Collapse' : 'Expand'"
                  >
                    <ng-icon
                      name="lucideChevronRight"
                      class="h-3.5 w-3.5 transition-transform"
                      [class.rotate-90]="isExpanded(ns.name, t.name)"
                    />
                  </button>
                  <button
                    type="button"
                    (click)="browse.emit({ schema: ns.name, table: t.name })"
                    class="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-sm"
                    [title]="t.columns.length + ' columns — click to query'"
                  >
                    <ng-icon
                      [name]="t.type === 'view' ? 'lucideEye' : 'lucideTable'"
                      class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    />
                    <span class="truncate">{{ t.name }}</span>
                  </button>
                  @if (t.rowEstimate != null) {
                    <span
                      class="shrink-0 text-[10px] tabular-nums text-muted-foreground/70"
                      title="Approximate row count"
                    >
                      {{ formatCount(t.rowEstimate) }}
                    </span>
                  }
                </div>
                @if (isExpanded(ns.name, t.name)) {
                  <ul class="ml-3 border-l border-border/60 pl-3">
                    @for (c of t.columns; track c.name) {
                      <li class="flex items-center gap-1.5 py-0.5 text-xs">
                        @if (c.isPrimaryKey) {
                          <ng-icon
                            name="lucideKeyRound"
                            class="h-3 w-3 shrink-0 text-amber-500"
                            title="Primary key"
                          />
                        }
                        <span class="truncate" [class.font-medium]="c.isPrimaryKey">{{
                          c.name
                        }}</span>
                        <span class="shrink-0 text-muted-foreground">{{ c.dataType }}</span>
                        @if (c.nullable) {
                          <span class="shrink-0 text-muted-foreground/50">null</span>
                        }
                        @if (c.references; as r) {
                          <span
                            class="truncate text-sky-600 dark:text-sky-400"
                            [title]="'→ ' + r.schema + '.' + r.table + '.' + r.column"
                            >→ {{ r.table }}</span
                          >
                        }
                      </li>
                    }
                  </ul>
                }
              </div>
            }
          </div>
        }
      }
    </aside>
  `,
})
export class DbSchemaTreeComponent {
  readonly schema = input<SchemaTree | null>(null);
  readonly loading = input(false);

  @Output() readonly refresh = new EventEmitter<void>();
  @Output() readonly collapse = new EventEmitter<void>();
  @Output() readonly browse = new EventEmitter<{ schema: string; table: string }>();

  readonly expanded = signal<ReadonlySet<string>>(new Set());

  readonly hasTables = computed(() =>
    (this.schema()?.schemas ?? []).some((s) => s.tables.length > 0),
  );

  private tableKey(schemaName: string, tableName: string): string {
    return `${schemaName}.${tableName}`;
  }

  isExpanded(schemaName: string, tableName: string): boolean {
    return this.expanded().has(this.tableKey(schemaName, tableName));
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
