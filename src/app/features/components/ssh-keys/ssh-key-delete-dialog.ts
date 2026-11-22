import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import type { SSHKeyDto } from '../../../core/api';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { ProviderRef } from './ssh-keys-rows';

@Component({
  selector: 'app-ssh-key-delete-dialog',
  imports: [FlAlert, FlField, FlKeyValue, FlKvItem, FlButton, FlIcon, FlSpinner, FlStatus],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="close()"
    >
      <div
        class="fl-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ssh-key-delete-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="ssh-key-delete-title">Delete {{ key().name }}</h2>
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
          <fl-key-value>
            <fl-kv-item key="Name">{{ key().name }}</fl-kv-item>
            <fl-kv-item key="Fingerprint" [mono]="true">{{ key().fingerprint }}</fl-kv-item>
          </fl-key-value>

          @if (key().syncedFromProvider) {
            <fl-key-value>
              <fl-kv-item key="Remove from">
                <span class="capitalize">{{ key().source }}</span>
                <span class="text-fl-ink-muted"> (not stored in Flui)</span>
              </fl-kv-item>
            </fl-key-value>
          } @else {
            <fl-field label="Remove from" for="ssh-key-delete-scope">
              <span class="fl-select-wrap">
                <select
                  id="ssh-key-delete-scope"
                  class="fl-select"
                  [value]="scope()"
                  [disabled]="deleting() || success()"
                  (change)="scopeChange.emit($any($event.target).value)"
                >
                  <option value="all">Flui and every synced provider</option>
                  <option value="db-only">Flui only</option>
                  @for (p of syncedProviders(); track p.id) {
                    <option [value]="p.id">Flui and {{ p.displayName }} only</option>
                  }
                </select>
              </span>
            </fl-field>
          }

          @if (error()) {
            <fl-alert tone="error" title="Key not deleted">{{ error() }}</fl-alert>
          } @else if (success()) {
            <fl-status tone="success" label="Key deleted" />
          } @else {
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
                Delete key
              }
            </button>
          }
        </footer>
      </div>
    </div>
  `,
})
export class SshKeyDeleteDialog {
  readonly key = input.required<SSHKeyDto>();
  readonly scope = input.required<string>();
  readonly syncedProviders = input<readonly ProviderRef[]>([]);
  readonly deleting = input(false);
  readonly error = input<string | null>(null);
  readonly success = input(false);
  readonly scopeChange = output<string>();
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected close(): void {
    if (!this.deleting()) this.cancelled.emit();
  }
}
