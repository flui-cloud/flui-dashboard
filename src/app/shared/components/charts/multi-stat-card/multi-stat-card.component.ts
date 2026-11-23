import { Component, input, computed } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleX, lucideTriangleAlert } from '@ng-icons/lucide';

import {
  MultiStatCardConfig,
  MultiStatCardData,
  DEFAULT_MULTISTAT_CONFIG,
  StatItem,
} from '../chart.models';

/**
 * Multi-Stat Card Component
 * Displays multiple related statistics in a compact card format
 *
 * @example
 * ```html
 * <app-multi-stat-card
 *   [data]="{
 *     title: 'System Load',
 *     subtitle: 'Average load over time',
 *     stats: [
 *       { label: '1 min', value: 1.23, trend: 'up', trendValue: '+0.05' },
 *       { label: '5 min', value: 1.45, trend: 'stable' },
 *       { label: '15 min', value: 1.38, trend: 'down', trendValue: '-0.10' }
 *     ]
 *   }"
 *   [config]="{layout: 'horizontal'}"
 * />
 * ```
 */
@Component({
  selector: 'app-multi-stat-card',
  imports: [NgIcon],
  providers: [provideIcons({ lucideCircleX, lucideTriangleAlert })],
  template: `
    <div class="multi-stat-card rounded-fl-lg border border-fl-border bg-fl-surface p-4">
      <div class="mb-4 flex flex-col gap-1">
        <h3 class="m-0 text-fl-section-title text-fl-ink">{{ data().title }}</h3>
        @if (data().subtitle) {
          <p class="m-0 text-fl-caption text-fl-ink-muted">{{ data().subtitle }}</p>
        }
      </div>

      <div [class]="statsGridClass()">
        @for (stat of data().stats; track stat.label) {
          <div class="stat-item" [class]="statItemClass()">
            <div class="fl-metric__label mb-1">
              {{ stat.label }}
            </div>

            <div class="flex items-baseline gap-2">
              @if (statusDot(stat); as dot) {
                <span [class]="dot" class="self-center" data-testid="multi-stat-dot">
                  <ng-icon [name]="statusIcon(stat)" size="14px" />
                </span>
              }
              <span class="fl-metric__value">
                {{ formatValue(stat.value) }}{{ stat.unit || '' }}
              </span>

              @if (config().showTrend && stat.trend) {
                <span class="fl-num text-fl-caption" [class]="getTrendClass(stat.trend)">
                  {{ getTrendIcon(stat.trend) }}
                  @if (stat.trendValue) {
                    <span>{{ stat.trendValue }}</span>
                  }
                </span>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .multi-stat-card {
        min-height: fit-content;
      }

      .stat-item {
        display: flex;
        flex-direction: column;
      }

      .stats-horizontal {
        display: flex;
        gap: 1.5rem;
        flex-wrap: wrap;
      }

      .stats-vertical {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 1.5rem;
      }

      .stat-horizontal {
        flex: 1;
        min-width: 100px;
      }

      .stat-vertical,
      .stat-grid {
        width: 100%;
      }
    `,
  ],
})
export class MultiStatCardComponent {
  data = input.required<MultiStatCardData>();
  config = input<MultiStatCardConfig>({});

  private readonly mergedConfig = computed(() => ({
    ...DEFAULT_MULTISTAT_CONFIG,
    ...this.config(),
  }));

  statsGridClass = computed(() => {
    const layout = this.mergedConfig().layout;
    switch (layout) {
      case 'horizontal':
        return 'stats-horizontal';
      case 'vertical':
        return 'stats-vertical';
      case 'grid':
        return 'stats-grid';
      default:
        return 'stats-horizontal';
    }
  });

  statItemClass = computed(() => {
    const layout = this.mergedConfig().layout;
    switch (layout) {
      case 'horizontal':
        return 'stat-horizontal';
      case 'vertical':
        return 'stat-vertical';
      case 'grid':
        return 'stat-grid';
      default:
        return 'stat-horizontal';
    }
  });

  formatValue(value: number | string): string {
    if (typeof value === 'string') {
      return value;
    }
    return value.toFixed(2);
  }

  statusDot(stat: StatItem): string | null {
    if (stat.severity === 'danger') return 'fl-status fl-status--error';
    if (stat.severity === 'warning') return 'fl-status fl-status--warning';
    return null;
  }

  statusIcon(stat: StatItem): string {
    return stat.severity === 'danger' ? 'lucideCircleX' : 'lucideTriangleAlert';
  }

  getTrendClass(_trend: 'up' | 'down' | 'stable'): string {
    return 'text-fl-ink-muted';
  }

  getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
        return '→';
      default:
        return '';
    }
  }
}
