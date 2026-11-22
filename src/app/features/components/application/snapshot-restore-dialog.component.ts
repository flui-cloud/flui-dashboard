import { Component, effect, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { ApplicationSnapshot } from '../../model/volume-management.models';

@Component({
  selector: 'app-snapshot-restore-dialog',
  imports: [FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  template: `
    @if (snapshot(); as snap) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="cancelled.emit()"
      >
        <div
          class="fl-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="snapshot-restore-title"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="snapshot-restore-title">Restore copy</h2>
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              [disabled]="restoring()"
              (click)="cancelled.emit()"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>
          <div class="fl-dialog__body">
            <p>
              Creates a new volume with the data from this copy. The running application is not
              affected.
            </p>
            <p class="fl-mono break-all text-fl-ink-muted">{{ snap.exportId }}</p>
            <label class="fl-check items-start">
              <input
                type="checkbox"
                [checked]="restoreAndSwap()"
                (change)="restoreAndSwap.set(!restoreAndSwap())"
              />
              <span class="flex flex-col gap-0.5">
                Also switch the application to the new volume
                <span class="text-fl-caption text-fl-ink-muted">
                  Triggers a rolling restart. The current volume stays in the cluster as a backup.
                </span>
              </span>
            </label>
          </div>
          <footer class="fl-dialog__footer">
            <button
              flButton="ghost"
              type="button"
              (click)="cancelled.emit()"
              [disabled]="restoring()"
            >
              Cancel
            </button>
            <button
              flButton="primary"
              type="button"
              (click)="execute.emit(restoreAndSwap())"
              [disabled]="restoring()"
            >
              @if (restoring()) {
                <fl-spinner label="Restoring" />
                {{ restoreAndSwap() ? 'Restoring and switching…' : 'Restoring…' }}
              } @else {
                {{ restoreAndSwap() ? 'Restore and switch' : 'Restore' }}
              }
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class SnapshotRestoreDialogComponent {
  readonly snapshot = input<ApplicationSnapshot | null>(null);
  readonly restoring = input(false);

  readonly execute = output<boolean>();
  readonly cancelled = output<void>();

  readonly restoreAndSwap = signal(false);

  constructor() {
    effect(() => {
      if (this.snapshot()) {
        this.restoreAndSwap.set(false);
      }
    });
  }
}
