import { Component, computed, inject, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideExternalLink,
  lucideGlobe,
  lucideInfo,
} from '@ng-icons/lucide';
import {
  MultiStatCardComponent,
  MultiStatCardData,
  TimeSeriesChartConfig,
  TimeSeriesChartData,
  TimeSeriesLineComponent,
} from '../../../shared/components/charts';
import { ApplicationTrafficService } from '../../service/application-traffic.service';

export interface TrafficRange {
  start: Date;
  end: Date;
  step: string;
}

@Component({
  selector: 'app-traffic-section',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NgIconComponent,
    TimeSeriesLineComponent,
    MultiStatCardComponent,
  ],
  providers: [
    provideIcons({
      lucideActivity,
      lucideExternalLink,
      lucideGlobe,
      lucideInfo,
    }),
  ],
  template: `
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ng-icon name="lucideGlobe" class="text-blue-500" size="20" />
            Traffic
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            HTTP requests measured at the ingress — no instrumentation required
          </p>
        </div>
        <a
          [routerLink]="['../logs']"
          [queryParams]="logsQueryParams()"
          class="shrink-0 inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          View logs
          <ng-icon name="lucideExternalLink" size="14" />
        </a>
      </div>

      @if (traffic.error(); as err) {
        <div
          class="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300"
        >
          {{ err }}
        </div>
      } @else if (current() && !current()!.is_routable) {
        <div
          class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6 text-center"
        >
          <ng-icon
            name="lucideActivity"
            class="text-gray-400 mx-auto mb-2"
            size="24"
          />
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Not exposed through the ingress
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            This application has no public HTTP route, so there is no edge traffic to
            measure.
          </p>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <app-multi-stat-card [data]="requestStats()" />
          <app-multi-stat-card [data]="errorStats()" />
          <app-multi-stat-card [data]="latencyStats()" />
        </div>

        @if (latencyIsCoarse()) {
          <div
            class="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 flex items-start gap-2"
          >
            <ng-icon
              name="lucideInfo"
              class="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
              size="16"
            />
            <p class="text-sm text-amber-800 dark:text-amber-200">
              Percentiles are rough estimates. The latency histogram only has buckets at
              {{ bucketLabel() }}, which cannot resolve this application — trust the mean
              until the buckets are tuned.
            </p>
          </div>
        }

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <app-time-series-line
            [data]="requestRateChart()"
            [config]="requestRateConfig"
          />
          <app-time-series-line [data]="errorChart()" [config]="errorConfig" />
        </div>

        <app-time-series-line [data]="latencyChart()" [config]="latencyConfig" />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @if (byStatusCode().length > 0) {
            <div
              class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
            >
              <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Status codes
              </h4>
              <div class="space-y-1.5">
                @for (entry of byStatusCode(); track entry.code) {
                  <div class="flex items-center justify-between text-sm">
                    <span class="flex items-center gap-2">
                      <span
                        class="inline-block w-2 h-2 rounded-full"
                        [class]="codeDot(entry.code)"
                      ></span>
                      <span class="font-mono text-gray-700 dark:text-gray-300">{{
                        entry.code
                      }}</span>
                    </span>
                    <span class="text-gray-500 dark:text-gray-400">
                      {{ formatRate(entry.requests_per_second) }}
                    </span>
                  </div>
                }
              </div>
            </div>
          }

          @if (byMethod().length > 0) {
            <div
              class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
            >
              <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Methods
              </h4>
              <div class="space-y-1.5">
                @for (entry of byMethod(); track entry.method) {
                  <div class="flex items-center justify-between text-sm">
                    <span class="font-mono text-gray-700 dark:text-gray-300">{{
                      entry.method
                    }}</span>
                    <span class="text-gray-500 dark:text-gray-400">
                      {{ formatRate(entry.requests_per_second) }}
                    </span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
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
    height: '260px',
    showGrid: true,
    showLegend: false,
    valueFormatter: (v: number) => this.formatRate(v),
  };

  readonly errorConfig: TimeSeriesChartConfig = {
    unit: ' req/s',
    height: '260px',
    showGrid: true,
    showLegend: true,
    valueFormatter: (v: number) => this.formatRate(v),
  };

  readonly latencyConfig: TimeSeriesChartConfig = {
    unit: 's',
    height: '260px',
    showGrid: true,
    showLegend: false,
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

  protected readonly bucketLabel = computed(() => {
    const boundaries =
      this.current()?.traffic.latency.bucket_boundaries_seconds ?? [];
    return boundaries.map((b) => `${b}s`).join(', ');
  });

  protected readonly byStatusCode = computed(
    () => this.current()?.traffic.by_status_code ?? [],
  );

  protected readonly byMethod = computed(
    () => this.current()?.traffic.by_method ?? [],
  );

  protected readonly requestStats = computed<MultiStatCardData>(() => {
    const rate = this.current()?.traffic.rate;
    return {
      title: 'Requests',
      stats: [
        {
          label: 'Rate',
          value: this.formatRate(rate?.requests_per_second ?? null),
          severity: 'info',
        },
        {
          label: `In ${this.current()?.window ?? '5m'}`,
          value: String(Math.round(rate?.requests_in_window ?? 0)),
          severity: 'info',
        },
      ],
    };
  });

  protected readonly errorStats = computed<MultiStatCardData>(() => {
    const status = this.current()?.traffic.status;
    const server = status?.server_error_percent ?? null;
    const client = status?.client_error_percent ?? null;
    return {
      title: 'Errors',
      stats: [
        {
          label: 'Server 5xx',
          value: this.formatPercent(server),
          severity: this.errorSeverity(server),
        },
        {
          label: 'Client 4xx',
          value: this.formatPercent(client),
          severity: client !== null && client > 0 ? 'warning' : 'success',
        },
      ],
    };
  });

  protected readonly latencyStats = computed<MultiStatCardData>(() => {
    const latency = this.current()?.traffic.latency;
    return {
      title: 'Latency',
      stats: [
        {
          label: 'Mean',
          value: this.formatDuration(latency?.mean_seconds ?? null),
          severity: 'info',
        },
        {
          label: latency?.estimates_are_coarse ? 'p95 (rough)' : 'p95',
          value: this.formatDuration(latency?.p95_seconds ?? null),
          severity: 'info',
        },
      ],
    };
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
        color: '#3b82f6',
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
        color: '#f59e0b',
      },
      {
        name: 'Server 5xx',
        data: this.history()
          .filter((p) => p.rate_5xx != null)
          .map((p) => ({ timestamp: new Date(p.timestamp), value: p.rate_5xx! })),
        smooth: true,
        color: '#ef4444',
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
        color: '#8b5cf6',
      },
    ],
  }));

  protected codeDot(code: string): string {
    if (/^5\d{2}$/.test(code)) return 'bg-red-500';
    if (/^4\d{2}$/.test(code)) return 'bg-amber-500';
    if (/^2\d{2}$/.test(code)) return 'bg-emerald-500';
    if (/^3\d{2}$/.test(code)) return 'bg-blue-500';
    return 'bg-gray-400';
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

  private errorSeverity(value: number | null): 'success' | 'warning' | 'danger' {
    if (value === null || value === 0) return 'success';
    return value >= 5 ? 'danger' : 'warning';
  }
}
