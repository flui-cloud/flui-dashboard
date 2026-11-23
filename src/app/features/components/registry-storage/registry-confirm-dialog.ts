import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

let nextId = 0;

@Component({
  selector: 'app-registry-confirm-dialog',
  imports: [CdkTrapFocus, FlButton, FlIcon],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      [attr.data-testid]="testId()"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      (click)="cancelled.emit()"
      (keydown.escape)="cancelled.emit()"
    >
      <div
        class="fl-dialog"
        [attr.role]="danger() ? 'alertdialog' : 'dialog'"
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
            (click)="cancelled.emit()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body"><ng-content /></div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
          <button
            [flButton]="danger() ? 'danger' : 'primary'"
            type="button"
            [attr.data-testid]="submitTestId()"
            (click)="confirmed.emit()"
          >
            {{ confirmLabel() }}
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class RegistryConfirmDialog {
  readonly title = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly testId = input.required<string>();
  readonly submitTestId = input.required<string>();
  readonly danger = input(false);
  readonly cancelled = output<void>();
  readonly confirmed = output<void>();

  protected readonly titleId = `registry-confirm-title-${nextId++}`;
}
