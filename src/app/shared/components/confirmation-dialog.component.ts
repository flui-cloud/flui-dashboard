import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, Input, signal, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../ui/primitives/button';
import { FlIcon } from '../../ui/primitives/icon';
import { FlSpinner } from '../../ui/primitives/spinner';

export type ConfirmationDialogVariant = 'danger' | 'warning' | 'info';

let nextId = 0;

@Component({
  selector: 'app-confirmation-dialog',
  imports: [CdkTrapFocus, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  host: { '(document:keydown.escape)': 'isOpen() && onCancel()' },
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
          [attr.role]="variant() === 'info' ? 'dialog' : 'alertdialog'"
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
            <p class="m-0">{{ message() }}</p>
            @if (details?.length) {
              <div class="flex flex-col gap-2">
                <button
                  flButton="ghost"
                  size="sm"
                  type="button"
                  class="self-start px-0"
                  [attr.aria-expanded]="detailsOpen()"
                  (click)="detailsOpen.set(!detailsOpen())"
                >
                  {{ detailsOpen() ? 'Hide details' : 'What exactly happens' }}
                </button>
                @if (detailsOpen()) {
                  <ul
                    class="m-0 flex list-disc flex-col gap-1 pl-5 text-fl-body-sm text-fl-ink-secondary"
                  >
                    @for (line of details; track line) {
                      <li>{{ line }}</li>
                    }
                  </ul>
                }
              </div>
            }
          </div>
          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" [disabled]="isProcessing()" (click)="onCancel()">
              {{ cancelText() }}
            </button>
            <button
              [flButton]="variant() === 'danger' ? 'danger' : 'primary'"
              type="button"
              [disabled]="isProcessing()"
              (click)="onConfirm()"
            >
              @if (isProcessing()) {
                <fl-spinner [label]="processingText() ?? confirmText()" />
                {{ processingText() ?? confirmText() }}
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
export class ConfirmationDialogComponent {
  readonly processingText = input<string>();
  @Input() details?: string[];

  protected readonly detailsOpen = signal(false);
  protected readonly titleId = `confirmation-dialog-title-${nextId++}`;

  readonly title = input('Confirm Action');
  readonly message = input('Are you sure you want to proceed?');
  readonly confirmText = input('Confirm');
  readonly cancelText = input('Cancel');
  readonly variant = input<ConfirmationDialogVariant>('info');
  readonly icon = input<string>();

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  isOpen = signal(false);
  isProcessing = signal(false);

  get iconName(): string {
    const icon = this.icon();
    if (icon) return icon;

    switch (this.variant()) {
      case 'danger':
        return 'lucideCircleAlert';
      case 'warning':
        return 'lucideTriangleAlert';
      default:
        return 'lucideInfo';
    }
  }

  open() {
    this.isOpen.set(true);
    this.isProcessing.set(false);
    this.detailsOpen.set(false);
  }

  close() {
    this.isOpen.set(false);
    this.isProcessing.set(false);
  }

  setProcessing(processing: boolean) {
    this.isProcessing.set(processing);
  }

  onConfirm() {
    this.confirmed.emit();
  }

  onCancel() {
    if (this.isProcessing()) return;
    this.cancelled.emit();
    this.close();
  }
}
