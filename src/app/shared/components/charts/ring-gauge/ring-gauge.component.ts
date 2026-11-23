import { Component, input, computed, signal, OnDestroy } from '@angular/core';

import { NgxEchartsDirective, provideEcharts } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  GaugeChartConfig,
  GaugeChartData,
  DEFAULT_GAUGE_CONFIG,
  DEFAULT_CHART_COLORS,
  MetricSeverity,
  ChartTheme,
} from '../chart.models';
import { chartInk } from '../chart-colors';

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
  imports: [NgxEchartsDirective],
  providers: [provideEcharts()],
  template: `
    <div class="ring-gauge-container" [style.height]="containerHeight()">
      <div
        echarts
        role="img"
        [attr.aria-label]="ariaLabel()"
        [options]="chartOption()"
        [theme]="currentTheme()"
        class="min-h-0 w-full flex-1"
      ></div>

      @if (config().showTitle && data().subtitle) {
        <div class="text-center mt-2">
          <p class="m-0 text-fl-caption text-fl-ink-muted">{{ data().subtitle }}</p>
        </div>
      }

      @if (showTrend()) {
        <div class="text-center mt-1">
          <span [class]="trendClass()"> {{ trendIcon() }} {{ trendText() }} </span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ring-gauge-container {
        display: flex;
        flex-direction: column;
        width: 100%;
      }
    `,
  ],
})
export class RingGaugeComponent implements OnDestroy {
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
    return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  }

  private readonly mergedConfig = computed(() => ({
    ...DEFAULT_GAUGE_CONFIG,
    ...this.config(),
  }));

  containerHeight = computed(() => this.mergedConfig().height);

  currentTheme = computed<ChartTheme>(
    () => this.config().theme ?? (this.isDarkSignal() ? 'dark' : 'light'),
  );

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
    return DEFAULT_CHART_COLORS[severity][0];
  });

  protected readonly ariaLabel = computed(() => `${this.data().title}: ${this.formattedValue()}`);

  private readonly formattedValue = computed(() => {
    const value = this.normalizedValue();
    const formatter = this.config().valueFormatter;
    const unit = this.mergedConfig().unit;

    if (formatter) {
      return formatter(value);
    }

    return `${value.toFixed(1)}${unit}`;
  });

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
    if (diff > 0) return 'fl-status fl-status--error';
    if (diff < 0) return 'fl-status fl-status--success';
    return 'fl-status fl-status--neutral';
  });

  chartOption = computed((): EChartsOption => {
    const cfg = this.mergedConfig();
    const value = this.normalizedValue();
    const title = this.data().title;
    const ink = chartInk();

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
            show: false,
          },
          progress: {
            show: true,
            overlap: false,
            roundCap: false,
            width: 10,
            itemStyle: {
              color: this.gaugeColor(),
            },
          },
          axisLine: {
            lineStyle: {
              width: 10,
              color: [[1, ink.track]],
            },
          },
          splitLine: {
            show: false,
          },
          axisTick: {
            show: false,
          },
          axisLabel: {
            show: false,
          },
          data: [{ value, name: title }],
          title: {
            show: cfg.showTitle,
            offsetCenter: [0, '30%'],
            fontSize: 12,
            color: ink.muted,
            fontWeight: 500,
          },
          detail: {
            show: cfg.showValue,
            valueAnimation: cfg.animated,
            formatter: () => this.formattedValue(),
            fontSize: 22,
            fontWeight: 600,
            color: ink.ink,
            offsetCenter: [0, 0],
          },
        },
      ],
      animation: cfg.animated,
    };
  });
}
