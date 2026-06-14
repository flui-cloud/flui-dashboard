import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBraces,
  lucideCopy,
  lucideDownload,
  lucideMaximize2,
  lucideX,
} from '@ng-icons/lucide';
import { SqlColumn, SqlQueryResult } from '../../model/db-console.models';
import { JsonViewerComponent } from './json-viewer.component';

const JSON_SNIFF_SAMPLE = 50;

@Component({
  selector: 'app-sql-result-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [NgIcon, JsonViewerComponent],
  providers: [
    provideIcons({
      lucideBraces,
      lucideCopy,
      lucideDownload,
      lucideMaximize2,
      lucideX,
    }),
  ],
  template: `
    <div class="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card">
      @if (result(); as r) {
        <div
          class="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
        >
          <span>{{ r.command || 'OK' }}</span>
          @if (r.columns.length > 0) {
            <span>{{ r.rowCount }} rows</span>
          } @else {
            <span>{{ r.rowCount }} row{{ r.rowCount === 1 ? '' : 's' }} affected</span>
          }
          <span>{{ r.durationMs }} ms</span>
          @if (r.truncated) {
            <span class="text-amber-600 dark:text-amber-400"
              >truncated to {{ r.rows.length }}</span
            >
          }
          <div class="ml-auto flex items-center gap-2">
            <button
              type="button"
              (click)="exportCsv()"
              class="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 hover:bg-muted"
            >
              <ng-icon name="lucideDownload" class="h-3.5 w-3.5" /> CSV
            </button>
            <button
              type="button"
              (click)="exportJson()"
              class="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 hover:bg-muted"
            >
              <ng-icon name="lucideDownload" class="h-3.5 w-3.5" /> JSON
            </button>
          </div>
        </div>
        @if (r.columns.length > 0) {
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="text-left">
                @for (c of r.columns; track c.name) {
                  <th class="border-b border-border px-3 py-1.5 font-medium">
                    {{ c.name }}
                    <span class="ml-1 text-xs font-normal text-muted-foreground">{{
                      c.dataType
                    }}</span>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of r.rows; track $index) {
                <tr class="hover:bg-muted/40">
                  @for (cell of row; track $index; let ci = $index) {
                    <td class="border-b border-border/60 px-3 py-1 align-top">
                      @if (cell === null) {
                        <span class="italic text-muted-foreground">NULL</span>
                      } @else if (isJsonCell(ci)) {
                        <div class="group relative max-w-md">
                          <button
                            type="button"
                            (click)="openJson(cell, r.columns[ci].name)"
                            class="absolute right-0 top-0 z-10 rounded border border-border bg-card p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
                            title="Open in panel"
                          >
                            <ng-icon name="lucideMaximize2" class="h-3 w-3" />
                          </button>
                          <div class="max-h-48 overflow-auto pr-6">
                            <app-json-viewer
                              [value]="asJsonValue(cell)"
                              [autoExpandDepth]="1"
                            />
                          </div>
                        </div>
                      } @else {
                        <span class="font-mono">{{ renderCell(cell) }}</span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        }
      } @else {
        <div class="p-6 text-center text-sm text-muted-foreground">
          Run a query to see results.
        </div>
      }
    </div>

    @if (jsonDrawer(); as jd) {
      <div class="fixed inset-0 z-50 flex justify-end" (click)="closeJson()">
        <div class="absolute inset-0 bg-black/30"></div>
        <aside
          class="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div class="flex min-w-0 items-center gap-2">
              <ng-icon name="lucideBraces" class="h-4 w-4 shrink-0 text-muted-foreground" />
              <span class="truncate text-sm font-medium">{{ jd.column }}</span>
            </div>
            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="copyJson()"
                [title]="jsonCopied() ? 'Copied' : 'Copy JSON'"
                class="rounded border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ng-icon name="lucideCopy" class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                (click)="closeJson()"
                title="Close"
                class="rounded border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ng-icon name="lucideX" class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div class="min-h-0 flex-1 overflow-auto p-3">
            <app-json-viewer [value]="jd.value" />
          </div>
        </aside>
      </div>
    }
  `,
})
export class SqlResultGridComponent {
  readonly result = input<SqlQueryResult | null>(null);

  readonly jsonColumns = computed<ReadonlySet<number>>(() => {
    const result = this.result();
    const cols = result?.columns ?? [];
    const rows = result?.rows ?? [];
    const set = new Set<number>();
    cols.forEach((c, i) => {
      if (/^jsonb?$/i.test(c.dataType) || this.columnLooksJson(rows, i)) set.add(i);
    });
    return set;
  });

  readonly jsonDrawer = signal<{ value: unknown; column: string } | null>(null);
  readonly jsonCopied = signal(false);

  isJsonCell(colIndex: number): boolean {
    return this.jsonColumns().has(colIndex);
  }

  private columnLooksJson(rows: unknown[][], col: number): boolean {
    let sampled = 0;
    for (let r = 0; r < rows.length && sampled < JSON_SNIFF_SAMPLE; r++) {
      const v = rows[r][col];
      if (v === null || v === undefined) continue;
      sampled++;
      if (!this.looksJson(v)) return false;
    }
    return sampled > 0;
  }

  private looksJson(v: unknown): boolean {
    if (typeof v === 'object' && v !== null) return true;
    if (typeof v !== 'string') return false;
    const s = v.trim();
    if (s.length < 2) return false;
    const open = s[0];
    const close = s.at(-1);
    if (!((open === '{' && close === '}') || (open === '[' && close === ']'))) return false;
    try {
      const parsed = JSON.parse(s);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  }

  protected asJsonValue(cell: unknown): unknown {
    if (typeof cell !== 'string') return cell;
    try {
      return JSON.parse(cell);
    } catch {
      return cell;
    }
  }

  renderCell(cell: unknown): string {
    return typeof cell === 'object'
      ? JSON.stringify(cell)
      : String(cell as string | number | bigint | boolean);
  }

  openJson(cell: unknown, column: string): void {
    this.jsonCopied.set(false);
    this.jsonDrawer.set({ value: this.asJsonValue(cell), column });
  }

  closeJson(): void {
    this.jsonDrawer.set(null);
  }

  copyJson(): void {
    const jd = this.jsonDrawer();
    if (!jd) return;
    const text = JSON.stringify(jd.value, null, 2);
    void navigator.clipboard?.writeText(text).then(() => {
      this.jsonCopied.set(true);
    });
  }

  exportCsv(): void {
    const r = this.result();
    if (!r) return;
    const esc = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s =
        typeof v === 'object'
          ? JSON.stringify(v)
          : String(v as string | number | bigint | boolean);
      return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    };
    const header = r.columns.map((c: SqlColumn) => esc(c.name)).join(',');
    const body = r.rows.map((row) => row.map(esc).join(',')).join('\n');
    this.download(`${header}\n${body}`, 'text/csv', 'query-result.csv');
  }

  exportJson(): void {
    const r = this.result();
    if (!r) return;
    const objects = r.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      r.columns.forEach((c, i) => (obj[c.name] = row[i]));
      return obj;
    });
    this.download(
      JSON.stringify(objects, null, 2),
      'application/json',
      'query-result.json',
    );
  }

  private download(content: string, mime: string, filename: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
