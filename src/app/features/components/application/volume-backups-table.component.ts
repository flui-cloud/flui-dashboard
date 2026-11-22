import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideLock } from '@ng-icons/lucide';
import { FlTable } from '../../../ui/patterns/table';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import {
  VolumeBackup,
  backupTriggerLabel,
  backupTriggerTitle,
  bytesOrDash,
} from '../../model/volume-backup.models';
import { formatDate } from './snapshot-format';

@Component({
  selector: 'app-volume-backups-table',
  imports: [FlTable, FlActionsMenu, FlStatus, FlButton, FlIcon],
  providers: [provideIcons({ lucideLock })],
  host: { class: 'block' },
  template: `
    <div class="fl-table-wrap">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">Taken</th>
            <th scope="col">Volume</th>
            <th scope="col">Trigger</th>
            <th scope="col" class="is-num">Size</th>
            <th scope="col" class="is-num">Added</th>
            <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.backup.id) {
            @let b = row.backup;
            <tr [class.is-selected]="browsingId() === b.id">
              <td>
                <span class="inline-flex items-center gap-1.5 fl-num">
                  @if (b.encrypted) {
                    <span class="inline-flex text-fl-ink-muted" title="Encrypted">
                      <fl-icon name="lucideLock" [size]="13" />
                    </span>
                  }
                  {{ row.taken }}
                </span>
                @if (b.stored !== 'present') {
                  <div>
                    <fl-status tone="warning" [label]="b.reason ?? 'No longer stored'" />
                  </div>
                }
              </td>
              <td class="fl-mono">{{ b.volumeName || '—' }}</td>
              <td class="text-fl-ink-muted" [title]="triggerTitle(b)">{{ triggerLabel(b) }}</td>
              <td class="is-num">{{ bytes(b.logicalBytes) }}</td>
              <td class="is-num text-fl-ink-muted">{{ bytes(b.uploadedBytes) }}</td>
              <td class="is-fit">
                <div class="fl-row flex-nowrap justify-end">
                  @if (deletingIds().has(b.id)) {
                    <fl-status tone="progress" label="Deleting" />
                  } @else {
                    <button
                      flButton
                      size="sm"
                      type="button"
                      [disabled]="!b.restorable || busyIds().has(b.id)"
                      [title]="
                        b.restorable ? 'Restore whole backup' : (b.reason ?? 'Not restorable')
                      "
                      (click)="restore.emit(b)"
                    >
                      Restore
                    </button>
                  }
                  <fl-actions-menu
                    [compact]="true"
                    [label]="'Actions for the backup of ' + row.taken"
                    [items]="row.menu"
                    (action)="onAction(b, $event)"
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
export class VolumeBackupsTableComponent {
  readonly backups = input.required<VolumeBackup[]>();
  readonly browsingId = input<string | null>(null);
  readonly busyIds = input<ReadonlySet<string>>(new Set());
  readonly deletingIds = input<ReadonlySet<string>>(new Set());

  readonly browse = output<VolumeBackup>();
  readonly restore = output<VolumeBackup>();
  readonly remove = output<VolumeBackup>();

  protected readonly triggerLabel = backupTriggerLabel;
  protected readonly triggerTitle = backupTriggerTitle;
  protected readonly bytes = bytesOrDash;

  protected readonly rows = computed(() =>
    this.backups().map((backup) => {
      const menu: MenuAction[] = [
        {
          id: 'browse',
          label: this.browsingId() === backup.id ? 'Hide files' : 'Browse files',
          disabled: !backup.browsable,
        },
        {
          id: 'delete',
          label: 'Delete',
          danger: true,
          disabled: this.busyIds().has(backup.id),
          separatorBefore: true,
        },
      ];
      return { backup, taken: backup.createdAt ? formatDate(backup.createdAt) : '—', menu };
    }),
  );

  protected onAction(backup: VolumeBackup, id: string): void {
    if (id === 'browse') this.browse.emit(backup);
    else if (id === 'delete') this.remove.emit(backup);
  }
}
