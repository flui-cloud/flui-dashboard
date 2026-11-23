import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

let nextId = 0;

@Component({
  selector: 'app-repositories-confirm-dialog',
  imports: [CdkTrapFocus, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  host: { '(document:keydown.escape)': 'cancel()' },
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="cancel()"
    >
      <div
        class="fl-dialog"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" [id]="titleId">{{ title() }}</h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            [disabled]="busy()"
            (click)="cancel()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          <p>{{ body() }}</p>
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" [disabled]="busy()" (click)="cancel()">
            Cancel
          </button>
          <button flButton="danger" type="button" [disabled]="busy()" (click)="confirmed.emit()">
            @if (busy()) {
              <fl-spinner [label]="busyLabel()" />
              {{ busyLabel() }}
            } @else {
              {{ confirmLabel() }}
            }
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class RepositoriesConfirmDialog {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly busyLabel = input('Working…');
  readonly busy = input(false);
  readonly cancelled = output<void>();
  readonly confirmed = output<void>();

  protected readonly titleId = `repositories-confirm-title-${nextId++}`;

  protected cancel(): void {
    if (this.busy()) return;
    this.cancelled.emit();
  }
}
