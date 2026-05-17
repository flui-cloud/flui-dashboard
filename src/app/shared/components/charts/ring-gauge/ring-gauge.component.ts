import { Component, input, computed, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective, provideEcharts } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  GaugeChartConfig,
  GaugeChartData,
  DEFAULT_GAUGE_CONFIG,
  DEFAULT_CHART_COLORS,
  MetricSeverity,
  ChartTheme
} from '../chart.models';

/**
 * Ring Gauge Component
 * Displays a circular gauge chart (360°) for metric visualization
 *
 * @example
 * ```html
 * <app-ring-gauge
 *   [data]="{value: 75, title: 'CPU Usage'}"
 *   [config]="{unit: '%', thresholds: {warning: 70, danger: 90}}"
 * />
 * ```
 */
@Component({
  selector: 'app-ring-gauge',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  providers: [provideEcharts()],
  template: `
    <div class="ring-gauge-container" [style.height]="containerHeight()">
      <div echarts
           [options]="chartOption()"
           [theme]="currentTheme()"
           class="w-full"
           style="flex: 1; min-height: 0;">
      </div>

      @if (config().showTitle && data().subtitle) {
        <div class="text-center mt-2">
          <p class="text-sm text-muted-foreground">{{ data().subtitle }}</p>
        </div>
      }

      @if (showTrend()) {
        <div class="text-center mt-1">
          <span class="text-xs" [class]="trendClass()">
            {{ trendIcon() }} {{ trendText() }}
          </span>
        </div>
      }
    </div>
  `,
  styles: [`
    .ring-gauge-container {
      display: flex;
      flex-direction: column;
      width: 100%;
    }
  `]
})
export class RingGaugeComponent implements OnDestroy {
  // Inputs
  data = input.required<GaugeChartData>();
  config = input<GaugeChartConfig>({});

  private readonly isDarkSignal = signal(this.detectDarkMode());
  private readonly observer: MutationObserver | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this.observer = new MutationObserver(() => {
        this.isDarkSignal.set(this.detectDarkMode());
      });
      this.observer.observe(document.documentElement, { attributeFilter: ['class'] });
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private detectDarkMode(): boolean {
    return typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark');
  }

  // Computed configurations
  private readonly mergedConfig = computed(() => ({
    ...DEFAULT_GAUGE_CONFIG,
    ...this.config()
  }));

  containerHeight = computed(() => this.mergedConfig().height);

  currentTheme = computed<ChartTheme>(() =>
    this.config().theme ?? (this.isDarkSignal() ? 'dark' : 'light')
  );

  // Computed values
  private readonly normalizedValue = computed(() => {
    const value = this.data().value;
    const cfg = this.mergedConfig();
    return Math.max(cfg.min, Math.min(cfg.max, value));
  });

  private readonly severity = computed((): MetricSeverity => {
    const configSeverity = this.config().severity;
    if (configSeverity) {
      return configSeverity;
    }

    const value = this.normalizedValue();
    const thresholds = this.config().thresholds;

    if (!thresholds) {
      return 'info';
    }

    if (value >= thresholds.danger) {
      return 'danger';
    }
    if (value >= thresholds.warning) {
      return 'warning';
    }
    return 'success';
  });

  private readonly gaugeColor = computed(() => {
    const severity = this.severity();
    const colors = DEFAULT_CHART_COLORS;

    // Handle neutral severity which doesn't have gradient
    const gradient = severity === 'neutral'
      ? [colors.neutral[0], colors.neutral[1]]
      : colors.gradient?.[severity] || [colors[severity][0], colors[severity][1]];

    return {
      type: 'linear' as const,
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: gradient[0] },
        { offset: 1, color: gradient[1] }
      ]
    };
  });

  private readonly formattedValue = computed(() => {
    const value = this.normalizedValue();
    const formatter = this.config().valueFormatter;
    const unit = this.mergedConfig().unit;

    if (formatter) {
      return formatter(value);
    }

    return `${value.toFixed(1)}${unit}`;
  });

  // Trend calculation
  showTrend = computed(() => {
    return this.data().previousValue !== undefined;
  });

  private readonly trendDiff = computed(() => {
    const current = this.data().value;
    const previous = this.data().previousValue;
    if (previous === undefined) return 0;
    return current - previous;
  });

  trendIcon = computed(() => {
    const diff = this.trendDiff();
    if (diff > 0) return '↑';
    if (diff < 0) return '↓';
    return '→';
  });

  trendText = computed(() => {
    const diff = Math.abs(this.trendDiff());
    return `${diff.toFixed(1)}${this.mergedConfig().unit}`;
  });

  trendClass = computed(() => {
    const diff = this.trendDiff();
    if (diff > 0) return 'text-red-500';
    if (diff < 0) return 'text-green-500';
    return 'text-gray-500';
  });

  // ECharts option
  chartOption = computed((): EChartsOption => {
    const cfg = this.mergedConfig();
    const value = this.normalizedValue();
    const title = this.data().title;
    const isDark = this.currentTheme() === 'dark';

    return {
      series: [
        {
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          radius: '85%',
          center: ['50%', '50%'],
          min: cfg.min,
          max: cfg.max,
          pointer: {
            show: false
          },
          progress: {
            show: true,
            overlap: false,
            roundCap: true,
            width: 18,
            itemStyle: {
              color: this.gaugeColor()
            }
          },
          axisLine: {
            lineStyle: {
              width: 18,
              color: [[1, isDark ? '#374151' : '#e5e7eb']]
            }
          },
          splitLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          axisLabel: {
            show: false
          },
          data: [{ value, name: title }],
          title: {
            show: cfg.showTitle,
            offsetCenter: [0, '30%'],
            fontSize: 14,
            color: isDark ? '#9ca3af' : '#6b7280',
            fontWeight: 500
          },
          detail: {
            show: cfg.showValue,
            valueAnimation: cfg.animated,
            formatter: () => this.formattedValue(),
            fontSize: 32,
            fontWeight: 'bold',
            color: isDark ? '#f9fafb' : '#111827',
            offsetCenter: [0, 0]
          }
        }
      ],
      animation: cfg.animated
    };
  });

}
