import { Component, computed, effect, inject, input, ChangeDetectionStrategy } from '@angular/core';

import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideBell,
  lucideCircleCheck,
  lucideCircleAlert,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { ApplicationAlertsService } from '../../service/application-alerts.service';
import { AlertEvent } from '../../model/alert.models';

@Component({
  selector: 'app-alerts-section',
  standalone: true,
  imports: [NgIconComponent],
  providers: [
    provideIcons({
      lucideBell,
      lucideCircleCheck,
      lucideCircleAlert,
      lucideTriangleAlert,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3
            class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"
          >
            <ng-icon name="lucideBell" class="text-blue-500" size="20" />
            Alerts
            @if (firing() > 0) {
              <span
                class="inline-flex items-center rounded-full bg-red-100 dark:bg-red-950/60 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300"
              >
                {{ firing() }} firing
              </span>
            }
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            One row per episode — repeats update the row, they do not stack
          </p>
        </div>
      </div>

      @if (alerts.error(); as err) {
        <div
          class="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300"
        >
          {{ err }}
        </div>
      } @else if (alerts.loading() && rows().length === 0) {
        <div
          class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          Loading alerts…
        </div>
      } @else if (rows().length === 0) {
        <div
          class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6 text-center"
        >
          <ng-icon
            name="lucideCircleCheck"
            class="text-emerald-500 mx-auto mb-2"
            size="24"
          />
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
            No alerts on record
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Nothing has fired for this application. Absence of alerts is not the same as
            a health check — see Traffic for a live read.
          </p>
        </div>
      } @else {
        <ul class="space-y-2">
          @for (alert of rows(); track alert.id) {
            <li
              class="rounded-lg border p-3 flex items-start gap-3"
              [class]="rowClass(alert)"
            >
              <ng-icon
                [name]="rowIcon(alert)"
                [class]="rowIconClass(alert)"
                class="shrink-0 mt-0.5"
                size="18"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {{ alert.alertname }}
                  </span>
                  <span [class]="badgeClass(alert)">{{ statusLabel(alert) }}</span>
                  <span [class]="severityClass(alert)">{{ alert.severity }}</span>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                  {{ alert.summary }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ timing(alert) }}
                </p>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class AppAlertsSectionComponent {
  readonly appId = input.required<string>();
  readonly refreshKey = input<number>(0);

  protected readonly alerts = inject(ApplicationAlertsService);
  protected readonly firing = this.alerts.firing;
  protected readonly rows = computed(() => this.alerts.alerts());

  constructor() {
    effect(() => {
      const id = this.appId();
      this.refreshKey();
      if (id) {
        void this.alerts.load(id);
      }
    });
  }

  protected rowClass(alert: AlertEvent): string {
    return alert.status === 'firing'
      ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30'
      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800';
  }

  protected rowIcon(alert: AlertEvent): string {
    if (alert.status === 'resolved') return 'lucideCircleCheck';
    return alert.severity === 'critical'
      ? 'lucideCircleAlert'
      : 'lucideTriangleAlert';
  }

  protected rowIconClass(alert: AlertEvent): string {
    if (alert.status === 'resolved') return 'text-emerald-500';
    return alert.severity === 'critical' ? 'text-red-500' : 'text-amber-500';
  }

  protected badgeClass(alert: AlertEvent): string {
    const base =
      'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium';
    return alert.status === 'firing'
      ? `${base} bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300`
      : `${base} bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300`;
  }

  protected severityClass(alert: AlertEvent): string {
    const base = 'inline-flex items-center rounded px-1.5 py-0.5 text-xs';
    if (alert.severity === 'critical') {
      return `${base} bg-red-100/70 dark:bg-red-950/40 text-red-600 dark:text-red-400`;
    }
    if (alert.severity === 'warning') {
      return `${base} bg-amber-100/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400`;
    }
    return `${base} bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300`;
  }

  protected statusLabel(alert: AlertEvent): string {
    if (alert.status === 'firing') return 'firing';
    return alert.resolved_by === 'timeout' ? 'resolved*' : 'resolved';
  }

  protected timing(alert: AlertEvent): string {
    const started = new Date(alert.starts_at).toLocaleString();
    if (alert.status === 'firing') {
      return `Started ${started}`;
    }
    const ended = alert.ends_at
      ? new Date(alert.ends_at).toLocaleString()
      : 'unknown';
    if (alert.resolved_by === 'timeout') {
      return `${started} → ${ended} · stopped reporting, end time approximate`;
    }
    return `${started} → ${ended}`;
  }
}
