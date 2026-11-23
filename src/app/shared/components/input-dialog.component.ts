import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, Input, signal, input, output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../ui/primitives/button';
import { FlIcon } from '../../ui/primitives/icon';
import { FlSpinner } from '../../ui/primitives/spinner';

let nextId = 0;

@Component({
  selector: 'app-input-dialog',
  imports: [CdkTrapFocus, FormsModule, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  host: { '(document:keydown.escape)': 'isOpen() && onCancel()' },
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (isOpen()) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="onCancel()"
      >
        <div
          class="fl-dialog"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          role="dialog"
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
              [disabled]="isProcessing()"
              (click)="onCancel()"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>
          <div class="fl-dialog__body">
            @if (message) {
              <p class="m-0">{{ message }}</p>
            }
            <div class="fl-field" [class.is-invalid]="!!error()">
              <div class="fl-input fl-input--lg">
                <input
                  #field
                  cdkFocusInitial
                  type="text"
                  [attr.aria-labelledby]="titleId"
                  [(ngModel)]="value"
                  [placeholder]="placeholder()"
                  [disabled]="isProcessing()"
                  (keydown.enter)="onConfirm()"
                />
              </div>
              @if (error()) {
                <span class="fl-field__error" role="alert">{{ error() }}</span>
              }
            </div>
          </div>
          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" [disabled]="isProcessing()" (click)="onCancel()">
              {{ cancelText() }}
            </button>
            <button
              flButton="primary"
              type="button"
              [disabled]="isProcessing() || !value.trim()"
              (click)="onConfirm()"
            >
              @if (isProcessing()) {
                <fl-spinner [label]="confirmText()" />
                {{ confirmText() }}…
              } @else {
                {{ confirmText() }}
              }
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class InputDialogComponent {
  readonly title = input('Enter a value');
  @Input() message = '';
  readonly placeholder = input('');
  readonly confirmText = input('Create');
  readonly cancelText = input('Cancel');
  readonly icon = input('lucidePencil');

  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  protected readonly titleId = `input-dialog-title-${nextId++}`;

  value = '';
  isOpen = signal(false);
  isProcessing = signal(false);
  error = signal<string | null>(null);

  open(initial = '') {
    this.value = initial;
    this.error.set(null);
    this.isProcessing.set(false);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.isProcessing.set(false);
  }

  setProcessing(processing: boolean) {
    this.isProcessing.set(processing);
  }

  setError(message: string) {
    this.error.set(message);
    this.isProcessing.set(false);
  }

  onConfirm() {
    const v = this.value.trim();
    if (!v || this.isProcessing()) return;
    this.confirmed.emit(v);
  }

  onCancel() {
    if (this.isProcessing()) return;
    this.cancelled.emit();
    this.close();
  }
}
