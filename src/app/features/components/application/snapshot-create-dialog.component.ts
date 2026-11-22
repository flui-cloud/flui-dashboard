import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { CreateSnapshotRequest } from '../../model/volume-management.models';

@Component({
  selector: 'app-snapshot-create-dialog',
  imports: [FormsModule, FlField, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  template: `
    @if (open()) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="cancelled.emit()"
      >
        <div
          class="fl-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="snapshot-create-title"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="snapshot-create-title">Take a copy of this volume</h2>
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              (click)="cancelled.emit()"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>

          <div class="fl-dialog__body">
            <p class="text-fl-ink-muted">Captures the current data of this application's volume.</p>
            <fl-field label="Description (optional)" for="snapshot-description">
              <div class="fl-input fl-input--lg">
                <input
                  id="snapshot-description"
                  type="text"
                  [ngModel]="description()"
                  (ngModelChange)="description.set($event)"
                  placeholder="before-major-upgrade"
                  maxlength="120"
                />
              </div>
            </fl-field>
            <label class="fl-check items-start">
              <input type="checkbox" [ngModel]="pause()" (ngModelChange)="pause.set($event)" />
              <span class="flex flex-col gap-0.5">
                Stop the application during the copy
                <span class="text-fl-caption text-fl-ink-muted">
                  A short interruption; it starts again as soon as the copy is taken.
                  @if (suggestPause()) {
                    A database copied while it runs may not restore.
                  }
                </span>
              </span>
            </label>
            @if (showVolume()) {
              <fl-field
                label="Volume"
                for="snapshot-volume"
                hint="Needed only when the application has more than one."
              >
                <div class="fl-input fl-input--lg">
                  <input
                    id="snapshot-volume"
                    type="text"
                    class="fl-mono"
                    [ngModel]="volumeName()"
                    (ngModelChange)="volumeName.set($event)"
                  />
                </div>
              </fl-field>
            }
          </div>

          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
            <button flButton="primary" type="button" (click)="onSubmit()" [disabled]="creating()">
              @if (creating()) {
                <fl-spinner label="Creating" />
                Creating…
              } @else {
                Create
              }
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class SnapshotCreateDialogComponent {
  readonly open = input(false);
  readonly creating = input(false);
  /** A database: copying it while it runs is refused or unsafe. */
  readonly suggestPause = input(false);
  readonly showVolume = input(false);

  readonly submitRequest = output<CreateSnapshotRequest>();
  readonly cancelled = output<void>();

  readonly description = signal('');
  readonly volumeName = signal('');
  readonly pause = signal(false);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.description.set('');
        this.volumeName.set('');
        this.pause.set(this.suggestPause());
      }
    });
  }

  onSubmit(): void {
    const description = this.description().trim();
    const volumeName = this.volumeName().trim();
    this.submitRequest.emit({
      description: description || undefined,
      volumeName: volumeName || undefined,
      ...(this.pause() ? { pause: true } : {}),
    });
  }
}
