import { Component, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideEye, lucideEyeOff, lucideX } from '@ng-icons/lucide';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlTag } from '../../../ui/primitives/tag';

let nextId = 0;

@Component({
  selector: 'app-variable-value-dialog',
  imports: [FormsModule, FlField, FlButton, FlIcon, FlTag],
  providers: [provideIcons({ lucideEye, lucideEyeOff, lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="closed.emit()"
    >
      <div
        class="fl-dialog fl-dialog--wide"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        (click)="$event.stopPropagation()"
        (keydown.escape)="closed.emit()"
      >
        <header class="fl-dialog__header">
          <div class="flex min-w-0 items-center gap-2">
            <h2 class="fl-dialog__title fl-mono truncate" [id]="titleId">{{ name() }}</h2>
            @if (typeLabel()) {
              <fl-tag>{{ typeLabel() }}</fl-tag>
            }
          </div>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="closed.emit()">
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          <fl-field
            label="Value"
            [for]="fieldId"
            [hint]="
              sensitive()
                ? 'Stored as a secret. It can never be read back.'
                : 'Paste multi-line JSON, YAML or long strings as they are.'
            "
          >
            <textarea
              class="fl-textarea fl-mono caret-fl-ink"
              [id]="fieldId"
              [rows]="sensitive() ? 12 : 16"
              spellcheck="false"
              [placeholder]="sensitive() ? 'New secret value' : 'Value'"
              [class.text-transparent]="sensitive() && !reveal()"
              [(ngModel)]="draft"
            ></textarea>
          </fl-field>
          @if (sensitive()) {
            <div>
              <button
                flButton="ghost"
                size="sm"
                type="button"
                [disabled]="revealLocked()"
                [attr.title]="revealLocked() ? 'Turn off mask mode to reveal' : null"
                (click)="toggleReveal.emit()"
              >
                <fl-icon [name]="reveal() ? 'lucideEyeOff' : 'lucideEye'" />
                {{ reveal() ? 'Hide value' : 'Show value' }}
              </button>
            </div>
          }
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="closed.emit()">Cancel</button>
          <button
            flButton="primary"
            type="button"
            [disabled]="sensitive() && !draft().trim()"
            (click)="applied.emit(draft())"
          >
            Apply
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class VariableValueDialog {
  readonly name = input.required<string>();
  readonly value = input('');
  readonly sensitive = input(false);
  readonly typeLabel = input('');
  readonly reveal = input(false);
  readonly revealLocked = input(false);

  readonly applied = output<string>();
  readonly closed = output<void>();
  readonly toggleReveal = output<void>();

  protected readonly draft = linkedSignal(() => this.value());
  private readonly uid = nextId++;
  protected readonly titleId = `variable-value-title-${this.uid}`;
  protected readonly fieldId = `variable-value-${this.uid}`;
}
