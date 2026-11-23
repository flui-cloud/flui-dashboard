import { Component, input, computed, signal, OnDestroy } from '@angular/core';

import { NgxEchartsDirective, provideEcharts } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  TimeSeriesChartConfig,
  TimeSeriesChartData,
  DEFAULT_TIMESERIES_CONFIG,
  DEFAULT_CHART_COLORS,
  ChartTheme,
} from '../chart.models';
import { ChartInk, chartInk } from '../chart-colors';

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
  imports: [NgxEchartsDirective],
  providers: [provideEcharts()],
  template: `
    <div class="time-series-container" [style.height]="config().height">
      <div
        echarts
        role="img"
        [attr.aria-label]="ariaLabel()"
        [options]="chartOption()"
        [theme]="currentTheme()"
        class="w-full h-full"
      ></div>
    </div>
  `,
  styles: [
    `
      .time-series-container {
        display: flex;
        flex-direction: column;
        width: 100%;
      }
    `,
  ],
})
export class TimeSeriesLineComponent implements OnDestroy {
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
    return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  }

  private readonly mergedConfig = computed(() => ({
    ...DEFAULT_TIMESERIES_CONFIG,
    ...this.config(),
  }));

  currentTheme = computed<ChartTheme>(
    () => this.config().theme ?? (this.isDarkSignal() ? 'dark' : 'light'),
  );

  private getSeriesColor(index: number, customColor?: string): string {
    if (customColor) return customColor;

    const colorPalette = [
      DEFAULT_CHART_COLORS.info[0],
      DEFAULT_CHART_COLORS.success[0],
      DEFAULT_CHART_COLORS.warning[0],
      DEFAULT_CHART_COLORS.danger[0],
      DEFAULT_CHART_COLORS.neutral[0],
    ];

    return colorPalette[index % colorPalette.length];
  }

  protected readonly ariaLabel = computed(() => {
    const { title, series } = this.data();
    const names = series.map((s) => s.name).join(', ');
    return names ? `${title}: line chart of ${names}` : `${title}: line chart`;
  });

  private formatTimestamp(timestamp: Date | number): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
    const formatter = this.config().timeFormatter;

    if (formatter) {
      return formatter(date);
    }

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private formatValue(value: number): string {
    const formatter = this.config().valueFormatter;
    const unit = this.mergedConfig().unit;

    if (formatter) {
      return formatter(value);
    }

    return `${value.toFixed(1)}${unit}`;
  }

  chartOption = computed((): EChartsOption => {
    const cfg = this.mergedConfig();
    const chartData = this.data();
    const ink = chartInk();

    const series = this.buildSeries(chartData, cfg);

    const thresholdMarkLines = this.buildThresholdMarkLines(cfg);
    if (series.length > 0 && thresholdMarkLines.length > 0) {
      series[0].markLine = {
        silent: true,
        symbol: 'none',
        data: thresholdMarkLines,
      };
    }

    const withTitle = cfg.showTitle !== false;

    return {
      backgroundColor: 'transparent',
      title: {
        text: withTitle ? chartData.title : '',
        left: 'left',
        textStyle: {
          fontSize: 13,
          fontWeight: 600,
          color: ink.ink,
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: ink.surface,
        borderColor: ink.border,
        shadowBlur: 0,
        shadowColor: 'transparent',
        textStyle: {
          color: ink.ink,
          fontSize: 12,
        },
        formatter: (params: any) => this.formatTooltip(params),
      },
      legend: this.buildLegendConfig(cfg, chartData, ink),
      grid: this.buildGridConfig(cfg, chartData),
      xAxis: this.buildXAxisConfig(cfg, ink),
      yAxis: this.buildYAxisConfig(cfg, ink),
      series: series,
      animation: cfg.animated,
      dataZoom: this.buildDataZoomConfig(cfg),
    };
  });

  private buildLegendConfig(cfg: any, chartData: TimeSeriesChartData, ink: ChartInk): object {
    return {
      show: this.hasLegend(cfg, chartData),
      top: this.titleHeight(cfg),
      left: 'left',
      textStyle: {
        color: ink.muted,
        fontSize: 12,
      },
    };
  }

  private titleHeight(cfg: any): number {
    return cfg.showTitle === false ? 0 : 38;
  }

  private hasLegend(cfg: any, chartData: TimeSeriesChartData): boolean {
    return Boolean(cfg.showLegend) && chartData.series.length > 1;
  }

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
      containLabel: true,
    };
  }

  private buildXAxisConfig(cfg: any, ink: ChartInk): object {
    return {
      type: 'time',
      boundaryGap: false as any,
      axisLine: {
        lineStyle: {
          color: ink.border,
        },
      },
      axisLabel: {
        color: ink.muted,
        fontSize: 11,
        hideOverlap: true,
        formatter: (value: number) => this.formatTimestamp(new Date(value)),
      },
      splitLine: {
        show: cfg.showGrid,
        lineStyle: {
          color: ink.subtle,
          type: 'dashed',
        },
      },
    };
  }

  private buildYAxisConfig(cfg: any, ink: ChartInk): object {
    return {
      type: 'value',
      min: cfg.yMin,
      max: cfg.yMax,
      axisLine: {
        show: false,
      },
      axisLabel: {
        color: ink.muted,
        fontSize: 11,
        formatter: (value: number) => this.formatValue(value),
      },
      splitLine: {
        show: cfg.showGrid,
        lineStyle: {
          color: ink.subtle,
          type: 'dashed',
        },
      },
    };
  }

  private buildDataZoomConfig(cfg: any): any[] | undefined {
    if (!cfg.enableZoom) return undefined;
    return [
      {
        type: 'inside',
        start: 0,
        end: 100,
      },
      {
        start: 0,
        end: 100,
        height: 20,
        bottom: 10,
      },
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
          width: 1.5,
          color: this.getSeriesColor(index, s.color),
        },
        itemStyle: {
          color: this.getSeriesColor(index, s.color),
        },
        data: s.data.map((point) => [
          typeof point.timestamp === 'number' ? point.timestamp : point.timestamp.getTime(),
          point.value,
        ]),
      };

      if (s.showArea) {
        seriesConfig.areaStyle = {
          opacity: 0.15,
          color: this.getSeriesColor(index, s.color),
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
          width: 1,
          opacity: 0.6,
        },
        label: {
          show: true,
          position: 'insideEndTop',
          formatter: 'Warning',
          color: DEFAULT_CHART_COLORS.warning[0],
          fontSize: 10,
        },
      });
    }
    if (cfg.thresholds?.danger !== undefined) {
      thresholdMarkLines.push({
        yAxis: cfg.thresholds.danger,
        lineStyle: {
          color: DEFAULT_CHART_COLORS.danger[0],
          type: 'dashed',
          width: 1,
          opacity: 0.6,
        },
        label: {
          show: true,
          position: 'insideEndTop',
          formatter: 'Danger',
          color: DEFAULT_CHART_COLORS.danger[0],
          fontSize: 10,
        },
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
        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${color}; margin-right: 8px;"></span>
        <span style="flex: 1;">${param.seriesName}:</span>
        <span style="font-weight: 600; margin-left: 8px;">${this.formatValue(value)}</span>
      </div>`;
    });

    return result;
  }
}
