import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';

export interface ProtectDestination {
  id: string;
  name: string;
}

@Component({
  selector: 'app-backup-protect-form',
  imports: [FormsModule, FlField, FlButton],
  host: { class: 'flex flex-col gap-3' },
  template: `
    <div class="flex flex-wrap items-end gap-4">
      <fl-field label="Backup storage" for="protect-destination">
        <span class="fl-select-wrap">
          <select
            id="protect-destination"
            class="fl-select fl-select--sm"
            [ngModel]="destinationId()"
            (ngModelChange)="destinationId.set($event)"
          >
            @for (d of destinations(); track d.id) {
              <option [value]="d.id">{{ d.name }}</option>
            }
          </select>
        </span>
      </fl-field>
      @if (!database()) {
        <label class="fl-check">
          <input type="checkbox" [ngModel]="pause()" (ngModelChange)="pause.set($event)" />
          Stop the app during each copy
        </label>
        <label
          class="fl-check"
          title="Two more months of history on top of 7 daily and 4 weekly snapshots"
        >
          <input
            type="checkbox"
            [ngModel]="keepMonthly()"
            (ngModelChange)="keepMonthly.set($event)"
          />
          Keep 3 monthly snapshots (+~30% space)
        </label>
      } @else if (postgres() && advanced()) {
        <fl-field
          label="Max minutes between log closes"
          for="protect-archive-minutes"
          hint="Lower loses less data if the volume is lost; higher uses less storage."
        >
          <div class="fl-input w-24">
            <input
              id="protect-archive-minutes"
              type="number"
              min="1"
              max="60"
              [ngModel]="archiveMinutes()"
              (ngModelChange)="archiveMinutes.set($event)"
            />
          </div>
        </fl-field>
      } @else if (postgres()) {
        <button flButton="ghost" size="sm" type="button" (click)="advanced.set(true)">
          Advanced
        </button>
      }
    </div>
    @if (!destinations().length) {
      <p class="text-fl-body-sm text-fl-ink-muted">
        No backup storage yet: add one under Management, Backup, Destinations.
      </p>
    }
    <div class="fl-row">
      <button
        flButton="primary"
        size="sm"
        type="button"
        [disabled]="!destinationId() || working()"
        (click)="submitted.emit()"
      >
        {{ working() ? 'Setting up…' : database() ? 'Start backups' : 'Copy every night' }}
      </button>
      <button flButton="ghost" size="sm" type="button" (click)="cancelled.emit()">Cancel</button>
    </div>
  `,
})
export class BackupProtectForm {
  readonly destinations = input.required<readonly ProtectDestination[]>();
  readonly database = input(false);
  readonly postgres = input(false);
  readonly working = input(false);
  readonly destinationId = model('');
  readonly pause = model(false);
  readonly keepMonthly = model(false);
  readonly advanced = model(false);
  readonly archiveMinutes = model(5);
  readonly submitted = output<void>();
  readonly cancelled = output<void>();
}
