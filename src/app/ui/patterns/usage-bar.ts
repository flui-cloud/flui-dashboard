import { Component, computed, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';
import { FlIcon } from '../primitives/icon';

@Component({
  selector: 'fl-usage-bar',
  imports: [FlIcon],
  providers: [provideIcons({ lucideTriangleAlert })],
  host: {
    class: 'fl-usage',
    '[class.fl-usage--warning]': 'level() === "warning"',
    '[class.fl-usage--critical]': 'level() === "critical"',
  },
  template: `
    <div class="fl-usage__top">
      <span class="fl-usage__value">
        @if (level() !== 'normal') {
          <fl-icon name="lucideTriangleAlert" [size]="13" />
        }
        {{ display() }}
      </span>
      @if (aside()) {
        <span class="fl-usage__aside">{{ aside() }}</span>
      }
    </div>
    <span
      class="fl-bar"
      role="meter"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="clamped()"
      [attr.aria-label]="label()"
      ><span [style.width.%]="clamped()"></span
    ></span>
  `,
})
export class FlUsageBar {
  readonly percent = input.required<number>();
  readonly label = input.required<string>();
  readonly aside = input<string>();
  readonly warnAt = input(80);
  readonly criticalAt = input(90);
  protected readonly clamped = computed(() => Math.min(100, Math.max(0, this.percent())));
  protected readonly display = computed(() => `${this.percent().toFixed(1)}%`);
  protected readonly level = computed(() => {
    const p = this.percent();
    if (p >= this.criticalAt()) return 'critical';
    if (p >= this.warnAt()) return 'warning';
    return 'normal';
  });
}
