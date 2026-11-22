import { Component, computed, effect, inject, input } from '@angular/core';

import { provideIcons } from '@ng-icons/core';
import { lucideCircleCheck } from '@ng-icons/lucide';
import { ApplicationAlertsService } from '../../service/application-alerts.service';
import { AlertEvent } from '../../model/alert.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

@Component({
  selector: 'app-alerts-section',
  standalone: true,
  imports: [FlPanel, FlTable, FlStatus, FlAlert, FlEmptyState, FlLoadingState],
  providers: [provideIcons({ lucideCircleCheck })],
  host: { class: 'block' },
  template: `
    <fl-panel title="Alerts" [count]="rows().length || null" [flush]="true">
      <div panelActions class="fl-row">
        @if (firing() > 0) {
          <fl-status tone="error" [label]="firing() + ' firing'" />
        }
        <span class="fl-toolbar__info">One row per episode; repeats update it</span>
      </div>
      @if (alerts.error(); as err) {
        <div class="fl-panel__body">
          <fl-alert tone="error" title="Alerts could not be read">{{ err }}</fl-alert>
        </div>
      } @else if (alerts.loading() && rows().length === 0) {
        <fl-loading-state [rows]="3" />
      } @else if (rows().length === 0) {
        <fl-empty-state
          icon="lucideCircleCheck"
          title="No alerts on record"
          body="Nothing has fired for this application. No alerts is not the same as a health check: see Traffic for a live read."
          [compact]="true"
        />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Alert</th>
                <th scope="col">Status</th>
                <th scope="col">Severity</th>
                <th scope="col">Summary</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              @for (alert of rows(); track alert.id) {
                <tr>
                  <td class="font-medium">{{ alert.alertname }}</td>
                  <td><fl-status [tone]="tone(alert)" [label]="statusLabel(alert)" /></td>
                  <td class="fl-muted">{{ alert.severity }}</td>
                  <td class="whitespace-normal">{{ alert.summary }}</td>
                  <td class="fl-muted fl-num whitespace-normal">{{ timing(alert) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
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

  protected tone(alert: AlertEvent): StatusTone {
    if (alert.status === 'resolved') return 'neutral';
    return alert.severity === 'critical' ? 'error' : 'warning';
  }

  protected statusLabel(alert: AlertEvent): string {
    if (alert.status === 'firing') return 'Firing';
    return alert.resolved_by === 'timeout' ? 'Resolved*' : 'Resolved';
  }

  protected timing(alert: AlertEvent): string {
    const started = new Date(alert.starts_at).toLocaleString();
    if (alert.status === 'firing') {
      return `Started ${started}`;
    }
    const ended = alert.ends_at ? new Date(alert.ends_at).toLocaleString() : 'unknown';
    if (alert.resolved_by === 'timeout') {
      return `${started} → ${ended} · stopped reporting, end time approximate`;
    }
    return `${started} → ${ended}`;
  }
}
