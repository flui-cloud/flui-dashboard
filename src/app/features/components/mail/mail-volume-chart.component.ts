import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  input,
  signal,
} from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { MailVolumePoint } from '../../model/mail-console.models';
import { bucketLabel } from './mail-format';

@Component({
  selector: 'app-mail-volume-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective],
  template: `
    <div echarts [options]="options()" [theme]="theme()" class="h-56 w-full"></div>
  `,
})
export class MailVolumeChartComponent implements OnDestroy {
  readonly points = input.required<MailVolumePoint[]>();
  readonly bucket = input<'hour' | 'day'>('day');

  private readonly dark = signal(isDark());
  private readonly observer: MutationObserver | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this.observer = new MutationObserver(() => this.dark.set(isDark()));
      this.observer.observe(document.documentElement, { attributeFilter: ['class'] });
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  protected readonly theme = computed(() => (this.dark() ? 'dark' : 'light'));

  protected readonly options = computed<EChartsOption>(() => {
    const points = this.points();
    const axis = points.map((p) => bucketLabel(p.at, this.bucket()));
    const ink = this.dark() ? '#898781' : '#6f6d66';
    const grid = this.dark() ? '#2c2c2a' : '#e4e2d8';

    return {
      backgroundColor: 'transparent',
      grid: { left: 40, right: 12, top: 24, bottom: 24 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: {
        right: 0,
        top: 0,
        icon: 'roundRect',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: ink, fontSize: 11 },
      },
      xAxis: {
        type: 'category',
        data: axis,
        axisLine: { lineStyle: { color: grid } },
        axisLabel: { color: ink, fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: grid } },
        axisLabel: { color: ink, fontSize: 11 },
      },
      series: [
        bar('Delivered', points.map((p) => p.delivered), this.dark() ? '#3987e5' : '#2f72c9'),
        bar('Failed', points.map((p) => p.failed), this.dark() ? '#d95926' : '#c04a1d'),
        bar('Pending', points.map((p) => p.pending), this.dark() ? '#4a4943' : '#c9c7bc'),
      ],
    };
  });
}

function bar(name: string, data: number[], colour: string) {
  return {
    name,
    type: 'bar' as const,
    stack: 'volume',
    data,
    itemStyle: { color: colour },
    barMaxWidth: 28,
  };
}

function isDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}
