import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { ApplicationSnapshot } from '../../model/volume-management.models';

@Component({
  selector: 'app-snapshot-delete-dialog',
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
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="snapshot-delete-title"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="snapshot-delete-title">Delete copy</h2>
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              (click)="cancelled.emit()"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>
          <div class="fl-dialog__body">
            <p>This permanently removes the copy.</p>
            <p class="fl-mono break-all text-fl-ink-muted">{{ snap.exportId }}</p>
          </div>
          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
            <button
              flButton="danger"
              type="button"
              (click)="execute.emit()"
              [disabled]="deleting()"
            >
              @if (deleting()) {
                <fl-spinner label="Deleting" />
                Deleting…
              } @else {
                Delete
              }
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class SnapshotDeleteDialogComponent {
  readonly snapshot = input<ApplicationSnapshot | null>(null);
  readonly deleting = input(false);

  readonly execute = output<void>();
  readonly cancelled = output<void>();
}
