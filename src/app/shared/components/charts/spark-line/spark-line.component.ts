import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

interface SparkGeometry {
  line: string;
  area: string;
  lastX: number;
  lastY: number;
}

/**
 * Spark Line Component
 * A label-free trend mark sized for a stat tile. Drawn as plain SVG rather
 * than ECharts: a page shows a handful of these next to the real charts and
 * an ECharts instance per mark would cost far more than it renders.
 *
 * @example
 * ```html
 * <app-spark-line [values]="[8.1, 8.4, 9.6, 8.2]" color="#2259F1" [width]="132" />
 * ```
 */
@Component({
  selector: 'app-spark-line',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (geometry(); as g) {
      <svg
        [attr.width]="width()"
        [attr.height]="height()"
        [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        <path [attr.d]="g.area" [attr.fill]="color()" fill-opacity="0.10" />
        <polyline
          [attr.points]="g.line"
          fill="none"
          [attr.stroke]="color()"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <circle
          [attr.cx]="g.lastX"
          [attr.cy]="g.lastY"
          r="3.5"
          [attr.fill]="color()"
          [style.stroke]="'hsl(var(--card))'"
          stroke-width="2"
        />
      </svg>
    } @else {
      <div
        class="rounded bg-muted"
        [style.width.px]="width()"
        [style.height.px]="height()"
        aria-hidden="true"
      ></div>
    }
  `,
  styles: [`
    :host { display: inline-flex; }
  `],
})
export class SparkLineComponent {
  readonly values = input<number[]>([]);
  readonly color = input<string>('#2259F1');
  readonly width = input<number>(132);
  readonly height = input<number>(30);
  readonly ariaLabel = input<string>('Recent trend');

  /** Fraction of the value range kept as head/foot room, so a flat line sits mid-height. */
  private static readonly PADDING_RATIO = 0.45;
  private static readonly INSET = 2;

  readonly geometry = computed<SparkGeometry | null>(() => {
    const values = this.values();
    if (values.length < 2) return null;

    const w = this.width();
    const h = this.height();
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 1;
    const lo = min - spread * SparkLineComponent.PADDING_RATIO;
    const hi = max + spread * SparkLineComponent.PADDING_RATIO;

    const inset = SparkLineComponent.INSET;
    const x = (i: number) => inset + (i / (values.length - 1)) * (w - inset * 4);
    const y = (v: number) => h - inset - ((v - lo) / (hi - lo)) * (h - inset * 4);

    const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const lastIndex = values.length - 1;

    return {
      line: points.join(' '),
      area: `M${points.join(' L')} L${x(lastIndex).toFixed(1)},${h} L${inset},${h} Z`,
      lastX: Number(x(lastIndex).toFixed(1)),
      lastY: Number(y(values[lastIndex]).toFixed(1)),
    };
  });
}
