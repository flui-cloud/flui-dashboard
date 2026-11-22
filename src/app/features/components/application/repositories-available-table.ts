import { Component, input, output } from '@angular/core';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { AvailableRepo, formatRelativeDate } from './repositories-format';

@Component({
  selector: 'app-repositories-available-table',
  imports: [FlTable, FlStatus, FlTag],
  host: { class: 'block' },
  template: `
    <div class="fl-table-wrap">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col" class="is-fit"><span class="fl-sr">Select</span></th>
            <th scope="col">Repository</th>
            <th scope="col">Visibility</th>
            <th scope="col">Default branch</th>
            <th scope="col">Language</th>
            <th scope="col">Status</th>
            <th scope="col" class="is-num">Updated</th>
          </tr>
        </thead>
        <tbody>
          @for (repo of repos(); track repo.id) {
            <tr [class.is-selected]="selected().includes(repo.fullName)">
              <td class="is-fit">
                <input
                  type="checkbox"
                  [checked]="selected().includes(repo.fullName)"
                  [disabled]="repo.isImported"
                  [attr.aria-label]="'Select ' + repo.fullName"
                  (change)="toggled.emit(repo.fullName)"
                />
              </td>
              <td class="fl-cell-name">
                <span class="fl-mono" [attr.title]="repo.description || null">{{
                  repo.fullName
                }}</span>
              </td>
              <td>
                <fl-tag>{{ repo.private ? 'Private' : 'Public' }}</fl-tag>
              </td>
              <td class="fl-mono">{{ repo.defaultBranch }}</td>
              <td>{{ repo.language || '—' }}</td>
              <td>
                @if (repo.isImported) {
                  <fl-status tone="neutral" label="Imported" />
                } @else {
                  <span class="text-fl-ink-muted">Available</span>
                }
              </td>
              <td class="is-num">{{ repo.updatedAt ? when(repo.updatedAt) : '—' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class RepositoriesAvailableTable {
  readonly repos = input.required<AvailableRepo[]>();
  readonly selected = input.required<readonly string[]>();
  readonly toggled = output<string>();

  protected readonly when = formatRelativeDate;
}
