import { Component, computed, input } from '@angular/core';

export interface ChartSeries {
  readonly label: string;
  readonly points: readonly number[];
}

export interface ChartThreshold {
  readonly label: string;
  readonly value: number;
}

function path(points: readonly number[], max: number): string {
  if (points.length < 2) return '';
  const step = 100 / (points.length - 1);
  return points
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${(i * step).toFixed(2)},${(100 - (Math.min(p, max) / max) * 100).toFixed(2)}`,
    )
    .join(' ');
}

@Component({
  selector: 'fl-line-chart',
  template: `
    <div class="fl-legend mb-2">
      @for (s of series(); track s.label; let i = $index) {
        <span
          ><svg width="16" height="6" aria-hidden="true">
            <line x1="0" y1="3" x2="16" y2="3" [class]="i ? 's2' : 's1'" /></svg
          >{{ s.label }}</span
        >
      }
      @if (warning(); as w) {
        <span
          ><svg width="16" height="6" aria-hidden="true">
            <line x1="0" y1="3" x2="16" y2="3" class="warn" /></svg
          >{{ w.label }}</span
        >
      }
      @if (critical(); as c) {
        <span
          ><svg width="16" height="6" aria-hidden="true">
            <line x1="0" y1="3" x2="16" y2="3" class="crit" /></svg
          >{{ c.label }}</span
        >
      }
    </div>
    <div class="fl-chart" role="img" [attr.aria-label]="reading()">
      <div class="fl-chart__y" aria-hidden="true">
        @for (y of yLabels(); track $index) {
          <span>{{ y }}</span>
        }
      </div>
      <svg
        class="fl-chart__plot"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        @for (g of grid; track g) {
          <line
            x1="0"
            x2="100"
            [attr.y1]="g"
            [attr.y2]="g"
            class="grid"
            vector-effect="non-scaling-stroke"
          />
        }
        <line x1="0" x2="100" y1="100" y2="100" class="axis" vector-effect="non-scaling-stroke" />
        @if (warning(); as w) {
          <line
            x1="0"
            x2="100"
            [attr.y1]="y(w.value)"
            [attr.y2]="y(w.value)"
            class="warn"
            vector-effect="non-scaling-stroke"
          />
        }
        @if (critical(); as c) {
          <line
            x1="0"
            x2="100"
            [attr.y1]="y(c.value)"
            [attr.y2]="y(c.value)"
            class="crit"
            vector-effect="non-scaling-stroke"
          />
        }
        @for (d of paths(); track $index; let i = $index) {
          <path [attr.d]="d" [class]="i ? 's2' : 's1'" vector-effect="non-scaling-stroke" />
        }
      </svg>
      <div class="fl-chart__x" aria-hidden="true">
        @for (x of xLabels(); track $index; let i = $index; let n = $count) {
          <span [style.left.%]="n > 1 ? (i * 100) / (n - 1) : 0">{{ x }}</span>
        }
      </div>
    </div>
  `,
})
export class FlLineChart {
  readonly series = input.required<readonly ChartSeries[]>();
  readonly max = input(100);
  readonly yLabels = input<readonly string[]>(['100%', '50%', '0%']);
  readonly xLabels = input<readonly string[]>([]);
  readonly warning = input<ChartThreshold>();
  readonly critical = input<ChartThreshold>();
  readonly reading = input.required<string>();
  protected readonly grid = [0, 25, 50, 75];
  protected readonly paths = computed(() =>
    this.series()
      .slice(0, 2)
      .map((s) => path(s.points, this.max())),
  );

  protected y(value: number): number {
    return 100 - (Math.min(value, this.max()) / this.max()) * 100;
  }
}
