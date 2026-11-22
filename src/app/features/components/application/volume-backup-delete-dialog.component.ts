import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { VolumeBackup } from '../../model/volume-backup.models';
import { formatDate } from './snapshot-format';

@Component({
  selector: 'app-volume-backup-delete-dialog',
  imports: [FlAlert, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="dismissed.emit()"
    >
      <div
        class="fl-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="volume-backup-delete-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="volume-backup-delete-title">Delete backup</h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            (click)="dismissed.emit()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          <p>
            The backup of {{ taken() }} ({{ backup().volumeName || 'volume' }}) is removed from
            backup storage and cannot be restored afterwards.
          </p>
          @if (error(); as e) {
            <fl-alert tone="error" title="Delete failed">{{ e }}</fl-alert>
          }
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="dismissed.emit()">Cancel</button>
          <button flButton="danger" type="button" (click)="confirm.emit()" [disabled]="working()">
            @if (working()) {
              <fl-spinner label="Deleting" />
            }
            Delete
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class VolumeBackupDeleteDialogComponent {
  readonly backup = input.required<VolumeBackup>();
  readonly working = input(false);
  readonly error = input<string | null>(null);

  readonly confirm = output<void>();
  readonly dismissed = output<void>();

  protected readonly taken = computed(() => {
    const at = this.backup().createdAt;
    return at ? formatDate(at) : '—';
  });
}
