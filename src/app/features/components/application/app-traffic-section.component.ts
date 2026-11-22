import { Component, computed, inject, input, effect, signal } from '@angular/core';

import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideActivity, lucideInfo } from '@ng-icons/lucide';
import {
  DEFAULT_CHART_COLORS,
  TimeSeriesChartConfig,
  TimeSeriesChartData,
} from '../../../shared/components/charts';
import { ApplicationTrafficService } from '../../service/application-traffic.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlMetric, FlMetricStrip } from '../../../ui/patterns/metric-strip';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { AppMonitoringChart } from './app-monitoring-chart';
import { breakdownOf } from './traffic-breakdown';

export interface TrafficRange {
  start: Date;
  end: Date;
  step: string;
}

const CHART_HEIGHT = '260px';

interface TrafficMetric {
  readonly label: string;
  readonly value: string;
}

@Component({
  selector: 'app-traffic-section',
  standalone: true,
  imports: [
    RouterLink,
    FlAlert,
    FlEmptyState,
    FlIcon,
    FlMetric,
    FlMetricStrip,
    FlPanel,
    FlStatus,
    FlTable,
    AppMonitoringChart,
  ],
  providers: [provideIcons({ lucideActivity, lucideInfo })],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Traffic">
      <a
        panelActions
        class="fl-link text-fl-body-sm"
        [routerLink]="['../logs']"
        [queryParams]="logsQueryParams()"
        >View logs</a
      >
      @if (traffic.error(); as err) {
        <fl-alert tone="error" title="Traffic could not be read">{{ err }}</fl-alert>
      } @else if (current() && !current()!.is_routable) {
        <fl-empty-state
          icon="lucideActivity"
          title="Not exposed through the ingress"
          body="This application has no public HTTP route, so there is no edge traffic to measure."
          [compact]="true"
        />
      } @else {
        <div class="flex flex-col gap-3">
          <p class="m-0 fl-muted text-fl-body-sm">
            HTTP requests measured at the ingress, no instrumentation required.
          </p>
          <fl-metric-strip data-testid="traffic-summary">
            @for (metric of metrics(); track metric.label) {
              <fl-metric [label]="metric.label" [value]="metric.value" />
            }
          </fl-metric-strip>
          @if (latencyIsCoarse()) {
            <p
              class="m-0 fl-row fl-muted text-fl-body-sm"
              data-testid="latency-coarse"
              [title]="coarseHint()"
            >
              <fl-icon name="lucideInfo" [size]="14" />
              Percentiles are rough here: trust the mean.
            </p>
          }
        </div>
      }
    </fl-panel>

    @if (!traffic.error() && (!current() || current()!.is_routable)) {
      <div class="fl-grid-2">
        <app-monitoring-chart
          title="Request rate"
          caption="requests per second"
          [data]="requestRateChart()"
          [config]="requestRateConfig"
        />
        <app-monitoring-chart
          title="Errors"
          caption="4xx and 5xx per second"
          [data]="errorChart()"
          [config]="errorConfig"
        />
        <app-monitoring-chart
          title="Latency"
          caption="p95"
          [data]="latencyChart()"
          [config]="latencyConfig"
        />
      </div>

      @if (statusView() || methodView()) {
        <div class="fl-grid-2">
          @if (statusView(); as view) {
            <fl-panel title="Status codes" [flush]="true" data-testid="traffic-status-codes">
              @if (view.hidden > 0 || showAllCodes()) {
                <button
                  panelActions
                  type="button"
                  class="fl-link text-fl-body-sm"
                  (click)="showAllCodes.set(!showAllCodes())"
                >
                  {{
                    showAllCodes()
                      ? 'Show fewer'
                      : 'Show all (' + (view.rows.length + view.hidden) + ')'
                  }}
                </button>
              }
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col" class="is-num">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  @for (entry of view.rows; track entry.code) {
                    <tr>
                      <td><fl-status [tone]="codeTone(entry.code)" [label]="entry.code" /></td>
                      <td class="is-num">{{ formatRate(entry.requests_per_second) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </fl-panel>
          }

          @if (methodView(); as view) {
            <fl-panel title="Methods" [flush]="true" data-testid="traffic-methods">
              @if (view.hidden > 0 || showAllMethods()) {
                <button
                  panelActions
                  type="button"
                  class="fl-link text-fl-body-sm"
                  (click)="showAllMethods.set(!showAllMethods())"
                >
                  {{
                    showAllMethods()
                      ? 'Show fewer'
                      : 'Show all (' + (view.rows.length + view.hidden) + ')'
                  }}
                </button>
              }
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">Method</th>
                    <th scope="col" class="is-num">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  @for (entry of view.rows; track entry.method) {
                    <tr>
                      <td class="fl-mono">{{ entry.method }}</td>
                      <td class="is-num">{{ formatRate(entry.requests_per_second) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </fl-panel>
          }
        </div>
      }
    }
  `,
})
export class AppTrafficSectionComponent {
  readonly appId = input.required<string>();
  readonly range = input.required<TrafficRange>();

  protected readonly traffic = inject(ApplicationTrafficService);

  protected readonly current = this.traffic.current;
  protected readonly history = this.traffic.history;

  constructor() {
    effect(() => {
      const id = this.appId();
      const range = this.range();
      if (id) {
        void this.traffic.load(id, range);
      }
    });
  }

  readonly requestRateConfig: TimeSeriesChartConfig = {
    unit: ' req/s',
    height: CHART_HEIGHT,
    showGrid: true,
    showLegend: false,
    showTitle: false,
    valueFormatter: (v: number) => this.formatRate(v),
  };

  readonly errorConfig: TimeSeriesChartConfig = {
    unit: ' req/s',
    height: CHART_HEIGHT,
    showGrid: true,
    showLegend: true,
    showTitle: false,
    valueFormatter: (v: number) => this.formatRate(v),
  };

  readonly latencyConfig: TimeSeriesChartConfig = {
    unit: 's',
    height: CHART_HEIGHT,
    showGrid: true,
    showLegend: false,
    showTitle: false,
    valueFormatter: (v: number) => this.formatDuration(v),
  };

  protected readonly logsQueryParams = computed(() => {
    const range = this.range();
    return {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    };
  });

  protected readonly latencyIsCoarse = computed(
    () => this.current()?.traffic.latency.estimates_are_coarse ?? false,
  );

  protected readonly coarseHint = computed(() => {
    const boundaries = this.current()?.traffic.latency.bucket_boundaries_seconds ?? [];
    const buckets = boundaries.map((b) => `${b}s`).join(', ');
    return `The latency histogram only has buckets at ${buckets}, which cannot resolve this application.`;
  });

  protected readonly byStatusCode = computed(() => this.current()?.traffic.by_status_code ?? []);

  protected readonly byMethod = computed(() => this.current()?.traffic.by_method ?? []);

  protected readonly showAllCodes = signal(false);
  protected readonly showAllMethods = signal(false);
  protected readonly statusView = computed(() =>
    this.byStatusCode().length ? breakdownOf(this.byStatusCode(), this.showAllCodes()) : null,
  );
  protected readonly methodView = computed(() =>
    this.byMethod().length ? breakdownOf(this.byMethod(), this.showAllMethods()) : null,
  );

  protected readonly metrics = computed<TrafficMetric[]>(() => {
    const traffic = this.current()?.traffic;
    const rate = traffic?.rate;
    const status = traffic?.status;
    const latency = traffic?.latency;
    return [
      { label: 'Request rate', value: this.formatRate(rate?.requests_per_second ?? null) },
      {
        label: `Requests in ${this.current()?.window ?? '5m'}`,
        value: String(Math.round(rate?.requests_in_window ?? 0)),
      },
      { label: 'Server 5xx', value: this.formatPercent(status?.server_error_percent ?? null) },
      { label: 'Client 4xx', value: this.formatPercent(status?.client_error_percent ?? null) },
      { label: 'Mean latency', value: this.formatDuration(latency?.mean_seconds ?? null) },
      {
        label: latency?.estimates_are_coarse ? 'p95 latency (rough)' : 'p95 latency',
        value: this.formatDuration(latency?.p95_seconds ?? null),
      },
    ];
  });

  protected readonly requestRateChart = computed<TimeSeriesChartData>(() => ({
    title: 'Request Rate',
    series: [
      {
        name: 'Requests',
        data: this.history()
          .filter((p) => p.requests_per_second != null)
          .map((p) => ({
            timestamp: new Date(p.timestamp),
            value: p.requests_per_second!,
          })),
        smooth: true,
      },
    ],
  }));

  protected readonly errorChart = computed<TimeSeriesChartData>(() => ({
    title: 'Errors',
    series: [
      {
        name: 'Client 4xx',
        data: this.history()
          .filter((p) => p.rate_4xx != null)
          .map((p) => ({ timestamp: new Date(p.timestamp), value: p.rate_4xx! })),
        smooth: true,
        color: DEFAULT_CHART_COLORS.warning[0],
      },
      {
        name: 'Server 5xx',
        data: this.history()
          .filter((p) => p.rate_5xx != null)
          .map((p) => ({ timestamp: new Date(p.timestamp), value: p.rate_5xx! })),
        smooth: true,
        color: DEFAULT_CHART_COLORS.danger[0],
      },
    ],
  }));

  protected readonly latencyChart = computed<TimeSeriesChartData>(() => ({
    title: 'Latency p95',
    series: [
      {
        name: 'p95',
        data: this.history()
          .filter((p) => p.p95_seconds != null)
          .map((p) => ({ timestamp: new Date(p.timestamp), value: p.p95_seconds! })),
        smooth: true,
      },
    ],
  }));

  protected codeTone(code: string): StatusTone {
    if (/^5\d{2}$/.test(code)) return 'error';
    if (/^4\d{2}$/.test(code)) return 'warning';
    if (/^2\d{2}$/.test(code)) return 'success';
    return 'neutral';
  }

  protected formatRate(value: number | null): string {
    if (value === null || value === undefined) return '—';
    if (value === 0) return '0 req/s';
    if (value < 0.01) return '<0.01 req/s';
    return `${value.toFixed(2)} req/s`;
  }

  protected formatDuration(value: number | null): string {
    if (value === null || value === undefined) return '—';
    if (value < 1) return `${(value * 1000).toFixed(0)} ms`;
    return `${value.toFixed(2)} s`;
  }

  protected formatPercent(value: number | null): string {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(2)}%`;
  }
}
