import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, Input, signal, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../ui/primitives/button';
import { FlIcon } from '../../ui/primitives/icon';
import { FlSpinner } from '../../ui/primitives/spinner';
import { FlAlert } from '../../ui/patterns/alert';

export interface DeleteConfirmationData {
  title: string;
  description: string;
  itemName: string;
  itemDescription?: string;
  warningMessage?: string;
  confirmButtonText?: string;
}

let nextId = 0;

@Component({
  selector: 'app-delete-confirmation-dialog',
  imports: [CdkTrapFocus, FlButton, FlIcon, FlSpinner, FlAlert],
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
          role="alertdialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" [id]="titleId">{{ data()?.title }}</h2>
            <button type="button" class="fl-dialog__close" aria-label="Close" (click)="onCancel()">
              <fl-icon name="lucideX" />
            </button>
          </header>
          <div class="fl-dialog__body">
            <p class="m-0">{{ data()?.description || 'This action cannot be undone' }}</p>
            <div class="flex flex-col gap-1">
              <span class="text-fl-caption text-fl-ink-muted">You are about to delete</span>
              <span class="font-mono font-semibold text-fl-ink">{{ data()?.itemName }}</span>
              @if (data()?.itemDescription) {
                <span class="text-fl-body-sm text-fl-ink-muted">{{ data()?.itemDescription }}</span>
              }
            </div>
            @if (data()?.warningMessage; as warning) {
              <fl-alert tone="warning" title="Warning">{{ warning }}</fl-alert>
            }
          </div>
          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" [disabled]="isDeleting()" (click)="onCancel()">
              Cancel
            </button>
            <button flButton="danger" type="button" [disabled]="isDeleting()" (click)="onConfirm()">
              @if (isDeleting()) {
                <fl-spinner label="Deleting" />
                Deleting…
              } @else {
                {{ data()?.confirmButtonText || 'Delete' }}
              }
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class DeleteConfirmationDialogComponent {
  @Input() set confirmationData(value: DeleteConfirmationData | null) {
    this.data.set(value);
  }

  @Input() set deleting(value: boolean) {
    this._isDeleting.set(value);
  }

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  data = signal<DeleteConfirmationData | null>(null);
  private readonly _isDeleting = signal(false);
  private readonly _isOpen = signal(false);
  protected readonly titleId = `delete-confirmation-title-${nextId++}`;

  isOpen = this._isOpen.asReadonly();
  isDeleting = this._isDeleting.asReadonly();

  open(confirmationData: DeleteConfirmationData) {
    this.data.set(confirmationData);
    this._isOpen.set(true);
  }

  close() {
    this._isOpen.set(false);
    this._isDeleting.set(false);
  }

  onConfirm() {
    this.confirmed.emit();
  }

  onCancel() {
    this.cancelled.emit();
    this.close();
  }
}
