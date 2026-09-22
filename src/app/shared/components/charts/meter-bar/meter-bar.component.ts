import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MeterBarConfig } from '../chart.models';

/**
 * Meter Bar Component
 * A horizontal usage track with optional warning/danger tick marks — the
 * compact replacement for a full gauge when the same number has to be read
 * once per node, per row.
 *
 * @example
 * ```html
 * <app-meter-bar [value]="48.2" [config]="{ warning: 75, danger: 90 }" color="#0D9488" />
 * ```
 */
@Component({
  selector: 'app-meter-bar',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-1 w-full">
      @if (label() || caption()) {
        <div class="flex items-baseline justify-between gap-2">
          <span class="font-mono text-xs text-foreground">{{ label() }}</span>
          @if (caption()) {
            <span class="text-[10px] text-sub">{{ caption() }}</span>
          }
        </div>
      }
      <div
        class="relative w-full rounded-full bg-muted"
        [style.height.px]="height()"
        role="meter"
        [attr.aria-valuenow]="clamped()"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-label]="ariaLabel()"
      >
        <div
          class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
          [style.width.%]="clamped()"
          [style.background-color]="color()"
        ></div>
        @if (warning(); as w) {
          <span
            class="absolute -top-0.5 -bottom-0.5 w-px bg-amber-600/70 dark:bg-amber-400/70"
            [style.left.%]="w"
            [attr.title]="'Warning threshold ' + w + '%'"
          ></span>
        }
        @if (danger(); as d) {
          <span
            class="absolute -top-0.5 -bottom-0.5 w-px bg-red-600/70 dark:bg-red-400/70"
            [style.left.%]="d"
            [attr.title]="'Critical threshold ' + d + '%'"
          ></span>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class MeterBarComponent {
  readonly value = input.required<number>();
  readonly config = input<MeterBarConfig>({});
  readonly color = input<string>('#2259F1');
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
