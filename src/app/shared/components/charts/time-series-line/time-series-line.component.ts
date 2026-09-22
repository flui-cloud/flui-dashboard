import { Component, input, computed, signal, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

import { NgxEchartsDirective, provideEcharts } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  TimeSeriesChartConfig,
  TimeSeriesChartData,
  DEFAULT_TIMESERIES_CONFIG,
  DEFAULT_CHART_COLORS,
  ChartTheme
} from '../chart.models';

/**
 * Time Series Line Chart Component
 * Displays temporal data with line charts, perfect for metrics history
 *
 * @example
 * ```html
 * <app-time-series-line
 *   [data]="{
 *     title: 'CPU Usage',
 *     series: [{
 *       name: 'CPU',
 *       data: [
 *         { timestamp: new Date('2024-01-01 10:00'), value: 45 },
 *         { timestamp: new Date('2024-01-01 10:05'), value: 52 }
 *       ]
 *     }]
 *   }"
 *   [config]="{unit: '%', showGrid: true}"
 * />
 * ```
 */
@Component({
  selector: 'app-time-series-line',
  standalone: true,
  imports: [NgxEchartsDirective],
  providers: [provideEcharts()],
  template: `
    <div class="time-series-container" [style.height]="config().height">
      <div echarts
           [options]="chartOption()"
           [theme]="currentTheme()"
           class="w-full h-full">
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .time-series-container {
      display: flex;
      flex-direction: column;
      width: 100%;
    }
  `]
})
export class TimeSeriesLineComponent implements OnDestroy {
  // Inputs
  data = input.required<TimeSeriesChartData>();
  config = input<TimeSeriesChartConfig>({});

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
    ...DEFAULT_TIMESERIES_CONFIG,
    ...this.config()
  }));

  currentTheme = computed<ChartTheme>(() =>
    this.config().theme ?? (this.isDarkSignal() ? 'dark' : 'light')
  );

  // Get colors for series
  private getSeriesColor(index: number, customColor?: string): string {
    if (customColor) return customColor;

    const colorPalette = [
      DEFAULT_CHART_COLORS.info[0],
      DEFAULT_CHART_COLORS.success[0],
      DEFAULT_CHART_COLORS.warning[0],
      DEFAULT_CHART_COLORS.danger[0],
      DEFAULT_CHART_COLORS.neutral[0]
    ];

    return colorPalette[index % colorPalette.length];
  }

  // Format timestamp for display
  private formatTimestamp(timestamp: Date | number): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
    const formatter = this.config().timeFormatter;

    if (formatter) {
      return formatter(date);
    }

    // Default format: HH:MM
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Format value for display
  private formatValue(value: number): string {
    const formatter = this.config().valueFormatter;
    const unit = this.mergedConfig().unit;

    if (formatter) {
      return formatter(value);
    }

    return `${value.toFixed(1)}${unit}`;
  }

  // ECharts option
  chartOption = computed((): EChartsOption => {
    const cfg = this.mergedConfig();
    const chartData = this.data();
    const isDark = this.currentTheme() === 'dark';

    const series = this.buildSeries(chartData, cfg);

    // Add mark lines to first series
    const thresholdMarkLines = this.buildThresholdMarkLines(cfg);
    if (series.length > 0 && thresholdMarkLines.length > 0) {
      series[0].markLine = {
        silent: true,
        data: thresholdMarkLines
      };
    }

    const withTitle = cfg.showTitle !== false;

    return {
      // The card behind the chart carries its own surface, in both themes. The
      // built-in dark theme paints one of its own, which showed as a lighter
      // rectangle sitting inside the card.
      backgroundColor: 'transparent',
      title: {
        text: withTitle ? chartData.title : '',
        left: 'left',
        textStyle: {
          fontSize: 16,
          fontWeight: 600,
          color: isDark ? '#f9fafb' : '#111827'
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textStyle: {
          color: isDark ? '#f9fafb' : '#111827'
        },
        formatter: (params: any) => this.formatTooltip(params)
      },
      legend: this.buildLegendConfig(cfg, chartData, isDark),
      grid: this.buildGridConfig(cfg, chartData),
      xAxis: this.buildXAxisConfig(cfg, isDark),
      yAxis: this.buildYAxisConfig(cfg, isDark),
      series: series,
      animation: cfg.animated,
      dataZoom: this.buildDataZoomConfig(cfg)
    };
  });

  private buildLegendConfig(cfg: any, chartData: TimeSeriesChartData, isDark: boolean): object {
    return {
      show: this.hasLegend(cfg, chartData),
      top: this.titleHeight(cfg),
      left: 'left',
      textStyle: {
        color: isDark ? '#9ca3af' : '#6b7280'
      }
    };
  }

  /** Height the title takes above everything else, or nothing where it is not drawn. */
  private titleHeight(cfg: any): number {
    return cfg.showTitle === false ? 0 : 38;
  }

  private hasLegend(cfg: any, chartData: TimeSeriesChartData): boolean {
    return Boolean(cfg.showLegend) && chartData.series.length > 1;
  }

  /**
   * Room above the plot: the title where it is drawn, then the legend under it.
   * Both are measured from the same numbers as the legend's own offset, so
   * dropping the title moves the legend up instead of onto the axis labels.
   */
  private plotTop(cfg: any, chartData: TimeSeriesChartData): number {
    const legend = this.hasLegend(cfg, chartData) ? 26 : 0;
    return Math.max(12, this.titleHeight(cfg) + legend + 10);
  }

  private buildGridConfig(cfg: any, chartData: TimeSeriesChartData): object {
    return {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: this.plotTop(cfg, chartData),
      containLabel: true
    };
  }

  private buildXAxisConfig(cfg: any, isDark: boolean): object {
    return {
      type: 'time',
      boundaryGap: false as any,
      axisLine: {
        lineStyle: {
          color: isDark ? '#374151' : '#e5e7eb'
        }
      },
      axisLabel: {
        color: isDark ? '#9ca3af' : '#6b7280',
        fontSize: 11,
        formatter: (value: number) => this.formatTimestamp(new Date(value))
      },
      splitLine: {
        show: cfg.showGrid,
        lineStyle: {
          color: isDark ? '#374151' : '#f3f4f6',
          type: 'dashed'
        }
      }
    };
  }

  private buildYAxisConfig(cfg: any, isDark: boolean): object {
    return {
      type: 'value',
      min: cfg.yMin,
      max: cfg.yMax,
      axisLine: {
        show: false
      },
      axisLabel: {
        color: isDark ? '#9ca3af' : '#6b7280',
        fontSize: 11,
        formatter: (value: number) => this.formatValue(value)
      },
      splitLine: {
        show: cfg.showGrid,
        lineStyle: {
          color: isDark ? '#374151' : '#f3f4f6',
          type: 'dashed'
        }
      }
    };
  }

  private buildDataZoomConfig(cfg: any): any[] | undefined {
    if (!cfg.enableZoom) return undefined;
    return [
      {
        type: 'inside',
        start: 0,
        end: 100
      },
      {
        start: 0,
        end: 100,
        height: 20,
        bottom: 10
      }
    ];
  }

  private buildSeries(chartData: TimeSeriesChartData, cfg: any): any[] {
    return chartData.series.map((s, index) => {
      const seriesConfig: any = {
        name: s.name,
        type: 'line',
        smooth: s.smooth ?? true,
        symbol: cfg.showDataPoints ? 'circle' : 'none',
        symbolSize: 6,
        lineStyle: {
          width: 2,
          color: this.getSeriesColor(index, s.color)
        },
        itemStyle: {
          color: this.getSeriesColor(index, s.color)
        },
        data: s.data.map(point => [
          typeof point.timestamp === 'number' ? point.timestamp : point.timestamp.getTime(),
          point.value
        ])
      };

      if (s.showArea) {
        seriesConfig.areaStyle = {
          opacity: 0.15,
          color: this.getSeriesColor(index, s.color)
        };
      }

      return seriesConfig;
    });
  }

  private buildThresholdMarkLines(cfg: any): any[] {
    const thresholdMarkLines: any[] = [];
    if (cfg.thresholds?.warning !== undefined) {
      thresholdMarkLines.push({
        yAxis: cfg.thresholds.warning,
        lineStyle: {
          color: DEFAULT_CHART_COLORS.warning[0],
          type: 'dashed',
          width: 2
        },
        label: {
          show: true,
          position: 'end',
          formatter: 'Warning',
          color: DEFAULT_CHART_COLORS.warning[0],
          fontSize: 10
        }
      });
    }
    if (cfg.thresholds?.danger !== undefined) {
      thresholdMarkLines.push({
        yAxis: cfg.thresholds.danger,
        lineStyle: {
          color: DEFAULT_CHART_COLORS.danger[0],
          type: 'dashed',
          width: 2
        },
        label: {
          show: true,
          position: 'end',
          formatter: 'Danger',
          color: DEFAULT_CHART_COLORS.danger[0],
          fontSize: 10
        }
      });
    }
    return thresholdMarkLines;
  }

  private formatTooltip(params: any[]): string {
    const timestamp = new Date(params[0].value[0]);
    let result = `<div style="font-weight: 600; margin-bottom: 4px;">${this.formatTimestamp(timestamp)}</div>`;

    params.forEach((param: any) => {
      const value = param.value[1];
      const color = param.color;
      result += `<div style="display: flex; align-items: center; margin-top: 4px;">
        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color}; margin-right: 8px;"></span>
        <span style="flex: 1;">${param.seriesName}:</span>
        <span style="font-weight: 600; margin-left: 8px;">${this.formatValue(value)}</span>
      </div>`;
    });

    return result;
  }

}
