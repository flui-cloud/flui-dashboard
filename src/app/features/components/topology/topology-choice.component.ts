import { Component, input, output } from '@angular/core';
import { FlSegmented } from '../../../ui/patterns/filter-bar';

/** A small segmented control: one of a few values, labelled. */
@Component({
  selector: 'app-topology-choice',
  imports: [FlSegmented],
  host: { class: 'inline-flex items-center gap-2' },
  template: `
    <span class="text-fl-body-sm text-fl-ink-muted">{{ label() }}</span>
    <fl-segmented
      [label]="label()"
      [options]="choices()"
      [value]="value()"
      (valueChange)="changed.emit($event)"
    />
  `,
})
export class TopologyChoiceComponent {
  readonly label = input.required<string>();
  readonly choices = input.required<{ value: string; label: string }[]>();
  readonly value = input.required<string>();
  readonly changed = output<string>();
}
