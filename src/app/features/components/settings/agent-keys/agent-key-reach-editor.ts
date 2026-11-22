import { Component, input, output } from '@angular/core';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlButton } from '../../../../ui/primitives/button';
import { AgentKeyApplicationPickerComponent } from './agent-key-application-picker.component';
import { AgentKeyProjectPickerComponent } from './agent-key-project-picker.component';

@Component({
  selector: 'app-agent-key-reach-editor',
  imports: [FlAlert, FlButton, AgentKeyApplicationPickerComponent, AgentKeyProjectPickerComponent],
  host: { class: 'flex flex-col gap-3' },
  template: `
    @if (field() === 'applications') {
      <app-agent-key-application-picker
        [selected]="selected()"
        (selectionChange)="picked.emit($event)"
      />
    } @else {
      <app-agent-key-project-picker
        [selected]="selected()"
        (selectionChange)="picked.emit($event)"
      />
    }
    @if (error(); as e) {
      <fl-alert tone="error" title="Not saved">
        <span [attr.data-testid]="'edit-' + field() + '-error-' + keyId()">{{ e }}</span>
      </fl-alert>
    }
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="m-0 text-fl-caption text-fl-ink-muted">
        @if (field() === 'applications') {
          Empty means every application: the key is not limited.
        } @else {
          Empty means no project grant: an app is still reached individually, if named above.
        }
      </p>
      <div class="flex gap-2">
        <button flButton="ghost" size="sm" type="button" (click)="cancelled.emit()">Cancel</button>
        <button
          flButton="primary"
          size="sm"
          type="button"
          [attr.data-testid]="'save-' + field() + '-' + keyId()"
          [disabled]="saving()"
          (click)="save.emit()"
        >
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>
  `,
})
export class AgentKeyReachEditor {
  readonly field = input.required<'applications' | 'projects'>();
  readonly keyId = input.required<string>();
  readonly selected = input<string[] | undefined>(undefined);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly picked = output<string[]>();
  readonly save = output<void>();
  readonly cancelled = output<void>();
}
