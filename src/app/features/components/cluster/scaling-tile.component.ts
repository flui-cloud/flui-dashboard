import { Component, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-scaling-tile',
  imports: [FlIcon],
  providers: [provideIcons({ lucideTriangleAlert })],
  host: {
    class: 'fl-metric',
    role: 'listitem',
    '[class.fl-metric--warning]': 'attention()',
    '[attr.data-testid]': "'tile-' + testid()",
  },
  template: `
    <span class="fl-metric__label">{{ label() }}</span>
    <span class="fl-metric__value">
      @if (attention()) {
        <fl-icon name="lucideTriangleAlert" />
      }
      <span [attr.data-testid]="'tile-value-' + testid()">{{ value() }}</span>
      @if (unit()) {
        <span class="text-fl-body-sm font-normal text-fl-ink-muted">{{ unit() }}</span>
      }
    </span>
    @if (note()) {
      <span class="fl-metric__caption">{{ note() }}</span>
    }
  `,
})
export class ScalingTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly unit = input<string>('');
  readonly note = input<string>('');
  readonly attention = input<boolean>(false);
  readonly testid = input<string>('');
}
