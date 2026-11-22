import { Component, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideTriangleAlert } from '@ng-icons/lucide';
import { FlIcon } from '../primitives/icon';

export type MetricTone = 'default' | 'warning' | 'success';

@Component({
  selector: 'fl-metric-strip',
  host: { class: 'fl-metrics', role: 'list' },
  template: `<ng-content />`,
})
export class FlMetricStrip {}

@Component({
  selector: 'fl-metric, a[fl-metric]',
  imports: [FlIcon],
  providers: [provideIcons({ lucideTriangleAlert, lucideCircleCheck })],
  host: {
    class: 'fl-metric',
    role: 'listitem',
    '[class.fl-metric--warning]': 'tone() === "warning"',
    '[class.fl-metric--success]': 'tone() === "success"',
  },
  template: `
    <span class="fl-metric__label">{{ label() }}</span>
    <span class="fl-metric__value">
      @if (tone() === 'warning') {
        <fl-icon name="lucideTriangleAlert" />
      } @else if (tone() === 'success') {
        <fl-icon name="lucideCircleCheck" />
      }
      {{ value() }}
    </span>
    @if (caption()) {
      <span class="fl-metric__caption">{{ caption() }}</span>
    }
  `,
})
export class FlMetric {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly caption = input<string>();
  readonly tone = input<MetricTone>('default');
}
