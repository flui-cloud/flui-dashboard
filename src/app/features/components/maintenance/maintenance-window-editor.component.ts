import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaintenanceSlot, MaintenanceWindow, WEEKDAYS, Weekday } from '../../service/maintenance.service';

/** Weekly slots in one time zone; emits the window as written. */
@Component({
  selector: 'app-maintenance-window-editor',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3" data-testid="window-editor">
      @for (slot of slots(); track $index; let i = $index) {
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <div class="inline-flex gap-0.5 rounded-md border border-border p-0.5">
            @for (d of days; track d) {
              <button type="button" class="rounded px-1.5 py-0.5 text-[12px]"
                [class]="slot.days.includes(d) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
                (click)="toggle(i, d)" [attr.data-testid]="'slot-' + i + '-' + d">{{ d }}</button>
            }
          </div>
          <label class="inline-flex items-center gap-1 text-muted-foreground">from
            <input type="time" class="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs text-foreground" [ngModel]="slot.start" (ngModelChange)="patch(i, { start: $event })" />
          </label>
          <label class="inline-flex items-center gap-1 text-muted-foreground">for
            <input type="number" min="15" max="1440" step="15" class="h-8 w-20 rounded-md border border-border bg-background px-2 text-xs text-foreground"
              [ngModel]="slot.durationMinutes" (ngModelChange)="patch(i, { durationMinutes: +$event })" /> min
          </label>
          @if (slots().length > 1) {
            <button type="button" class="text-[12px] text-muted-foreground hover:text-destructive" (click)="remove(i)">Remove</button>
          }
        </div>
      }
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" class="text-[12px] text-primary hover:underline" (click)="add()">Add a slot</button>
        <label class="inline-flex items-center gap-1 text-muted-foreground">Time zone
          <input class="h-8 w-44 rounded-md border border-border bg-background px-2 text-xs text-foreground" [ngModel]="timezone()" (ngModelChange)="timezone.set($event)" data-testid="window-timezone" />
        </label>
      </div>
      <div class="flex gap-2">
        <button type="button" class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50" [disabled]="saving()" (click)="emit()" data-testid="window-save">
          {{ saving() ? 'Saving…' : 'Save window' }}
        </button>
        <button type="button" class="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" (click)="cancelled.emit()">Cancel</button>
      </div>
    </div>
  `,
})
export class MaintenanceWindowEditorComponent {
  readonly value = input<MaintenanceWindow | null>(null);
  readonly saving = input(false);
  readonly saved = output<MaintenanceWindow>();
  readonly cancelled = output<void>();

  protected readonly days = WEEKDAYS;
  protected readonly slots = signal<MaintenanceSlot[]>([]);
  protected readonly timezone = signal(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  constructor() {
    effect(() => {
      const v = this.value();
      this.slots.set(v?.slots.length ? v.slots.map((s) => ({ ...s, days: [...s.days] })) : [{ days: ['sun'], start: '03:00', durationMinutes: 120 }]);
      if (v?.timezone) this.timezone.set(v.timezone);
    });
  }

  protected toggle(i: number, d: Weekday): void {
    this.slots.update((all) =>
      all.map((s, n) => (n !== i ? s : { ...s, days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d] })),
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
