import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Reading } from './overview-format';

@Component({
  selector: 'app-overview-reading',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="whitespace-nowrap tabular-nums"
      [class]="reading().attention ? 'status-degraded font-medium' : 'text-foreground'"
      >{{ reading().value
      }}@if (reading().sub; as sub) {<span class="ml-1.5 text-xs font-normal text-muted-foreground">{{
        sub
      }}</span>}</span
    >
  `,
})
export class OverviewReadingComponent {
  readonly reading = input.required<Reading>();
}
