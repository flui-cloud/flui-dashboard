import { Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { CronConcurrencyPolicy } from '../../model/scheduled-job.models';
import { describeCron } from './cron-text';
import { FlDialogFocus } from '../../../ui/overlays/dialog-focus';

@Component({
  selector: 'app-schedule-editor',
  imports: [FlDialogFocus, FormsModule, FlField, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  template: `
    <div class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        class="fl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-editor-title"
        flDialogFocus
        (dismissed)="cancelled.emit()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="schedule-editor-title">
            {{ editing() ? 'Edit scheduled job' : 'New scheduled job' }}
          </h2>
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
          <fl-field
            label="Name"
            for="schedule-name"
            [hint]="editing() ? 'The name identifies the schedule and cannot be changed.' : ''"
          >
            <div class="fl-input fl-input--lg">
              <input
                id="schedule-name"
                placeholder="nightly-cleanup"
                [disabled]="!!editing()"
                [ngModel]="name()"
                (ngModelChange)="name.set($event)"
              />
            </div>
          </fl-field>

          <fl-field label="Schedule (cron)" for="schedule-cron" [hint]="scheduleHint()">
            <div class="fl-input fl-input--lg">
              <input
                id="schedule-cron"
                class="fl-mono"
                placeholder="0 3 * * *"
                [ngModel]="schedule()"
                (ngModelChange)="schedule.set($event)"
              />
            </div>
          </fl-field>

          <fl-field label="Command" for="schedule-command">
            <div class="fl-input fl-input--lg">
              <input
                id="schedule-command"
                class="fl-mono"
                placeholder="node dist/cleanup.js"
                [ngModel]="command()"
                (ngModelChange)="command.set($event)"
              />
            </div>
          </fl-field>

          <div class="grid grid-cols-2 gap-3">
            <fl-field label="Timezone" for="schedule-timezone">
              <div class="fl-input fl-input--lg">
                <input
                  id="schedule-timezone"
                  placeholder="Europe/Rome"
                  [ngModel]="timezone()"
                  (ngModelChange)="timezone.set($event)"
                />
              </div>
            </fl-field>
            <fl-field label="Overlap" for="schedule-overlap">
              <span class="fl-select-wrap">
                <select
                  id="schedule-overlap"
                  class="fl-select"
                  [ngModel]="concurrency()"
                  (ngModelChange)="concurrency.set($event)"
                >
                  <option value="Forbid">Forbid (skip)</option>
                  <option value="Allow">Allow</option>
                  <option value="Replace">Replace</option>
                </select>
              </span>
            </fl-field>
          </div>

          @if (error()) {
            <p class="fl-field__error" role="alert">{{ error() }}</p>
          }
        </div>

        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
          <button flButton="primary" type="button" [disabled]="saving()" (click)="saved.emit()">
            @if (saving()) {
              <fl-spinner label="Saving" />
            }
            {{ editing() ? 'Save' : 'Create' }}
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class ScheduleEditor {
  readonly editing = input<string | null>(null);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly name = model('');
  readonly schedule = model('');
  readonly command = model('');
  readonly timezone = model('');
  readonly concurrency = model<CronConcurrencyPolicy>('Forbid');
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  protected readonly scheduleHint = computed(() => {
    const cron = this.schedule().trim();
    return cron ? describeCron(cron) : '5 fields: minute hour day month weekday.';
  });
}
