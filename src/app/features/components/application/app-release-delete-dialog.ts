import { Component, input, model, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { AvailableVersionDto } from '../../../core/api/model/availableVersionDto';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { releaseStateOf, shortDigest } from './app-release-row';
import { FlDialogFocus } from '../../../ui/overlays/dialog-focus';

@Component({
  selector: 'app-release-delete-dialog',
  imports: [FlDialogFocus, FlAlert, FlKeyValue, FlKvItem, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  host: { class: 'contents' },
  template: `
    @let v = version();
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="cancelled.emit()"
    >
      <div
        class="fl-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="release-delete-title"
        flDialogFocus
        (dismissed)="deleting() || cancelled.emit()"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="release-delete-title">Delete image {{ v.tag }}</h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            [disabled]="deleting()"
            (click)="cancelled.emit()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          <p>
            This permanently removes the image from GitHub Container Registry. It cannot be undone.
          </p>
          <p class="fl-mono break-all">{{ v.imageRef }}</p>
          <fl-key-value class="fl-kv--compact">
            <fl-kv-item key="Tag" [mono]="true">{{ v.tag }}</fl-kv-item>
            @if (v.digest) {
              <fl-kv-item key="Digest" [mono]="true">{{ digest(v.digest) }}</fl-kv-item>
            }
            @if ((v.releaseCount ?? 0) > 0) {
              <fl-kv-item key="Releases">{{ v.releaseCount }}</fl-kv-item>
            }
            @if (v.lastRelease) {
              <fl-kv-item key="Last release">{{ lastStatus() }}</fl-kv-item>
            }
          </fl-key-value>
          @if (v.isLatestRelease) {
            <fl-alert tone="warning" title="Latest release">
              This is the latest release of the application, even if it no longer runs. Deleting it
              rules out a fast rollback to this version.
              <label alertActions class="fl-check">
                <input
                  type="checkbox"
                  [checked]="force()"
                  (change)="onForce($event)"
                  [disabled]="deleting()"
                />
                Delete it anyway
              </label>
            </fl-alert>
          }
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="cancelled.emit()" [disabled]="deleting()">
            Cancel
          </button>
          <button
            flButton="danger"
            type="button"
            (click)="confirm.emit()"
            [disabled]="deleting() || (v.isLatestRelease && !force())"
          >
            @if (deleting()) {
              <fl-spinner label="Deleting" />
              Deleting…
            } @else {
              Delete image
            }
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class AppReleaseDeleteDialog {
  readonly version = input.required<AvailableVersionDto>();
  readonly deleting = input(false);
  readonly force = model(false);
  readonly cancelled = output<void>();
  readonly confirm = output<void>();

  protected lastStatus(): string {
    return releaseStateOf(this.version(), false).label;
  }

  protected digest(value: string): string {
    return shortDigest(value);
  }

  protected onForce(event: Event): void {
    this.force.set((event.target as HTMLInputElement).checked);
  }
}
