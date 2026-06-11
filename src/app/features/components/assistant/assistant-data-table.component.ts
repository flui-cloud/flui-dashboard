import { Component, computed, input, signal } from '@angular/core';

export interface DataTableConfig {
  columns: string[];
  rows: Record<string, string>[];
}

@Component({
  selector: 'app-assistant-data-table',
  standalone: true,
  template: `
    <div class="mt-2 rounded-xl border border-border/50 overflow-hidden text-xs bg-background">
      <div class="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30">
        <span class="font-semibold text-foreground">{{ title() }}</span>
        <span class="text-muted-foreground">{{ data().rows.length }} items</span>
        <div class="flex-1"></div>
        <input type="text" placeholder="Filter…" [value]="search()"
          (input)="onSearchInput($event)"
          class="w-32 rounded-md bg-muted/50 border border-input/50 px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <div class="overflow-auto max-h-[220px]">
        <table class="w-full">
          <thead class="sticky top-0 bg-muted/50">
            <tr>
              @for (col of data().columns; track col) {
                <th class="text-left px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  {{ col }}
                </th>
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-border/30">
            @if (filteredRows().length === 0) {
              <tr>
                <td [attr.colspan]="data().columns.length" class="text-center text-muted-foreground py-4 px-3">
                  No results.
                </td>
              </tr>
            }
            @for (row of filteredRows(); track $index) {
              <tr class="hover:bg-muted/20 transition-colors">
                @for (col of data().columns; track col) {
                  <td class="px-3 py-1.5 text-foreground truncate max-w-[200px]">{{ row[col] }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AssistantDataTableComponent {
  readonly title = input.required<string>();
  readonly data = input.required<DataTableConfig>();

  protected readonly search = signal('');

  protected readonly filteredRows = computed(() => {
    const q = this.search().toLowerCase();
    if (!q) return this.data().rows;
    return this.data().rows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(q)),
    );
  });

  protected onSearchInput(e: Event): void {
    this.search.set((e.target as HTMLInputElement).value);
  }
}
