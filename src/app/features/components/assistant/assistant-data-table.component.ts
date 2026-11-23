import { Component, computed, input, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlIcon } from '../../../ui/primitives/icon';

export interface DataTableConfig {
  columns: string[];
  rows: Record<string, string>[];
}

@Component({
  selector: 'app-assistant-data-table',
  imports: [FlPanel, FlTable, FlIcon],
  providers: [provideIcons({ lucideSearch })],
  host: { class: 'block' },
  template: `
    <fl-panel [title]="title()" [count]="data().rows.length" [flush]="true">
      <label panelActions class="fl-input w-36">
        <fl-icon name="lucideSearch" [size]="14" />
        <input
          type="text"
          placeholder="Filter"
          [attr.aria-label]="'Filter ' + title()"
          [value]="search()"
          (input)="onSearchInput($event)"
        />
      </label>
      <div class="fl-table-wrap max-h-56 overflow-y-auto">
        <table flTable density="dense">
          <thead>
            <tr>
              @for (col of data().columns; track col) {
                <th scope="col">{{ col }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of filteredRows(); track $index) {
              <tr>
                @for (col of data().columns; track col; let first = $first) {
                  <td>
                    <span class="fl-cell-clip" [class.fl-mono]="first" [attr.title]="row[col]">{{
                      row[col]
                    }}</span>
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td class="text-center text-fl-ink-muted" [attr.colspan]="data().columns.length">
                  No results.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>
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
