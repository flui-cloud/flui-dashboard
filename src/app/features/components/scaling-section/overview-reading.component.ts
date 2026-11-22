import { Component, input } from '@angular/core';
import { FlStatus } from '../../../ui/primitives/status';
import { Reading } from './overview-format';

@Component({
  selector: 'app-overview-reading',
  imports: [FlStatus],
  host: { class: 'inline-flex flex-col items-end gap-0.5' },
  template: `
    @if (reading().attention) {
      <fl-status tone="warning" class="fl-mono" [label]="reading().value" />
    } @else {
      <span class="fl-mono fl-num">{{ reading().value }}</span>
    }
    @if (reading().sub; as sub) {
      <span class="text-fl-caption text-fl-ink-muted">{{ sub }}</span>
    }
  `,
})
export class OverviewReadingComponent {
  readonly reading = input.required<Reading>();
}
