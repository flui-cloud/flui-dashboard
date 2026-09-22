import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { SparkLineComponent } from '../spark-line/spark-line.component';
import { StatTileData } from '../chart.models';

/**
 * Stat Tile Component
 * One headline figure — label, value, change over the window, trend mark.
 * Five of these across the top of a page give the pulse of a cluster without
 * a single chart being read.
 *
 * @example
 * ```html
 * <app-stat-tile [data]="{ label: 'CPU media', value: '15.0', unit: '%', spark: cpuTrend() }" />
 * ```
 */
@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [SparkLineComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="card-surface p-4 flex flex-col gap-2 h-full">
      <div class="text-[10px] font-semibold uppercase tracking-wider text-sub">
        {{ data().label }}
      </div>

      <div class="flex items-baseline gap-1.5">
        <span class="text-2xl font-semibold text-foreground tracking-tight">{{ data().value }}</span>
        @if (data().unit) {
          <span class="text-xs text-sub">{{ data().unit }}</span>
        }
        @if (data().delta) {
          <span
            class="ml-auto text-[11px] font-semibold"
            [class]="deltaClass()"
            [attr.title]="data().deltaHint"
            [attr.aria-label]="data().delta + ' ' + (data().deltaHint ?? '')"
          >
            {{ data().delta }}
          </span>
        }
      </div>

      <div class="flex items-end justify-between gap-2 mt-auto">
        @if (spark().length > 1) {
          <app-spark-line
            [values]="spark()"
            [color]="color()"
            [width]="sparkWidth()"
            [height]="30"
            [ariaLabel]="data().label + ': trend over the selected window'"
          />
        } @else {
          <span class="text-[10px] text-sub">no history yet</span>
        }
        @if (data().footnote) {
          <span class="text-[10px] text-sub whitespace-nowrap">{{ data().footnote }}</span>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class StatTileComponent {
  readonly data = input.required<StatTileData>();
  readonly sparkWidth = input<number>(120);

  readonly spark = computed(() => this.data().spark ?? []);
  readonly color = computed(() => this.data().color ?? '#2259F1');

  readonly deltaClass = computed(() => {
    switch (this.data().deltaTone) {
      case 'up':
        return 'text-amber-600 dark:text-amber-400';
      case 'down':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-muted-foreground';
    }
  });
}
