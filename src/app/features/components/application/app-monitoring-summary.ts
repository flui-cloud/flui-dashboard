import { Component, computed, input } from '@angular/core';
import { FlMetric, FlMetricStrip } from '../../../ui/patterns/metric-strip';
import { FlStatus } from '../../../ui/primitives/status';
import type { MonitoringMetric } from './app-monitoring-metrics';

@Component({
  selector: 'app-monitoring-summary',
  imports: [FlMetricStrip, FlMetric, FlStatus],
  host: { class: 'flex flex-col gap-3' },
  template: `
    <fl-metric-strip data-testid="app-metrics-summary">
      @for (metric of metrics(); track metric.label) {
        <fl-metric
          data-testid="app-metric"
          [attr.data-metric]="metric.label"
          [attr.title]="metric.hint ?? null"
          [label]="metric.label"
          [value]="metric.value"
          [caption]="metric.caption"
        />
      }
    </fl-metric-strip>
    @if (notes().length) {
      <ul class="m-0 flex list-none flex-col gap-1 p-0" data-testid="app-metric-notes">
        @for (note of notes(); track note.metric + note.text) {
          <li
            class="fl-row"
            data-testid="stat-tile-note"
            [attr.data-metric]="note.metric"
            [attr.title]="note.hint ?? null"
          >
            <span class="fl-muted text-fl-body-sm">{{ note.metric }}</span>
            <fl-status [tone]="note.tone" [label]="note.text" />
          </li>
        }
      </ul>
    }
  `,
})
export class AppMonitoringSummary {
  readonly metrics = input.required<readonly MonitoringMetric[]>();

  protected readonly notes = computed(() =>
    this.metrics().flatMap((metric) =>
      metric.notes.map((note) => ({ ...note, metric: metric.label })),
    ),
  );
}
