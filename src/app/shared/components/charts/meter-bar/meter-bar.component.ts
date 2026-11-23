import { Component, input, computed } from '@angular/core';
import { MeterBarConfig } from '../chart.models';
import { cssColor } from '../chart-colors';

@Component({
  selector: 'app-meter-bar',
  template: `
    <div class="flex flex-col gap-1 w-full">
      @if (label() || caption()) {
        <div class="flex items-baseline justify-between gap-2">
          <span class="font-mono text-fl-caption text-fl-ink">{{ label() }}</span>
          @if (caption()) {
            <span class="text-fl-caption text-fl-ink-muted">{{ caption() }}</span>
          }
        </div>
      }
      <div
        class="relative w-full rounded-full bg-fl-track"
        [style.height.px]="height()"
        role="meter"
        [attr.aria-valuenow]="clamped()"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-label]="ariaLabel()"
      >
        <div
          class="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          [style.width.%]="clamped()"
          [style.background-color]="color()"
        ></div>
        @if (warning(); as w) {
          <span
            class="absolute -top-0.5 -bottom-0.5 w-px bg-fl-warning"
            [style.left.%]="w"
            [attr.title]="'Warning threshold ' + w + '%'"
          ></span>
        }
        @if (danger(); as d) {
          <span
            class="absolute -top-0.5 -bottom-0.5 w-px bg-fl-danger"
            [style.left.%]="d"
            [attr.title]="'Critical threshold ' + d + '%'"
          ></span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class MeterBarComponent {
  readonly value = input.required<number>();
  readonly config = input<MeterBarConfig>({});
  readonly color = input<string>(cssColor('--fl-accent'));
  /** Value shown above the track; omit to draw the track alone. */
  readonly label = input<string>('');
  /** Secondary text on the right of the label row, e.g. "5.8 GB / 12 GB". */
  readonly caption = input<string>('');

  readonly clamped = computed(() => Math.min(100, Math.max(0, this.value())));
  readonly height = computed(() => this.config().height ?? 8);
  readonly warning = computed(() => this.config().warning ?? null);
  readonly danger = computed(() => this.config().danger ?? null);

  readonly ariaLabel = computed(() => `${this.clamped().toFixed(1)} percent`);
}
