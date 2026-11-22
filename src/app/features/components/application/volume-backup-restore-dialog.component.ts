import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { VolumeBackup } from '../../model/volume-backup.models';
import { RestoreTarget } from './volume-backup-browser.component';
import { formatDate } from './snapshot-format';

@Component({
  selector: 'app-volume-backup-restore-dialog',
  imports: [FormsModule, FlAlert, FlField, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="dismissed.emit()"
    >
      <div
        class="fl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="volume-backup-restore-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="volume-backup-restore-title">Restore whole backup</h2>
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
            The backup of {{ taken() }} is written into a new volume. The running app is not
            touched; switch to the new volume when you are ready.
          </p>
          <fl-field label="Restore into" for="volume-backup-restore-target">
            <span class="fl-select-wrap">
              <select
                id="volume-backup-restore-target"
                class="fl-select"
                [ngModel]="target()"
                (ngModelChange)="target.set($event)"
              >
                <option value="">This app</option>
                @for (t of targets(); track t.id) {
                  <option [value]="t.id">{{ t.name }}</option>
                }
              </select>
            </span>
          </fl-field>
          @if (error(); as e) {
            <fl-alert tone="error" title="Restore failed">{{ e }}</fl-alert>
          }
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="dismissed.emit()">Cancel</button>
          <button
            flButton="primary"
            type="button"
            (click)="confirm.emit(target())"
            [disabled]="working()"
          >
            @if (working()) {
              <fl-spinner label="Restoring" />
            }
            Restore
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class VolumeBackupRestoreDialogComponent {
  readonly backup = input.required<VolumeBackup>();
  readonly targets = input<RestoreTarget[]>([]);
  readonly working = input(false);
  readonly error = input<string | null>(null);

  readonly confirm = output<string>();
  readonly dismissed = output<void>();

  protected readonly target = signal('');
  protected readonly taken = computed(() => {
    const at = this.backup().createdAt;
    return at ? formatDate(at) : '—';
  });
}
