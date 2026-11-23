import { Component, computed, input, output } from '@angular/core';
import { FlTable } from '../../../ui/patterns/table';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { ApplicationSnapshot, snapshotStatus } from '../../model/volume-management.models';
import {
  formatDate,
  kindLabel,
  kindTooltip,
  sizeLine,
  sizeSubline,
  statusLabel,
  statusTone,
} from './snapshot-format';

@Component({
  selector: 'app-snapshot-table',
  imports: [FlTable, FlActionsMenu, FlStatus, FlButton, FlSpinner],
  host: { class: 'block' },
  template: `
    <div class="fl-table-wrap relative" data-testid="snapshot-table">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">Created</th>
            <th scope="col">Volume</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col" class="is-num">Size</th>
            <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.snap.exportId) {
            <tr>
              <td class="fl-num">{{ row.created }}</td>
              <td class="fl-mono">{{ row.snap.sourcePvcName || '—' }}</td>
              <td class="text-fl-ink-muted" [title]="row.kindTitle">{{ row.kind }}</td>
              <td><fl-status [tone]="row.tone" [label]="row.label" /></td>
              <td class="is-num">
                <div>{{ row.size }}</div>
                @if (row.subline) {
                  <div class="text-fl-caption text-fl-ink-muted">{{ row.subline }}</div>
                }
              </td>
              <td class="is-fit">
                <div class="fl-row flex-nowrap justify-end">
                  <button
                    flButton
                    size="sm"
                    type="button"
                    [disabled]="row.restoreDisabled"
                    (click)="restore.emit(row.snap)"
                  >
                    @if (row.snap.exportId === restoringId()) {
                      <fl-spinner label="Restoring" />
                    }
                    Restore
                  </button>
                  <fl-actions-menu
                    [compact]="true"
                    [label]="'Actions for the copy of ' + row.created"
                    [items]="row.menu"
                    (action)="remove.emit(row.snap)"
                  />
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class SnapshotTable {
  readonly snapshots = input.required<readonly ApplicationSnapshot[]>();
  readonly restoringId = input<string | null>(null);
  readonly deletingId = input<string | null>(null);
  readonly restore = output<ApplicationSnapshot>();
  readonly remove = output<ApplicationSnapshot>();

  protected readonly rows = computed(() =>
    this.snapshots().map((snap) => {
      const st = snapshotStatus(snap);
      const deleting = st === 'DELETING' || this.deletingId() === snap.exportId;
      const menu: MenuAction[] = [
        { id: 'delete', label: 'Delete', danger: true, disabled: deleting },
      ];
      return {
        snap,
        created: formatDate(snap.createdAt),
        kind: kindLabel(snap),
        kindTitle: kindTooltip(snap),
        tone: statusTone(st),
        label: statusLabel(snap),
        size: sizeLine(snap),
        subline: sizeSubline(snap),
        restoreDisabled: !snap.ready || st === 'DELETING' || this.restoringId() === snap.exportId,
        menu,
      };
    }),
  );
}
