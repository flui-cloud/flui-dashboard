import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** A small segmented control: one of a few values, labelled. */
@Component({
  selector: 'app-topology-choice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2 text-xs" role="radiogroup" [attr.aria-label]="label()">
      <span class="text-muted-foreground">{{ label() }}</span>
      <div class="flex gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
        @for (choice of choices(); track choice.value) {
          <button type="button" role="radio"
                  class="rounded-md px-2.5 py-1 font-medium transition-colors"
                  [class.bg-card]="choice.value === value()"
                  [class.text-foreground]="choice.value === value()"
                  [class.shadow-sm]="choice.value === value()"
                  [class.text-muted-foreground]="choice.value !== value()"
                  [attr.aria-checked]="choice.value === value()"
                  (click)="changed.emit(choice.value)">{{ choice.label }}</button>
        }
      </div>
    </div>
  `,
})
export class TopologyChoiceComponent {
  readonly label = input.required<string>();
  readonly choices = input.required<{ value: string; label: string }[]>();
  readonly value = input.required<string>();
  readonly changed = output<string>();
}
