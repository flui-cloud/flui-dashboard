import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlTable } from '../../../../ui/patterns/table';
import { FlStatus } from '../../../../ui/primitives/status';
import { BackupHealthBadgeComponent } from '../shared/health-badge.component';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { PolicyRow } from './policies-list-rows';

@Component({
  selector: 'app-policies-list-table',
  imports: [RouterLink, FlTable, FlStatus, BackupHealthBadgeComponent, BackupStatusBadgeComponent],
  host: { class: 'block' },
  template: `
    <div class="fl-table-wrap">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">Policy</th>
            <th scope="col">Cluster</th>
            <th scope="col">Scope</th>
            <th scope="col">Schedule</th>
            <th scope="col">Retention</th>
            <th scope="col">Destination</th>
            <th scope="col">Health</th>
            <th scope="col">Last run</th>
            <th scope="col">Next run</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.id) {
            <tr>
              <td class="fl-cell-name">
                <span class="flex flex-col gap-0.5">
                  <a class="fl-link" [routerLink]="['/management/backup/policies', r.id]">{{
                    r.name
                  }}</a>
                  <span class="text-fl-caption text-fl-ink-muted">{{ r.engine }}</span>
                </span>
              </td>
              <td>{{ r.cluster }}</td>
              <td>{{ r.scope }}</td>
              <td>
                <span class="flex flex-col gap-0.5">
                  <span>{{ r.schedule }}</span>
                  @if (r.cron) {
                    <span class="fl-mono text-fl-ink-muted" [attr.title]="r.cron + ' (UTC)'">{{
                      r.cron
                    }}</span>
                  }
                </span>
              </td>
              <td>{{ r.retention }}</td>
              <td>
                {{ r.destination }}
                @if (r.replicas) {
                  <span class="text-fl-ink-muted">
                    +{{ r.replicas }} {{ r.replicas === 1 ? 'replica' : 'replicas' }}</span
                  >
                }
              </td>
              <td>
                @if (r.health; as h) {
                  <app-backup-health-badge [state]="h.state" [detail]="h.detail" />
                } @else {
                  <span class="text-fl-ink-muted">{{ activityLoaded() ? '—' : '…' }}</span>
                }
              </td>
              <td>
                @if (r.lastRun; as l) {
                  <span class="flex flex-col gap-0.5" [attr.title]="l.title">
                    <fl-status [tone]="l.tone" [label]="l.label" />
                    <span class="text-fl-caption text-fl-ink-muted">{{ l.when }}</span>
                  </span>
                } @else if (r.health) {
                  <span class="text-fl-ink-muted">No run yet</span>
                } @else {
                  <span class="text-fl-ink-muted">—</span>
                }
              </td>
              <td class="text-fl-ink-muted" [attr.title]="r.nextRun.title">{{ r.nextRun.text }}</td>
              <td><app-backup-status-badge kind="policy" [value]="r.status" /></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class PoliciesListTable {
  readonly rows = input.required<readonly PolicyRow[]>();
  readonly activityLoaded = input(false);
}
