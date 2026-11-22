import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy, lucideDownload, lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlTag } from '../../../ui/primitives/tag';
import { ParsedError } from './endpoint-format';

@Component({
  selector: 'app-endpoint-error-dialog',
  imports: [FlButton, FlIcon, FlTag],
  providers: [provideIcons({ lucideCheck, lucideCopy, lucideDownload, lucideX })],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="closed.emit()"
    >
      <div
        class="fl-dialog fl-dialog--wide"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="error().title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <div class="flex min-w-0 items-center gap-2">
            <h2 class="fl-dialog__title">{{ error().title }}</h2>
            @if (error().httpCode) {
              <fl-tag class="fl-mono">HTTP {{ error().httpCode }}</fl-tag>
            }
          </div>
          <div class="flex items-center gap-1">
            @if (error().rawJson) {
              <button
                flButton="ghost"
                size="sm"
                type="button"
                [iconOnly]="true"
                aria-label="Download full JSON"
                title="Download full JSON"
                (click)="download.emit()"
              >
                <fl-icon name="lucideDownload" />
              </button>
            }
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              (click)="closed.emit()"
            >
              <fl-icon name="lucideX" />
            </button>
          </div>
        </header>

        <div class="fl-dialog__body">
          @if (error().certMessage; as message) {
            <section class="flex flex-col gap-2" aria-label="Certificate error">
              <div class="flex items-center justify-between gap-2">
                <h3 class="m-0 text-fl-body-sm font-semibold">Certificate error</h3>
                <button
                  flButton="ghost"
                  size="sm"
                  type="button"
                  [iconOnly]="true"
                  [attr.aria-label]="messageCopied() ? 'Copied' : 'Copy message'"
                  [title]="messageCopied() ? 'Copied' : 'Copy message'"
                  (click)="copyMessage.emit(message)"
                >
                  <fl-icon [name]="messageCopied() ? 'lucideCheck' : 'lucideCopy'" />
                </button>
              </div>
              <pre
                class="m-0 whitespace-pre-wrap break-all rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3 fl-mono"
                >{{ message }}</pre>
            </section>
          }

          @if (error().k8sMessage) {
            <section class="flex flex-col gap-1" aria-label="Message">
              <h3 class="m-0 text-fl-body-sm font-semibold">Message</h3>
              <p class="m-0">{{ error().k8sMessage }}</p>
            </section>
          }

          @if (error().causes.length > 0) {
            <section class="flex flex-col gap-2" aria-label="Causes">
              <h3 class="m-0 text-fl-body-sm font-semibold">Causes</h3>
              <ul class="m-0 flex list-none flex-col gap-2 p-0">
                @for (cause of error().causes; track $index) {
                  <li class="flex flex-col gap-0.5 rounded-fl-md border border-fl-border p-3">
                    <span class="flex flex-wrap items-center gap-2">
                      <span class="fl-mono font-medium">{{ cause.reason }}</span>
                      @if (cause.field) {
                        <span class="fl-mono text-fl-ink-muted">{{ cause.field }}</span>
                      }
                    </span>
                    <span class="text-fl-ink-secondary">{{ cause.message }}</span>
                  </li>
                }
              </ul>
            </section>
          }

          @if (!error().certMessage && !error().k8sMessage && error().causes.length === 0) {
            <pre
              class="m-0 overflow-x-auto whitespace-pre-wrap break-all rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3 fl-mono"
              >{{ error().rawJson }}</pre>
          }
        </div>

        <footer class="fl-dialog__footer">
          <button flButton type="button" (click)="closed.emit()">Close</button>
        </footer>
      </div>
    </div>
  `,
})
export class EndpointErrorDialog {
  readonly error = input.required<ParsedError>();
  readonly messageCopied = input(false);
  readonly closed = output<void>();
  readonly download = output<void>();
  readonly copyMessage = output<string>();
}
