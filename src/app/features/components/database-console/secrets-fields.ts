import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCopy,
  lucideEye,
  lucideEyeOff,
  lucidePlus,
  lucideX,
} from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { SecretsConsoleStateService } from './secrets-console-state.service';

@Component({
  selector: 'app-secrets-fields',
  imports: [FormsModule, FlButton, FlIcon],
  providers: [
    provideIcons({ lucideCheck, lucideCopy, lucideEye, lucideEyeOff, lucidePlus, lucideX }),
  ],
  host: { class: 'flex flex-col gap-2' },
  template: `
    @for (row of s.rows(); track $index) {
      <div class="flex items-center gap-2">
        <div class="fl-input fl-input--lg w-1/3 shrink-0 font-mono">
          <input
            type="text"
            placeholder="key"
            [attr.aria-label]="'Key ' + ($index + 1)"
            [disabled]="s.readOnly()"
            [(ngModel)]="row.key"
          />
        </div>
        <div class="fl-input fl-input--lg min-w-0 flex-1 font-mono">
          <input
            placeholder="value"
            autocomplete="off"
            [type]="s.isRevealed($index) ? 'text' : 'password'"
            [attr.aria-label]="'Value of ' + (row.key || 'key ' + ($index + 1))"
            [disabled]="s.readOnly()"
            [(ngModel)]="row.value"
          />
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [iconOnly]="true"
            [disabled]="s.maskModeOn()"
            [attr.aria-label]="s.isRevealed($index) ? 'Hide value' : 'Reveal value'"
            [title]="
              s.maskModeOn()
                ? 'Turn off mask mode to reveal'
                : s.isRevealed($index)
                  ? 'Hide'
                  : 'Reveal'
            "
            (click)="s.toggleReveal($index)"
          >
            <fl-icon [name]="s.isRevealed($index) ? 'lucideEyeOff' : 'lucideEye'" [size]="14" />
          </button>
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [iconOnly]="true"
            [attr.aria-label]="s.copied() === 'row' + $index ? 'Copied' : 'Copy value'"
            title="Copy value"
            (click)="s.copy(row.value, 'row' + $index)"
          >
            <fl-icon
              [name]="s.copied() === 'row' + $index ? 'lucideCheck' : 'lucideCopy'"
              [size]="14"
            />
          </button>
        </div>
        <button
          flButton="ghost"
          size="sm"
          type="button"
          [iconOnly]="true"
          [disabled]="s.readOnly()"
          [attr.aria-label]="'Remove ' + (row.key || 'field')"
          (click)="s.removeRow($index)"
        >
          <fl-icon name="lucideX" [size]="14" />
        </button>
      </div>
    }
    <div>
      <button
        flButton="ghost"
        size="sm"
        type="button"
        [disabled]="s.readOnly()"
        (click)="s.addRow()"
      >
        <fl-icon name="lucidePlus" [size]="14" />
        Add field
      </button>
    </div>
  `,
})
export class SecretsFields {
  protected readonly s = inject(SecretsConsoleStateService);
}
