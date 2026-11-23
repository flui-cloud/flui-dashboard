import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MaintenanceSlot,
  MaintenanceWindow,
  WEEKDAYS,
  Weekday,
} from '../../service/maintenance.service';
import { FlField } from '../../../ui/patterns';
import { FlButton, FlSpinner } from '../../../ui/primitives';

let nextEditor = 0;

/** Weekly slots in one time zone; emits the window as written. */
@Component({
  selector: 'app-maintenance-window-editor',
  imports: [FormsModule, FlField, FlButton, FlSpinner],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-4" data-testid="window-editor">
      @for (slot of slots(); track $index; let i = $index) {
        <div class="flex flex-wrap items-end gap-3">
          <div class="fl-field">
            <span class="fl-field__label" [id]="uid + '-days-' + i">Days</span>
            <div class="fl-segmented" role="group" [attr.aria-labelledby]="uid + '-days-' + i">
              @for (d of days; track d) {
                <button
                  type="button"
                  [attr.aria-pressed]="slot.days.includes(d)"
                  (click)="toggle(i, d)"
                  [attr.data-testid]="'slot-' + i + '-' + d"
                >
                  {{ dayLabel(d) }}
                </button>
              }
            </div>
          </div>
          <fl-field label="Starts at" [for]="uid + '-start-' + i">
            <div class="fl-input">
              <input
                type="time"
                class="fl-num"
                [id]="uid + '-start-' + i"
                [ngModel]="slot.start"
                (ngModelChange)="patch(i, { start: $event })"
              />
            </div>
          </fl-field>
          <fl-field label="Minutes" [for]="uid + '-minutes-' + i">
            <div class="fl-input">
              <input
                type="number"
                min="15"
                max="1440"
                step="15"
                class="fl-num"
                [id]="uid + '-minutes-' + i"
                [ngModel]="slot.durationMinutes"
                (ngModelChange)="patch(i, { durationMinutes: +$event })"
              />
            </div>
          </fl-field>
          @if (slots().length > 1) {
            <button flButton="ghost" size="sm" type="button" (click)="remove(i)">Remove</button>
          }
        </div>
      }
      <div>
        <button flButton size="sm" type="button" (click)="add()">Add a slot</button>
      </div>
      <fl-field label="Time zone" [for]="uid + '-timezone'" class="max-w-sm">
        <div class="fl-input fl-input--lg">
          <input
            [id]="uid + '-timezone'"
            [ngModel]="timezone()"
            (ngModelChange)="timezone.set($event)"
            data-testid="window-timezone"
          />
        </div>
      </fl-field>
      <div class="fl-row">
        <button
          flButton="primary"
          type="button"
          [disabled]="saving()"
          (click)="emit()"
          data-testid="window-save"
        >
          @if (saving()) {
            <fl-spinner label="Saving" />
            Saving…
          } @else {
            Save window
          }
        </button>
        <button flButton="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
      </div>
    </div>
  `,
})
export class MaintenanceWindowEditorComponent {
  readonly value = input<MaintenanceWindow | null>(null);
  readonly saving = input(false);
  readonly saved = output<MaintenanceWindow>();
  readonly cancelled = output<void>();

  protected readonly uid = `window-editor-${nextEditor++}`;
  protected readonly days = WEEKDAYS;
  protected readonly slots = signal<MaintenanceSlot[]>([]);
  protected readonly timezone = signal(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  constructor() {
    effect(() => {
      const v = this.value();
      this.slots.set(
        v?.slots.length
          ? v.slots.map((s) => ({ ...s, days: [...s.days] }))
          : [{ days: ['sun'], start: '03:00', durationMinutes: 120 }],
      );
      if (v?.timezone) this.timezone.set(v.timezone);
    });
  }

  protected dayLabel(d: Weekday): string {
    return d.charAt(0).toUpperCase() + d.slice(1);
  }

  protected toggle(i: number, d: Weekday): void {
    this.slots.update((all) =>
      all.map((s, n) =>
        n !== i
          ? s
          : { ...s, days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d] },
      ),
    );
  }

  protected patch(i: number, change: Partial<MaintenanceSlot>): void {
    this.slots.update((all) => all.map((s, n) => (n === i ? { ...s, ...change } : s)));
  }

  protected add(): void {
    this.slots.update((all) => [...all, { days: ['sun'], start: '03:00', durationMinutes: 120 }]);
  }

  protected remove(i: number): void {
    this.slots.update((all) => all.filter((_, n) => n !== i));
  }

  protected emit(): void {
    this.saved.emit({ timezone: this.timezone(), slots: this.slots() });
  }
}
