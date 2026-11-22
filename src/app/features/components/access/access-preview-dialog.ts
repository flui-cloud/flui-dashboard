import { Component, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

let nextId = 0;

@Component({
  selector: 'app-access-preview-dialog',
  imports: [FlButton, FlIcon],
  providers: [provideIcons({ lucideX })],
  template: `
    @if (isOpen()) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="cancel()"
        (keydown.escape)="cancel()"
      >
        <div
          class="fl-dialog"
          [attr.role]="destructive() ? 'alertdialog' : 'dialog'"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" [id]="titleId">{{ title() }}</h2>
            <button type="button" class="fl-dialog__close" aria-label="Close" (click)="cancel()">
              <fl-icon name="lucideX" />
            </button>
          </header>
          <div class="fl-dialog__body">
            <p>{{ message() }}</p>
            @if (details().length) {
              <div>
                <button
                  type="button"
                  class="fl-link text-fl-body-sm"
                  [attr.aria-expanded]="detailsOpen()"
                  (click)="detailsOpen.set(!detailsOpen())"
                >
                  {{ detailsOpen() ? 'Hide details' : 'What exactly happens' }}
                </button>
              </div>
              @if (detailsOpen()) {
                <ul class="flex flex-col gap-1.5 text-fl-body-sm text-fl-ink-secondary">
                  @for (line of details(); track line) {
                    <li>{{ line }}</li>
                  }
                </ul>
              }
            }
          </div>
          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" (click)="cancel()">Cancel</button>
            <button
              [flButton]="destructive() ? 'danger' : 'primary'"
              type="button"
              (click)="confirmed.emit()"
            >
              {{ confirmLabel() }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class AccessPreviewDialog {
  readonly title = input.required<string>();
  readonly message = input('');
  readonly details = input<readonly string[]>([]);
  readonly confirmLabel = input('Confirm');
  readonly destructive = input(true);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly isOpen = signal(false);
  protected readonly detailsOpen = signal(false);
  protected readonly titleId = `access-preview-title-${nextId++}`;

  open(): void {
    this.detailsOpen.set(false);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  protected cancel(): void {
    this.cancelled.emit();
    this.close();
  }
}
