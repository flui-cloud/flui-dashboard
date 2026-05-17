import { Component, input, computed, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective, provideEcharts } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  ProportionDonutConfig,
  ProportionDonutData,
  DEFAULT_DONUT_CONFIG,
  DISTRIBUTION_PALETTE,
  ChartTheme
} from '../chart.models';

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
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  providers: [provideEcharts()],
  template: `
    <div class="proportion-donut-container">
      @if (data().title) {
        <h3 class="text-sm font-medium text-foreground mb-1">{{ data().title }}</h3>
      }
      @if (data().subtitle) {
        <p class="text-xs text-muted-foreground mb-2">{{ data().subtitle }}</p>
      }

      <div echarts
           [options]="chartOption()"
           [theme]="currentTheme()"
           class="w-full"
           [style.height]="mergedConfig().height">
      </div>
    </div>
  `,
  styles: [`
    .proportion-donut-container {
      width: 100%;
    }
  `]
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
    return typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark');
  }

  mergedConfig = computed(() => ({
    ...DEFAULT_DONUT_CONFIG,
    ...this.config()
  }));

  currentTheme = computed<ChartTheme>(() =>
    this.config().theme ?? (this.isDarkSignal() ? 'dark' : 'light')
  );

  private readonly total = computed(() =>
    this.data().slices.reduce((sum, s) => sum + s.value, 0)
  );

  private readonly coloredSlices = computed(() =>
    this.data().slices.map((s, i) => ({
      ...s,
      color: s.color || DISTRIBUTION_PALETTE[i % DISTRIBUTION_PALETTE.length]
    }))
  );

  chartOption = computed((): EChartsOption => {
    const cfg = this.mergedConfig();
    const slices = this.coloredSlices();
    const total = this.total();
    const isDark = this.currentTheme() === 'dark';
    const formatter = this.config().valueFormatter;
    const unit = cfg.unit;
    const innerPct = cfg.innerRadius > 0 ? `${Math.round(cfg.innerRadius * 100)}%` : '0%';

    const option: EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const pct = params.percent as number;
          const val = params.value as number;
          const unitSuffix = unit ? ' ' + unit : '';
          const formatted = formatter
            ? formatter(val, pct)
            : `${val.toLocaleString()}${unitSuffix}`;
          return `<strong>${params.name}</strong><br/>${formatted} (${pct.toFixed(1)}%)`;
        },
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textStyle: { color: isDark ? '#f9fafb' : '#111827' }
      },
      series: [{
        type: 'pie',
        radius: [innerPct, '70%'],
        center: ['50%', '50%'],
        roseType: cfg.roseType,
        avoidLabelOverlap: false,
        padAngle: cfg.padAngle,
        itemStyle: {
          borderRadius: cfg.borderRadius,
          borderColor: isDark ? '#1f2937' : '#ffffff',
          borderWidth: 2
        },
        label: cfg.showLabels ? {
          show: true,
          formatter: (params: any) => {
            const pct = params.percent as number;
            const val = params.value as number;
            const unitSuffix = unit ? ' ' + unit : '';
            const formatted = formatter
              ? formatter(val, pct)
              : `${val.toLocaleString()}${unitSuffix}`;
            return `{name|${params.name}}\n{value|${formatted}} {percent|(${pct.toFixed(1)}%)}`;
          },
          rich: {
            name: {
              fontSize: 12,
              fontWeight: 'bold',
              color: isDark ? '#f9fafb' : '#111827'
            },
            value: {
              fontSize: 11,
              color: isDark ? '#d1d5db' : '#4b5563'
            },
            percent: {
              fontSize: 10,
              color: isDark ? '#9ca3af' : '#6b7280'
            }
          },
          alignTo: 'edge',
          edgeDistance: '5%',
          distanceToLabelLine: 5
        } : {
          show: false
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)'
          },
          scale: true,
          scaleSize: 5
        },
        labelLine: cfg.showLabels ? {
          show: true,
          length: 20,
          length2: 60,
          smooth: false,
          lineStyle: {
            color: isDark ? '#4b5563' : '#9ca3af',
            width: 1
          }
        } : {
          show: false
        },
        data: slices.map(s => ({
          value: s.value,
          name: s.name,
          itemStyle: { color: s.color }
        }))
      }],
      animation: cfg.animated
    };

    // Legend (disabled if showLabels is true)
    if (cfg.showLegend && !cfg.showLabels) {
      const legendBase = {
        textStyle: { color: isDark ? '#d1d5db' : '#4b5563', fontSize: 12 },
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 16
      };

      if (cfg.legendPosition === 'top') {
        option.legend = {
          ...legendBase,
          top: '0%',
          left: 'center'
        };
      } else if (cfg.legendPosition === 'right') {
        option.legend = {
          ...legendBase,
          orient: 'vertical',
          right: '2%',
          top: 'middle',
          itemGap: 14,
          formatter: (name: string) => {
            const slice = slices.find(s => s.name === name);
            if (!slice) return name;
            const val = slice.value;
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
            const unitSuffix = unit ? ' ' + unit : '';
            const formatted = formatter
              ? formatter(val, Number.parseFloat(pct))
              : `${val.toLocaleString()}${unitSuffix}`;
            return `${name}\n${formatted} (${pct}%)`;
          }
        };
      } else {
        // bottom
        option.legend = {
          ...legendBase,
          bottom: 0,
          left: 'center',
          formatter: (name: string) => {
            const slice = slices.find(s => s.name === name);
            if (!slice) return name;
            const pct = total > 0 ? ((slice.value / total) * 100).toFixed(0) : '0';
            return `${name} ${pct}%`;
          }
        };
      }
    }

    return option;
  });

}
