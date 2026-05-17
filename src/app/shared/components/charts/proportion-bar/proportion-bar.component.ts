import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ProportionBarConfig,
  ProportionBarData,
  DEFAULT_BAR_CONFIG,
  DISTRIBUTION_PALETTE
} from '../chart.models';

/**
 * Proportion Bar Component
 * Horizontal stacked bar for compact distribution visualization
 * Pure CSS - no ECharts dependency, lightweight and fast
 *
 * @example
 * ```html
 * <app-proportion-bar
 *   [data]="{
 *     title: 'Storage Distribution',
 *     slices: [
 *       { name: 'App A', value: 50 },
 *       { name: 'App B', value: 30 },
 *       { name: 'App C', value: 20 }
 *     ]
 *   }"
 *   [config]="{ unit: 'GB', barHeight: 28 }"
 * />
 * ```
 */
@Component({
  selector: 'app-proportion-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="proportion-bar-container">
      @if (data().title) {
        <div class="flex items-baseline justify-between mb-1">
          <h3 class="text-sm font-medium text-foreground">{{ data().title }}</h3>
          <span class="text-xs text-muted-foreground">
            {{ totalFormatted() }}
          </span>
        </div>
      }
      @if (data().subtitle) {
        <p class="text-xs text-muted-foreground mb-2">{{ data().subtitle }}</p>
      }

      <!-- Stacked bar -->
      <div class="bar-track rounded-lg overflow-hidden flex"
           [style.height.px]="mergedConfig().barHeight"
           [class.border]="true"
           [class.border-border]="true">
        @for (seg of segments(); track seg.name) {
          <div class="bar-segment relative group transition-opacity duration-150"
               [style.width.%]="seg.percent"
               [style.background-color]="seg.color"
               [class.hover:opacity-80]="true">
            <!-- Percent label inside segment (if wide enough) -->
            @if (mergedConfig().showPercentLabels && seg.percent >= 8) {
              <span class="absolute inset-0 flex items-center justify-center text-xs font-medium text-white drop-shadow-sm">
                {{ seg.percent | number:'1.0-1' }}%
              </span>
            }

            <!-- Tooltip -->
            <div class="bar-tooltip hidden group-hover:block absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2
                        px-3 py-1.5 rounded-md shadow-lg text-xs whitespace-nowrap
                        bg-popover text-popover-foreground border border-border">
              <strong>{{ seg.name }}</strong><br/>
              {{ seg.valueFormatted }} ({{ seg.percent | number:'1.1-1' }}%)
            </div>
          </div>
        }
      </div>

      <!-- Legend -->
      @if (mergedConfig().showLegend) {
        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          @for (seg of segments(); track seg.name) {
            <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span class="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    [style.background-color]="seg.color"></span>
              <span>{{ seg.name }}</span>
              <span class="font-medium text-foreground">{{ seg.valueFormatted }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .proportion-bar-container {
      width: 100%;
    }
    .bar-segment {
      min-width: 2px;
    }
    .bar-tooltip {
      pointer-events: none;
    }
  `]
})
export class ProportionBarComponent {
  data = input.required<ProportionBarData>();
  config = input<ProportionBarConfig>({});

  mergedConfig = computed(() => ({
    ...DEFAULT_BAR_CONFIG,
    ...this.config()
  }));

  private readonly total = computed(() =>
    this.data().slices.reduce((sum, s) => sum + s.value, 0)
  );

  totalFormatted = computed(() => {
    const total = this.total();
    const cfg = this.mergedConfig();
    const formatter = this.config().valueFormatter;
    if (formatter) return formatter(total, 100);
    return `${total.toLocaleString()}${cfg.unit ? ' ' + cfg.unit : ''}`;
  });

  segments = computed(() => {
    const total = this.total();
    const cfg = this.mergedConfig();
    const formatter = this.config().valueFormatter;

    const unitSuffix = cfg.unit ? ' ' + cfg.unit : '';
    return this.data().slices.map((s, i) => {
      const percent = total > 0 ? (s.value / total) * 100 : 0;
      const valueFormatted = formatter
        ? formatter(s.value, percent)
        : `${s.value.toLocaleString()}${unitSuffix}`;
      return {
        name: s.name,
        value: s.value,
        percent,
        color: s.color || DISTRIBUTION_PALETTE[i % DISTRIBUTION_PALETTE.length],
        valueFormatted
      };
    });
  });
}
