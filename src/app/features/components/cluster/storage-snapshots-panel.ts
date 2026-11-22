import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationSnapshot } from '../../model/volume-management.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { storageSnapshotRow } from './storage-format';

@Component({
  selector: 'app-storage-snapshots-panel',
  imports: [RouterLink, FlPanel, FlTable, FlEmptyState, FlLoadingState, FlButton, FlStatus],
  host: { class: 'block' },
  template: `
    <fl-panel
      title="Application snapshots in this cluster"
      [count]="snapshots().length"
      [flush]="true"
    >
      <button
        panelActions
        flButton="ghost"
        size="sm"
        type="button"
        [attr.aria-expanded]="open()"
        (click)="toggled.emit()"
      >
        {{ open() ? 'Hide' : 'Show' }}
      </button>
      @if (open()) {
        @if (loading() && snapshots().length === 0) {
          <fl-loading-state [rows]="3" />
        } @else if (snapshots().length === 0) {
          <fl-empty-state
            [compact]="true"
            title="No application snapshots yet"
            body="Create one from any application's Snapshots tab."
          />
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">App</th>
                  <th scope="col">PVC</th>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                  <th scope="col" class="is-num">Size</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.snap.exportId) {
                  <tr>
                    <td>
                      <a
                        class="fl-link fl-mono"
                        [routerLink]="['/apps/applications', row.snap.appId]"
                      >
                        {{ row.snap.appId }}
                      </a>
                    </td>
                    <td class="fl-mono">{{ row.snap.sourcePvcName || '—' }}</td>
                    <td class="text-fl-ink-muted">{{ row.kind }}</td>
                    <td><fl-status [tone]="row.tone" [label]="row.label" /></td>
                    <td class="is-num">{{ row.size }}</td>
                    <td class="fl-num text-fl-ink-muted">{{ row.created }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </fl-panel>
  `,
})
export class StorageSnapshotsPanel {
  readonly snapshots = input.required<readonly ApplicationSnapshot[]>();
  readonly loading = input(false);
  readonly open = input(false);
  readonly toggled = output<void>();

  protected readonly rows = computed(() => this.snapshots().map(storageSnapshotRow));
}
