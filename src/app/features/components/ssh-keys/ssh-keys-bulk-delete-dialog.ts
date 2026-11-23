import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { ProviderRef } from './ssh-keys-rows';

@Component({
  selector: 'app-ssh-keys-bulk-delete-dialog',
  imports: [CdkTrapFocus, FlAlert, FlField, FlButton, FlIcon, FlSpinner, FlStatus],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      (click)="close()"
      (keydown.escape)="close()"
    >
      <div
        class="fl-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ssh-keys-bulk-delete-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="ssh-keys-bulk-delete-title">
            Delete {{ count() }} {{ count() === 1 ? 'key' : 'keys' }}
          </h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            [disabled]="deleting()"
            (click)="close()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          @if (deleting()) {
            <fl-status tone="progress" [label]="'Deleting ' + progress() + ' of ' + count()" />
          }
          @if (error()) {
            <fl-alert tone="error" title="Keys not deleted">{{ error() }}</fl-alert>
          }
          @if (success()) {
            <fl-status tone="success" [label]="successMessage()" />
          }
          @if (!deleting() && !success()) {
            <fl-field
              label="Remove from"
              for="ssh-keys-bulk-scope"
              hint="Keys read from a provider are removed from that provider."
            >
              <span class="fl-select-wrap">
                <select
                  id="ssh-keys-bulk-scope"
                  class="fl-select"
                  [value]="scope()"
                  (change)="scopeChange.emit($any($event.target).value)"
                >
                  <option value="all">Flui and every synced provider</option>
                  <option value="db-only">Flui only</option>
                  @for (p of providers(); track p.id) {
                    <option [value]="p.id">Flui and {{ p.displayName }} only</option>
                  }
                </select>
              </span>
            </fl-field>
            <p class="text-fl-ink-muted">This cannot be undone.</p>
          }
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" [disabled]="deleting()" (click)="close()">
            {{ success() ? 'Close' : 'Cancel' }}
          </button>
          @if (!success()) {
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
                Delete {{ count() }} {{ count() === 1 ? 'key' : 'keys' }}
              }
            </button>
          }
        </footer>
      </div>
    </div>
  `,
})
export class SshKeysBulkDeleteDialog {
  readonly count = input.required<number>();
  readonly scope = input.required<string>();
  readonly providers = input<readonly ProviderRef[]>([]);
  readonly deleting = input(false);
  readonly progress = input(0);
  readonly error = input<string | null>(null);
  readonly success = input(false);
  readonly successMessage = input('');
  readonly scopeChange = output<string>();
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected close(): void {
    if (!this.deleting()) this.cancelled.emit();
  }
}
