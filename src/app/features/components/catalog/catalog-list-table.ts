import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogResponseDto } from '../../../core/api/model/models';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { CatalogIconComponent } from './catalog-icon.component';

export interface CatalogRow {
  app: CatalogResponseDto;
  installedCount: number;
  updateAvailable: boolean;
}

export interface CatalogRowGroup {
  kind: string;
  label: string;
  rows: CatalogRow[];
}

@Component({
  selector: 'app-catalog-list-table',
  imports: [RouterLink, FlTable, FlButton, FlStatus, CatalogIconComponent],
  host: { class: 'block' },
  template: `
    <div class="fl-table-wrap">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">App</th>
            <th scope="col">Category</th>
            <th scope="col">Version</th>
            <th scope="col">Installed</th>
            <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
          </tr>
        </thead>
        @for (group of groups(); track group.kind) {
          <tbody>
            @if (grouped()) {
              <tr>
                <th scope="rowgroup" colspan="5">
                  {{ group.label }}
                  <span class="font-normal text-fl-ink-muted">({{ group.rows.length }})</span>
                </th>
              </tr>
            }
            @for (row of group.rows; track row.app.id) {
              <tr>
                <td>
                  <div class="flex max-w-xl items-center gap-3">
                    <app-catalog-icon
                      [slug]="row.app.slug"
                      [name]="row.app.name"
                      [iconUrl]="row.app.iconUrl"
                      size="xs"
                    />
                    <div class="flex min-w-0 flex-col">
                      <a
                        class="fl-link font-medium"
                        [routerLink]="['/apps/catalog', row.app.slug]"
                        >{{ row.app.name }}</a
                      >
                      @if (row.app.description) {
                        <span
                          class="truncate text-fl-caption text-fl-ink-muted"
                          [title]="row.app.description"
                          >{{ row.app.description }}</span
                        >
                      }
                    </div>
                  </div>
                </td>
                <td class="capitalize">{{ row.app.category }}</td>
                <td class="fl-mono">{{ row.app.version }}</td>
                <td>
                  @if (row.installedCount > 0) {
                    <div class="flex items-center gap-3">
                      <fl-status
                        tone="success"
                        [label]="
                          row.installedCount > 1 ? 'Installed · ' + row.installedCount : 'Installed'
                        "
                      />
                      @if (row.updateAvailable) {
                        <fl-status tone="warning" label="Update available" />
                      }
                    </div>
                  } @else {
                    <span class="text-fl-ink-muted">—</span>
                  }
                </td>
                <td class="is-fit">
                  <button
                    flButton
                    size="sm"
                    type="button"
                    [attr.aria-label]="'Install ' + row.app.name"
                    (click)="install.emit(row.app.slug)"
                  >
                    Install
                  </button>
                </td>
              </tr>
            }
          </tbody>
        }
      </table>
    </div>
  `,
})
export class CatalogListTable {
  readonly groups = input.required<readonly CatalogRowGroup[]>();
  readonly grouped = input(true);
  readonly install = output<string>();
}
