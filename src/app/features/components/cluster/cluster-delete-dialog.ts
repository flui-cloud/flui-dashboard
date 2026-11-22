import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-cluster-delete-dialog',
  imports: [FormsModule, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="cancelled.emit()"
    >
      <div
        class="fl-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cluster-delete-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="cluster-delete-title">Delete {{ name() }}</h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            [disabled]="deleting()"
            (click)="cancelled.emit()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          <p>
            This removes the cluster, its nodes and everything running on it. It cannot be undone.
          </p>
          <label class="fl-check">
            <input type="checkbox" [(ngModel)]="force" [disabled]="deleting()" />
            <span>Force delete, skipping the cleanup of provider resources</span>
          </label>
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" [disabled]="deleting()" (click)="cancelled.emit()">
            Cancel
          </button>
          <button
            flButton="danger"
            type="button"
            [disabled]="deleting()"
            (click)="confirmed.emit()"
          >
            @if (deleting()) {
              <fl-spinner label="Deleting" />
              Deleting…
            } @else {
              Delete cluster
            }
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class ClusterDeleteDialog {
  readonly name = input.required<string>();
  readonly deleting = input(false);
  readonly force = model(false);
  readonly cancelled = output<void>();
  readonly confirmed = output<void>();
}
