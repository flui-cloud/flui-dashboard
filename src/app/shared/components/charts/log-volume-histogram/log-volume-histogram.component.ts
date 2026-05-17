import {
  Component, input, output, computed, signal, OnDestroy, ElementRef, inject, NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective, provideEcharts } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import type { ECharts } from 'echarts/core';

import {
  LogVolumeData,
  LogVolumeHistogramConfig,
  LogVolumeRangeSelection,
  LOG_LEVEL_COLORS,
  ChartTheme,
} from '../chart.models';

// Grid pixel offsets — must match the `grid` config in chartOption()
const GRID_LEFT   = 36;
const GRID_RIGHT  = 12;
const GRID_TOP    = 6;
const GRID_BOTTOM = 28;

/**
 * Log Volume Histogram Component
 *
 * Stacked bar chart showing log volume per level over time.
 * Drag directly on the chart to select a time sub-range;
 * `rangeSelected` emits the corresponding { start, end } dates.
 */
@Component({
  selector: 'app-log-volume-histogram',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  providers: [provideEcharts()],
  template: `
    <div class="relative w-full select-none" [style.height]="mergedConfig().height">

      <!-- Loading overlay -->
      @if (loading()) {
        <div class="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 rounded z-20">
          <span class="text-xs text-gray-400 dark:text-gray-500 animate-pulse">Loading volume…</span>
        </div>
      }

      <!-- Empty state -->
      @if (!loading() && isEmpty()) {
        <div class="absolute inset-0 flex items-center justify-center z-10">
          <span class="text-xs text-gray-400 dark:text-gray-500 italic">No volume data</span>
        </div>
      }

      <!-- ECharts canvas -->
      <div
        echarts
        [options]="chartOption()"
        [theme]="currentTheme()"
        class="w-full h-full"
        (chartInit)="onChartInit($event)"
      ></div>

      <!-- Drag overlay — sits on top of the chart, captures mouse events -->
      @if (!isEmpty() && !loading()) {
        <div
          class="absolute inset-0 z-10"
          style="cursor: crosshair;"
          (mousedown)="onDragStart($event)"
          (mousemove)="onDragMove($event)"
          (mouseup)="onDragEnd($event)"
          (mouseleave)="onDragCancel()"
        >
          <!-- Selection highlight rectangle -->
          @if (isDragging) {
            <div
              class="absolute top-0 pointer-events-none"
              [style.left.px]="selectionLeft"
              [style.width.px]="selectionWidth"
              [style.bottom.px]="GRID_BOTTOM"
              [style.top.px]="GRID_TOP"
              style="background: rgba(59,130,246,0.15); border-left: 1px solid rgba(59,130,246,0.7); border-right: 1px solid rgba(59,130,246,0.7);"
            ></div>
          }

          <!-- Hint label -->
          <div class="absolute top-0.5 right-1 text-[9px] text-gray-300 dark:text-gray-600 pointer-events-none">
            drag to filter
          </div>
        </div>
      }
    </div>
  `,
})
export class LogVolumeHistogramComponent implements OnDestroy {
  protected readonly GRID_BOTTOM = GRID_BOTTOM;
  protected readonly GRID_TOP    = GRID_TOP;

  // ── Inputs / Outputs ──────────────────────────────────────────────────────
  data    = input<LogVolumeData | null>(null);
  config  = input<LogVolumeHistogramConfig>({});
  loading = input(false);

  rangeSelected = output<LogVolumeRangeSelection>();

  // ── DI ───────────────────────────────────────────────────────────────────
  private readonly _el   = inject(ElementRef<HTMLElement>);
  private readonly _zone = inject(NgZone);

  // ── Internal state ────────────────────────────────────────────────────────
  private _chartInstance: ECharts | null = null;
  private readonly isDarkSignal = signal(this.detectDarkMode());
  private readonly _themeObserver: MutationObserver | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this._themeObserver = new MutationObserver(() => {
        this.isDarkSignal.set(this.detectDarkMode());
      });
      this._themeObserver.observe(document.documentElement, { attributeFilter: ['class'] });
    }
  }

  private detectDarkMode(): boolean {
    return typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark');
  }

  // Drag state (raw pixel coords relative to the host element)
  isDragging    = false;
  private _dragStartX = 0;
  private _dragCurrentX = 0;

  // Derived selection rect (px, relative to the host)
  get selectionLeft():  number { return Math.min(this._dragStartX,   this._dragCurrentX); }
  get selectionWidth(): number { return Math.abs(this._dragCurrentX - this._dragStartX); }

  // ── Computed ─────────────────────────────────────────────────────────────
  readonly mergedConfig = computed(() => ({
    height: '80px',
    animated: true,
    responsive: true,
    showLegend: false,
    ...this.config(),
  }));

  readonly currentTheme = computed<ChartTheme>(() =>
    this.config().theme ?? (this.isDarkSignal() ? 'dark' : 'light')
  );

  readonly isEmpty = computed(() => {
    const d = this.data();
    return !d || d.series.length === 0 || d.series.every(s => s.series.length === 0);
  });

  // ── ECharts option ────────────────────────────────────────────────────────
  readonly chartOption = computed((): EChartsOption => {
    const d = this.data();
    const cfg = this.mergedConfig();
    const isDark = this.currentTheme() === 'dark';

    if (!d || this.isEmpty()) return this.emptyOption(isDark);

    // Collect all unique timestamps (union across levels, sorted)
    const tsSet = new Set<number>();
    for (const ls of d.series) {
      for (const b of ls.series) tsSet.add(b.timestamp * 1000);
    }
    const timestamps = Array.from(tsSet).sort((a, b) => a - b);

    const LEVEL_ORDER = ['error', 'warn', 'info', 'debug', 'trace'];
    const orderedSeries = LEVEL_ORDER
      .map(lvl => d.series.find(s => s.level === lvl))
      .filter(Boolean) as typeof d.series;
    for (const ls of d.series) {
      if (!LEVEL_ORDER.includes(ls.level)) orderedSeries.push(ls);
    }

    const bucketMap = (ls: typeof d.series[0]) => {
      const m = new Map<number, number>();
      for (const b of ls.series) m.set(b.timestamp * 1000, b.count);
      return m;
    };

    const highlight = cfg.highlightRange;
    const markArea = highlight ? {
      silent: true,
      itemStyle: { color: 'rgba(59,130,246,0.12)', borderWidth: 0 },
      data: [[
        { xAxis: highlight.start.getTime() },
        { xAxis: highlight.end.getTime()   },
      ]],
    } : undefined;

    const echartsSeriesList: any[] = orderedSeries.map((ls, i) => ({
      name: ls.level,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 40,
      itemStyle: {
        color: LOG_LEVEL_COLORS[ls.level] ?? '#6b7280',
        borderRadius: [1, 1, 0, 0],
      },
      emphasis: { focus: 'series' },
      data: timestamps.map(ts => [ts, bucketMap(ls).get(ts) ?? 0]),
      // markArea only on the first series to avoid stacking duplicates
      ...(i === 0 && markArea ? { markArea } : {}),
    }));

    return {
      animation: cfg.animated,
      grid: {
        left:   GRID_LEFT,
        right:  GRID_RIGHT,
        top:    cfg.showLegend ? 24 : GRID_TOP,
        bottom: GRID_BOTTOM,
        containLabel: false,
      },
      legend: cfg.showLegend ? {
        top: 0, right: 0, itemWidth: 10, itemHeight: 10,
        textStyle: { color: isDark ? '#9ca3af' : '#6b7280', fontSize: 10 },
      } : { show: false },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        textStyle: { color: isDark ? '#f9fafb' : '#111827', fontSize: 11 },
        formatter: (params: any) => {
          const ts = new Date(params[0].value[0]);
          const label = ts.toLocaleString('en-GB', {
            month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
          });
          let html = `<div style="font-weight:600;margin-bottom:4px;">${label}</div>`;
          let total = 0;
          for (const p of params) {
            const v = p.value[1] as number;
            if (v === 0) continue;
            total += v;
            html += `<div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};"></span>
              <span style="flex:1;">${p.seriesName}</span>
              <span style="font-weight:600;font-variant-numeric:tabular-nums;">${v.toLocaleString()}</span>
            </div>`;
          }
          html += `<div style="margin-top:5px;padding-top:4px;border-top:1px solid ${isDark ? '#374151' : '#e5e7eb'};display:flex;justify-content:space-between;">
            <span>Total</span><span style="font-weight:700;">${total.toLocaleString()}</span>
          </div>`;
          return html;
        },
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: isDark ? '#374151' : '#e5e7eb' } },
        axisTick: { show: false },
        axisLabel: {
          color: isDark ? '#6b7280' : '#9ca3af',
          fontSize: 9,
          formatter: (val: number) => {
            const d = new Date(val);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: {
          color: isDark ? '#6b7280' : '#9ca3af',
          fontSize: 9,
          formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`,
        },
        splitLine: {
          lineStyle: { color: isDark ? '#1f2937' : '#f3f4f6', type: 'dashed' },
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: echartsSeriesList,
    };
  });

  // ── Chart lifecycle ───────────────────────────────────────────────────────
  onChartInit(chart: ECharts) {
    this._chartInstance = chart;
  }

  ngOnDestroy() {
    this._chartInstance?.dispose();
    this._chartInstance = null;
    this._themeObserver?.disconnect();
  }

  // ── Drag handlers (run outside Angular zone for perf) ────────────────────
  onDragStart(e: MouseEvent) {
    if (this.isEmpty() || !this._chartInstance) return;
    const x = this.clientXToHostX(e.clientX);
    if (!this.isInsideGrid(x)) return;
    this._zone.run(() => {
      this.isDragging    = true;
      this._dragStartX   = x;
      this._dragCurrentX = x;
    });
  }

  onDragMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const x = this.clampToGrid(this.clientXToHostX(e.clientX));
    this._zone.run(() => { this._dragCurrentX = x; });
  }

  onDragEnd(e: MouseEvent) {
    if (!this.isDragging) return;
    const x = this.clampToGrid(this.clientXToHostX(e.clientX));
    this._zone.run(() => {
      this.isDragging = false;
      this.emitRange(this._dragStartX, x);
    });
  }

  onDragCancel() {
    if (this.isDragging) {
      this._zone.run(() => { this.isDragging = false; });
    }
  }

  // ── Coordinate helpers ────────────────────────────────────────────────────

  /** Convert clientX → X relative to the host element */
  private clientXToHostX(clientX: number): number {
    const rect = (this._el.nativeElement as HTMLElement).getBoundingClientRect();
    return clientX - rect.left;
  }

  /** Check whether a host-relative X is inside the chart grid area */
  private isInsideGrid(x: number): boolean {
    const w = (this._el.nativeElement as HTMLElement).offsetWidth;
    return x >= GRID_LEFT && x <= w - GRID_RIGHT;
  }

  /** Clamp a host-relative X to the grid boundaries */
  private clampToGrid(x: number): number {
    const w = (this._el.nativeElement as HTMLElement).offsetWidth;
    return Math.max(GRID_LEFT, Math.min(w - GRID_RIGHT, x));
  }

  /**
   * Convert two host-relative pixel X positions to timestamps via ECharts
   * `convertFromPixel`, then emit rangeSelected.
   */
  private emitRange(x1: number, x2: number) {
    if (!this._chartInstance) return;
    if (Math.abs(x2 - x1) < 4) return; // too small — ignore click

    const msA = this._chartInstance.convertFromPixel({ seriesIndex: 0 }, [x1, 0]) as [number, number] | null;
    const msB = this._chartInstance.convertFromPixel({ seriesIndex: 0 }, [x2, 0]) as [number, number] | null;

    if (!msA || !msB) return;

    const startMs = Math.min(msA[0], msB[0]);
    const endMs   = Math.max(msA[0], msB[0]);

    if (endMs - startMs < 1000) return;

    this.rangeSelected.emit({ start: new Date(startMs), end: new Date(endMs) });
  }

  // ── Misc ─────────────────────────────────────────────────────────────────
  private emptyOption(isDark: boolean): EChartsOption {
    return {
      grid: { left: GRID_LEFT, right: GRID_RIGHT, top: GRID_TOP, bottom: GRID_BOTTOM },
      xAxis: { type: 'time', axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } },
      yAxis: { type: 'value', axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } },
      series: [],
    };
  }

}
