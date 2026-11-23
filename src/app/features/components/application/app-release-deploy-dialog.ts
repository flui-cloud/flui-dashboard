import { Component, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { AvailableVersionDto } from '../../../core/api/model/availableVersionDto';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlDialogFocus } from '../../../ui/overlays/dialog-focus';

@Component({
  selector: 'app-release-deploy-dialog',
  imports: [FlDialogFocus, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  host: { class: 'contents' },
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="cancelled.emit()"
    >
      <div
        class="fl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-deploy-title"
        flDialogFocus
        (dismissed)="busy() || cancelled.emit()"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="release-deploy-title">Deploy version</h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            [disabled]="busy()"
            (click)="cancelled.emit()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          <p>This replaces the running version with:</p>
          <p class="fl-mono break-all">{{ version().imageRef }}</p>
          <div class="fl-field">
            <label class="fl-field__label" for="deploy-reason">Reason (optional)</label>
            <div class="fl-input fl-input--lg">
              <input
                id="deploy-reason"
                type="text"
                maxlength="200"
                placeholder="Bump to v1.2.3 for a hotfix"
                [value]="reason()"
                (input)="onInput($event)"
                [disabled]="busy()"
              />
            </div>
          </div>
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="cancelled.emit()" [disabled]="busy()">
            Cancel
          </button>
          <button
            flButton="primary"
            type="button"
            (click)="confirm.emit(reason())"
            [disabled]="busy()"
          >
            @if (busy()) {
              <fl-spinner label="Deploying" />
              Deploying…
            } @else {
              Deploy
            }
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class AppReleaseDeployDialog {
  readonly version = input.required<AvailableVersionDto>();
  readonly busy = input(false);
  readonly cancelled = output<void>();
  readonly confirm = output<string>();
  protected readonly reason = signal('');

  protected onInput(event: Event): void {
    this.reason.set((event.target as HTMLInputElement).value);
  }
}
