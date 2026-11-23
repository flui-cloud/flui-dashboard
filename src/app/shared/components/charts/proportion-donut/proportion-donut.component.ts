import { Component, input, computed, signal, OnDestroy } from '@angular/core';

import { NgxEchartsDirective, provideEcharts } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  ProportionDonutConfig,
  ProportionDonutData,
  DEFAULT_DONUT_CONFIG,
  DISTRIBUTION_PALETTE,
  ChartTheme,
} from '../chart.models';
import { ChartInk, chartInk } from '../chart-colors';

/**
 * Proportion Donut/Pie Chart Component
 * Supports modern donut with padAngle and Nightingale/Rose charts.
 *
 * Styles:
 * - Standard donut: innerRadius=0.4, padAngle=5, borderRadius=10
 * - Full pie: innerRadius=0, padAngle=5, borderRadius=10
 * - Nightingale: roseType='radius' or 'area' (radius/area varies with value)
 *
 * @example
 * ```html
 * <!-- Modern donut with spacing -->
 * <app-proportion-donut
 *   [data]="{ title: 'Memory', slices: [...] }"
 *   [config]="{ unit: 'MB', padAngle: 5 }"
 * />
 *
 * <!-- Nightingale chart -->
 * <app-proportion-donut
 *   [data]="{ title: 'CPU', slices: [...] }"
 *   [config]="{ roseType: 'radius' }"
 * />
 * ```
 */
@Component({
  selector: 'app-proportion-donut',
  imports: [NgxEchartsDirective],
  providers: [provideEcharts()],
  template: `
    <div class="proportion-donut-container">
      @if (data().title) {
        <h3 class="mb-1 text-fl-body-sm font-semibold text-fl-ink">{{ data().title }}</h3>
      }
      @if (data().subtitle) {
        <p class="mb-2 text-fl-caption text-fl-ink-muted">{{ data().subtitle }}</p>
      }

      <div
        echarts
        role="img"
        [attr.aria-label]="ariaLabel()"
        [options]="chartOption()"
        [theme]="currentTheme()"
        class="w-full"
        [style.height]="mergedConfig().height"
      ></div>
    </div>
  `,
  styles: [
    `
      .proportion-donut-container {
        width: 100%;
      }
    `,
  ],
})
export class ProportionDonutComponent implements OnDestroy {
  data = input.required<ProportionDonutData>();
  config = input<ProportionDonutConfig>({});

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

  mergedConfig = computed(() => ({
    ...DEFAULT_DONUT_CONFIG,
    ...this.config(),
  }));

  currentTheme = computed<ChartTheme>(
    () => this.config().theme ?? (this.isDarkSignal() ? 'dark' : 'light'),
  );

  private readonly total = computed(() => this.data().slices.reduce((sum, s) => sum + s.value, 0));

  private readonly coloredSlices = computed(() =>
    this.data().slices.map((s, i) => ({
      ...s,
      color: s.color || DISTRIBUTION_PALETTE[i % DISTRIBUTION_PALETTE.length],
    })),
  );

  protected readonly ariaLabel = computed(() => {
    const parts = this.data().slices.map((s) => `${s.name} ${s.value}`);
    return parts.length ? `${this.data().title}: ${parts.join(', ')}` : this.data().title;
  });

  chartOption = computed((): EChartsOption => {
    const cfg = this.mergedConfig();
    const slices = this.coloredSlices();
    const total = this.total();
    const ink = chartInk();
    const formatter = this.config().valueFormatter;
    const unit = cfg.unit;

    const option: EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => this.formatTooltip(params, formatter, unit),
        backgroundColor: ink.surface,
        borderColor: ink.border,
        shadowBlur: 0,
        shadowColor: 'transparent',
        textStyle: { color: ink.ink, fontSize: 12 },
      },
      series: [this.buildPieSeries(cfg, ink, slices, formatter, unit) as any],
      animation: cfg.animated,
    };

    if (cfg.showLegend && !cfg.showLabels) {
      option.legend = this.buildLegendOption(
        cfg.legendPosition,
        ink,
        slices,
        total,
        formatter,
        unit,
      );
    }

    return option;
  });

  private formatTooltip(
    params: any,
    formatter: ((value: number, percent: number) => string) | undefined,
    unit: string | undefined,
  ): string {
    const pct = params.percent as number;
    const val = params.value as number;
    const formatted = this.formatSliceValue(val, pct, formatter, unit);
    return `<strong>${params.name}</strong><br/>${formatted} (${pct.toFixed(1)}%)`;
  }

  private buildPieSeries(
    cfg: any,
    ink: ChartInk,
    slices: Array<{ name: string; value: number; color?: string }>,
    formatter: ((value: number, percent: number) => string) | undefined,
    unit: string | undefined,
  ): object {
    const innerPct = cfg.innerRadius > 0 ? `${Math.round(cfg.innerRadius * 100)}%` : '0%';
    return {
      type: 'pie',
      radius: [innerPct, '70%'],
      center: ['50%', '50%'],
      roseType: cfg.roseType,
      avoidLabelOverlap: false,
      padAngle: cfg.padAngle,
      itemStyle: {
        borderRadius: cfg.borderRadius,
        borderColor: ink.surface,
        borderWidth: 2,
      },
      label: this.buildPieLabel(cfg, ink, formatter, unit),
      emphasis: {
        scale: true,
        scaleSize: 5,
      },
      labelLine: cfg.showLabels
        ? {
            show: true,
            length: 20,
            length2: 60,
            smooth: false,
            lineStyle: {
              color: ink.muted,
              width: 1,
            },
          }
        : {
            show: false,
          },
      data: slices.map((s) => ({
        value: s.value,
        name: s.name,
        itemStyle: { color: s.color },
      })),
    };
  }

  private buildPieLabel(
    cfg: any,
    ink: ChartInk,
    formatter: ((value: number, percent: number) => string) | undefined,
    unit: string | undefined,
  ): object {
    if (!cfg.showLabels) return { show: false };
    return {
      show: true,
      formatter: (params: any) => {
        const pct = params.percent as number;
        const val = params.value as number;
        const formatted = this.formatSliceValue(val, pct, formatter, unit);
        return `{name|${params.name}}\n{value|${formatted}} {percent|(${pct.toFixed(1)}%)}`;
      },
      rich: {
        name: {
          fontSize: 12,
          fontWeight: 'bold',
          color: ink.ink,
        },
        value: {
          fontSize: 11,
          color: ink.secondary,
        },
        percent: {
          fontSize: 10,
          color: ink.muted,
        },
      },
      alignTo: 'edge',
      edgeDistance: '5%',
      distanceToLabelLine: 5,
    };
  }

  private formatSliceValue(
    val: number,
    pct: number,
    formatter: ((value: number, percent: number) => string) | undefined,
    unit: string | undefined,
  ): string {
    if (formatter) return formatter(val, pct);
    const unitSuffix = unit ? ' ' + unit : '';
    return `${val.toLocaleString()}${unitSuffix}`;
  }

  private buildLegendOption(
    legendPosition: 'top' | 'right' | 'bottom',
    ink: ChartInk,
    slices: Array<{ name: string; value: number; color?: string }>,
    total: number,
    formatter: ((value: number, percent: number) => string) | undefined,
    unit: string | undefined,
  ): object {
    const legendBase = {
      textStyle: { color: ink.secondary, fontSize: 12 },
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 16,
    };

    if (legendPosition === 'top') {
      return { ...legendBase, top: '0%', left: 'center' };
    }

    if (legendPosition === 'right') {
      return {
        ...legendBase,
        orient: 'vertical',
        right: '2%',
        top: 'middle',
        itemGap: 14,
        formatter: (name: string) => {
          const slice = slices.find((s) => s.name === name);
          if (!slice) return name;
          const val = slice.value;
          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
          const formatted = this.formatSliceValue(val, Number.parseFloat(pct), formatter, unit);
          return `${name}\n${formatted} (${pct}%)`;
        },
      };
    }

    return {
      ...legendBase,
      bottom: 0,
      left: 'center',
      formatter: (name: string) => {
        const slice = slices.find((s) => s.name === name);
        if (!slice) return name;
        const pct = total > 0 ? ((slice.value / total) * 100).toFixed(0) : '0';
        return `${name} ${pct}%`;
      },
    };
  }
}
