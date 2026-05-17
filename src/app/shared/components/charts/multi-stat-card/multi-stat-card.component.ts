import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MultiStatCardConfig,
  MultiStatCardData,
  DEFAULT_MULTISTAT_CONFIG,
  StatItem
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
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="multi-stat-card bg-card border border-border rounded-lg p-6">
      <!-- Header -->
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-foreground">{{ data().title }}</h3>
        @if (data().subtitle) {
          <p class="text-sm text-muted-foreground mt-1">{{ data().subtitle }}</p>
        }
      </div>

      <!-- Stats Grid -->
      <div [class]="statsGridClass()">
        @for (stat of data().stats; track stat.label) {
          <div class="stat-item" [class]="statItemClass()">
            <!-- Label -->
            <div class="text-xs text-muted-foreground mb-1 font-medium">
              {{ stat.label }}
            </div>

            <!-- Value -->
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-bold" [class]="getValueColor(stat)">
                {{ formatValue(stat.value) }}{{ stat.unit || '' }}
              </span>

              <!-- Trend -->
              @if (config().showTrend && stat.trend) {
                <span class="text-xs" [class]="getTrendClass(stat.trend)">
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
  styles: [`
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
  `]
})
export class MultiStatCardComponent {
  // Inputs
  data = input.required<MultiStatCardData>();
  config = input<MultiStatCardConfig>({});

  // Computed configurations
  private readonly mergedConfig = computed(() => ({
    ...DEFAULT_MULTISTAT_CONFIG,
    ...this.config()
  }));

  // Grid class based on layout
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

  // Stat item class based on layout
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

  // Format value
  formatValue(value: number | string): string {
    if (typeof value === 'string') {
      return value;
    }
    return value.toFixed(2);
  }

  // Get value color based on severity
  getValueColor(stat: StatItem): string {
    if (!stat.severity) {
      return 'text-foreground';
    }

    const severityColors = {
      success: 'text-green-600 dark:text-green-400',
      warning: 'text-orange-600 dark:text-orange-400',
      danger: 'text-red-600 dark:text-red-400',
      info: 'text-blue-600 dark:text-blue-400',
      neutral: 'text-gray-600 dark:text-gray-400'
    };

    return severityColors[stat.severity] || 'text-foreground';
  }

  // Get trend class
  getTrendClass(trend: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up':
        return 'text-red-500';
      case 'down':
        return 'text-green-500';
      case 'stable':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  }

  // Get trend icon
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
