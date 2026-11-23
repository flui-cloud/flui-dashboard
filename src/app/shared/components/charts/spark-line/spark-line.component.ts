import { Component, input, computed } from '@angular/core';
import { cssColor } from '../chart-colors';

interface SparkGeometry {
  line: string;
  area: string;
  lastX: number;
  lastY: number;
}

@Component({
  selector: 'app-spark-line',
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
          stroke-width="1.5"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <circle
          [attr.cx]="g.lastX"
          [attr.cy]="g.lastY"
          r="3"
          [attr.fill]="color()"
          class="stroke-fl-surface"
          stroke-width="2"
        />
      </svg>
    } @else {
      <svg
        [attr.width]="width()"
        [attr.height]="height()"
        [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
        aria-hidden="true"
      >
        <line
          x1="0"
          [attr.x2]="width()"
          [attr.y1]="height() / 2"
          [attr.y2]="height() / 2"
          class="stroke-fl-border"
          stroke-dasharray="3 3"
        />
      </svg>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
    `,
  ],
})
export class SparkLineComponent {
  readonly values = input<number[]>([]);
  readonly color = input<string>(cssColor('--fl-accent'));
  readonly width = input<number>(132);
  readonly height = input<number>(30);
  readonly ariaLabel = input<string>('Recent trend');

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
