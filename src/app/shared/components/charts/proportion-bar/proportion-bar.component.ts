import { Component, input, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  ProportionBarConfig,
  ProportionBarData,
  DEFAULT_BAR_CONFIG,
  DISTRIBUTION_PALETTE,
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
  imports: [DecimalPipe],
  template: `
    <div class="proportion-bar-container">
      @if (data().title) {
        <div class="mb-1 flex items-baseline justify-between">
          <h3 class="m-0 text-fl-body-sm font-semibold text-fl-ink">{{ data().title }}</h3>
          <span class="fl-num text-fl-caption text-fl-ink-muted">
            {{ totalFormatted() }}
          </span>
        </div>
      }
      @if (data().subtitle) {
        <p class="mb-2 text-fl-caption text-fl-ink-muted">{{ data().subtitle }}</p>
      }

      <div
        role="img"
        [attr.aria-label]="ariaLabel()"
        class="flex overflow-hidden rounded-fl-md border border-fl-border bg-fl-track"
        [style.height.px]="mergedConfig().barHeight"
      >
        @for (seg of segments(); track seg.name) {
          <div
            class="bar-segment group relative hover:opacity-80"
            [style.width.%]="seg.percent"
            [style.background-color]="seg.color"
          >
            @if (mergedConfig().showPercentLabels && seg.percent >= 8) {
              <span
                class="fl-num absolute inset-0 flex items-center justify-center text-fl-caption font-medium text-fl-on-accent"
              >
                {{ seg.percent | number: '1.0-1' }}%
              </span>
            }

            <div
              class="bar-tooltip absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-fl-md border border-fl-border bg-fl-surface px-3 py-1.5 text-fl-caption text-fl-ink group-hover:block"
            >
              <strong>{{ seg.name }}</strong><br />
              <span class="fl-num"
                >{{ seg.valueFormatted }} ({{ seg.percent | number: '1.1-1' }}%)</span
              >
            </div>
          </div>
        }
      </div>

      @if (mergedConfig().showLegend) {
        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          @for (seg of segments(); track seg.name) {
            <div class="flex items-center gap-1.5 text-fl-caption text-fl-ink-muted">
              <span
                class="inline-block h-2.5 w-2.5 shrink-0 rounded-fl-sm"
                [style.background-color]="seg.color"
              ></span>
              <span>{{ seg.name }}</span>
              <span class="fl-num font-medium text-fl-ink">{{ seg.valueFormatted }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .proportion-bar-container {
        width: 100%;
      }
      .bar-segment {
        min-width: 2px;
      }
      .bar-tooltip {
        pointer-events: none;
      }
    `,
  ],
})
export class ProportionBarComponent {
  data = input.required<ProportionBarData>();
  config = input<ProportionBarConfig>({});

  mergedConfig = computed(() => ({
    ...DEFAULT_BAR_CONFIG,
    ...this.config(),
  }));

  private readonly total = computed(() => this.data().slices.reduce((sum, s) => sum + s.value, 0));

  totalFormatted = computed(() => {
    const total = this.total();
    const cfg = this.mergedConfig();
    const formatter = this.config().valueFormatter;
    if (formatter) return formatter(total, 100);
    return `${total.toLocaleString()}${cfg.unit ? ' ' + cfg.unit : ''}`;
  });

  protected readonly ariaLabel = computed(() => {
    const parts = this.segments().map((seg) => `${seg.name} ${seg.valueFormatted}`);
    const title = this.data().title;
    const list = parts.join(', ');
    return title ? `${title}: ${list}` : list;
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
        valueFormatted,
      };
    });
  });
}
