import {
  Component, output, signal, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface LogDateRange {
  start: string; // ISO 8601
  end: string;   // ISO 8601
}

function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Component({
  selector: 'app-log-date-range-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="flex flex-col gap-4 p-4 w-full">

      <!-- Start -->
      <div class="flex flex-col gap-1.5">
        <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start</span>
        <div class="flex gap-2">
          <input
            type="date"
            [ngModel]="startDate()"
            (ngModelChange)="startDate.set($event)"
            class="flex-1 px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="time"
            step="1"
            [ngModel]="startTime()"
            (ngModelChange)="startTime.set($event)"
            class="w-28 px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <!-- End -->
      <div class="flex flex-col gap-1.5">
        <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">End</span>
        <div class="flex gap-2">
          <input
            type="date"
            [ngModel]="endDate()"
            (ngModelChange)="endDate.set($event)"
            class="flex-1 px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="time"
            step="1"
            [ngModel]="endTime()"
            (ngModelChange)="endTime.set($event)"
            class="w-28 px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <!-- Validation hint -->
      @if (validationError()) {
        <p class="text-xs text-red-500">{{ validationError() }}</p>
      }

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
        <button
          type="button"
          (click)="cancelled.emit()"
          class="px-3 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          (click)="applyRange()"
          [disabled]="!canApply()"
          class="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
    const end   = new Date(`${ed}T${this.endTime()}`);

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
