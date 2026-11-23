import { Component, computed, input, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCopy,
  lucideDownload,
  lucideMaximize2,
  lucideRows3,
  lucideX,
} from '@ng-icons/lucide';
import { SqlColumn, SqlQueryResult } from '../../model/db-console.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { JsonViewerComponent } from './json-viewer.component';
import { FlDialogFocus } from '../../../ui/overlays/dialog-focus';

const JSON_SNIFF_SAMPLE = 50;

@Component({
  selector: 'app-sql-result-grid',
  host: { class: 'block' },
  imports: [
    FlDialogFocus,
    FlPanel,
    FlTable,
    FlEmptyState,
    FlButton,
    FlIcon,
    FlStatus,
    JsonViewerComponent,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideCopy,
      lucideDownload,
      lucideMaximize2,
      lucideRows3,
      lucideX,
    }),
  ],
  template: `
    @let r = result();
    <fl-panel
      title="Results"
      [count]="r && r.columns.length > 0 ? r.rowCount : null"
      [flush]="true"
      data-testid="sql-results"
    >
      @if (r) {
        <div panelActions class="fl-row">
          <span class="fl-toolbar__info fl-num">
            <span class="fl-mono">{{ r.command || 'OK' }}</span> · {{ r.durationMs }} ms
          </span>
          @if (r.truncated) {
            <fl-status tone="warning" [label]="'Truncated to ' + r.rows.length + ' rows'" />
          }
          <button flButton="ghost" size="sm" type="button" (click)="exportCsv()">
            <fl-icon name="lucideDownload" [size]="14" /> CSV
          </button>
          <button flButton="ghost" size="sm" type="button" (click)="exportJson()">
            <fl-icon name="lucideDownload" [size]="14" /> JSON
          </button>
        </div>
      }

      @if (!r) {
        <fl-empty-state
          [compact]="true"
          icon="lucideRows3"
          title="No results yet"
          body="Run a query to see its results here."
        />
      } @else if (r.columns.length === 0) {
        <fl-empty-state
          [compact]="true"
          icon="lucideCheck"
          [title]="(r.command || 'Statement') + ' done'"
          [body]="r.rowCount + ' row' + (r.rowCount === 1 ? '' : 's') + ' affected.'"
        />
      } @else if (r.rows.length === 0) {
        <fl-empty-state [compact]="true" icon="lucideRows3" title="The query returned no rows" />
      } @else {
        <div class="fl-table-wrap max-h-screen overflow-y-auto">
          <table flTable density="dense">
            <thead class="sticky top-0 z-10">
              <tr>
                @for (c of r.columns; track c.name) {
                  <th scope="col">
                    <span class="fl-mono">{{ c.name }}</span>
                    <span class="ml-1 font-mono font-normal text-fl-ink-muted">{{
                      c.dataType
                    }}</span>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of r.rows; track $index) {
                <tr>
                  @for (cell of row; track $index; let ci = $index) {
                    <td class="fl-mono align-top">
                      @if (cell === null) {
                        <span class="italic text-fl-ink-muted">NULL</span>
                      } @else if (isJsonCell(ci)) {
                        <div class="group relative max-w-md">
                          <button
                            flButton
                            size="sm"
                            [iconOnly]="true"
                            type="button"
                            (click)="openJson(cell, r.columns[ci].name)"
                            class="absolute right-0 top-0 z-10 opacity-0 focus:opacity-100 group-hover:opacity-100"
                            aria-label="Open JSON"
                            title="Open JSON"
                          >
                            <fl-icon name="lucideMaximize2" [size]="13" />
                          </button>
                          <div class="max-h-48 overflow-auto pr-8">
                            <app-json-viewer [value]="asJsonValue(cell)" [autoExpandDepth]="1" />
                          </div>
                        </div>
                      } @else {
                        {{ renderCell(cell) }}
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>

    @if (jsonDrawer(); as jd) {
      <div class="fixed inset-0 z-50 flex justify-end" (click)="closeJson()">
        <div class="fl-backdrop absolute inset-0"></div>
        <aside
          class="relative z-10 flex h-full w-full max-w-md flex-col border-l border-fl-border bg-fl-surface"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="jd.column"
          flDialogFocus
          (dismissed)="closeJson()"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title truncate font-mono">{{ jd.column }}</h2>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="fl-dialog__close"
                (click)="copyJson()"
                [attr.aria-label]="jsonCopied() ? 'Copied' : 'Copy JSON'"
                [title]="jsonCopied() ? 'Copied' : 'Copy JSON'"
              >
                <fl-icon [name]="jsonCopied() ? 'lucideCheck' : 'lucideCopy'" />
              </button>
              <button
                type="button"
                class="fl-dialog__close"
                (click)="closeJson()"
                aria-label="Close"
                title="Close"
              >
                <fl-icon name="lucideX" />
              </button>
            </div>
          </header>
          <div class="min-h-0 flex-1 overflow-auto p-4">
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
        typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | bigint | boolean);
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
    this.download(JSON.stringify(objects, null, 2), 'application/json', 'query-result.json');
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
