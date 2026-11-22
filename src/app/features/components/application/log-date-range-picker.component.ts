import { Component, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlButton } from '../../../ui/primitives/button';

export interface LogDateRange {
  start: string;
  end: string;
}

function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Component({
  selector: 'app-log-date-range-picker',
  standalone: true,
  imports: [FormsModule, FlButton],
  template: `
    <div class="flex w-full flex-col gap-4 p-4">
      <fieldset class="fl-fieldset">
        <legend>Start</legend>
        <div class="flex gap-2">
          <label class="fl-input flex-1">
            <span class="fl-sr">Start date</span>
            <input type="date" [ngModel]="startDate()" (ngModelChange)="startDate.set($event)" />
          </label>
          <label class="fl-input w-32">
            <span class="fl-sr">Start time</span>
            <input
              type="time"
              step="1"
              [ngModel]="startTime()"
              (ngModelChange)="startTime.set($event)"
            />
          </label>
        </div>
      </fieldset>

      <fieldset class="fl-fieldset">
        <legend>End</legend>
        <div class="flex gap-2">
          <label class="fl-input flex-1">
            <span class="fl-sr">End date</span>
            <input type="date" [ngModel]="endDate()" (ngModelChange)="endDate.set($event)" />
          </label>
          <label class="fl-input w-32">
            <span class="fl-sr">End time</span>
            <input
              type="time"
              step="1"
              [ngModel]="endTime()"
              (ngModelChange)="endTime.set($event)"
            />
          </label>
        </div>
      </fieldset>

      @if (validationError()) {
        <p class="fl-field__error" role="alert">{{ validationError() }}</p>
      }

      <div class="flex justify-end gap-2 border-t border-fl-border-subtle pt-3">
        <button flButton size="sm" type="button" (click)="cancelled.emit()">Cancel</button>
        <button
          flButton="primary"
          size="sm"
          type="button"
          (click)="applyRange()"
          [disabled]="!canApply()"
        >
          Apply
        </button>
      </div>
    </div>
  `,
})
export class LogDateRangePickerComponent {
  readonly rangeSelected = output<LogDateRange>();
  readonly cancelled = output<void>();

  readonly startDate = signal(todayLocal());
  readonly startTime = signal('00:00:00');
  readonly endDate = signal(todayLocal());
  readonly endTime = signal('23:59:59');
  readonly validationError = signal<string | null>(null);

  readonly canApply = computed(() => !!this.startDate() && !!this.endDate());

  applyRange() {
    const sd = this.startDate();
    const ed = this.endDate();
    if (!sd || !ed) return;

    const start = new Date(`${sd}T${this.startTime()}`);
    const end = new Date(`${ed}T${this.endTime()}`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      this.validationError.set('Invalid date or time');
      return;
    }

    if (start >= end) {
      this.validationError.set('Start must be before end');
      return;
    }

    this.validationError.set(null);
    this.rangeSelected.emit({
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }
}
