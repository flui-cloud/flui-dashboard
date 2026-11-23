import { Component, computed, input } from '@angular/core';
import {
  TimeSeriesChartConfig,
  TimeSeriesChartData,
  TimeSeriesLineComponent,
} from '../../../shared/components/charts';
import { MailVolumePoint } from '../../model/mail-console.models';
import { bucketLabel } from './mail-format';

@Component({
  selector: 'app-mail-volume-chart',
  imports: [TimeSeriesLineComponent],
  host: { class: 'block' },
  template: `<app-time-series-line [data]="data()" [config]="config()" />`,
})
export class MailVolumeChartComponent {
  readonly points = input.required<MailVolumePoint[]>();
  readonly bucket = input<'hour' | 'day'>('day');

  protected readonly data = computed<TimeSeriesChartData>(() => {
    const points = this.points();
    const series = (name: string, pick: (p: MailVolumePoint) => number) => ({
      name,
      data: points.map((p) => ({ timestamp: new Date(p.at), value: pick(p) })),
    });
    return {
      title: 'Volume by outcome',
      series: [
        series('Delivered', (p) => p.delivered),
        series('Failed', (p) => p.failed),
        series('Pending', (p) => p.pending),
      ],
    };
  });

  protected readonly config = computed<TimeSeriesChartConfig>(() => {
    const bucket = this.bucket();
    return {
      height: '220px',
      showGrid: true,
      showLegend: true,
      showTitle: false,
      enableZoom: false,
      yMin: 0,
      valueFormatter: (value) => value.toLocaleString('en-GB'),
      timeFormatter: (at) => bucketLabel(at.toISOString(), bucket),
    };
  });
}
