import { Component, computed, input, output } from '@angular/core';
import { BackupPolicy } from '../../../model/backup.models';
import { BackupPolicyActivity } from '../../../model/backup-run.models';
import {
  formatLocalDateTime,
  formatRelativeTime,
  formatUtcDateTime,
} from '../../../model/backup-activity';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlLoadingState } from '../../../../ui/patterns/states';
import { FlButton } from '../../../../ui/primitives/button';
import { BackupHealthBadgeComponent } from '../shared/health-badge.component';
import { scheduleView } from './policy-text';

@Component({
  selector: 'app-policy-detail-schedule',
  imports: [
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlPanel,
    FlLoadingState,
    FlButton,
    BackupHealthBadgeComponent,
  ],
  host: { class: 'block' },
  template: `
    <fl-panel title="Schedule">
      <ng-container panelActions>
        @if (activity(); as a) {
          <app-backup-health-badge [state]="a.health.state" [detail]="a.health.detail" />
        }
      </ng-container>
      @if (activity(); as a) {
        <div class="flex flex-col gap-4">
          <fl-key-value>
            <fl-kv-item key="Runs">
              <span class="flex flex-col gap-0.5">
                <span>{{ schedule().text }}</span>
                @if (schedule().cron; as cron) {
                  <span class="fl-mono text-fl-ink-muted"
                    >{{ cron }} ({{ a.schedule.timezone }})</span
                  >
                }
              </span>
            </fl-kv-item>
            <fl-kv-item key="Next run">
              @if (a.schedule.nextRunAt; as next) {
                <span class="flex flex-col gap-0.5" [attr.title]="utc(next)">
                  <span>{{ relative(next) }}</span>
                  <span class="text-fl-caption text-fl-ink-muted">{{ local(next) }}</span>
                </span>
              } @else {
                <span class="text-fl-ink-muted">—</span>
              }
            </fl-kv-item>
            <fl-kv-item key="Last success">
              @if (a.health.lastSuccessAt; as last) {
                <span [attr.title]="local(last) + ' (' + utc(last) + ')'">{{
                  relative(last)
                }}</span>
              } @else {
                <span class="text-fl-ink-muted">Never</span>
              }
            </fl-kv-item>
          </fl-key-value>
          @if (a.health.detail) {
            <p class="m-0 text-fl-body-sm text-fl-ink-muted">{{ a.health.detail }}</p>
          }
        </div>
      } @else if (loading()) {
        <fl-loading-state [rows]="2" />
      } @else {
        <div class="flex flex-col gap-3">
          <fl-key-value>
            <fl-kv-item key="Runs">
              <span class="flex flex-col gap-0.5">
                <span>{{ schedule().text }}</span>
                @if (schedule().cron; as cron) {
                  <span class="fl-mono text-fl-ink-muted">{{ cron }} (UTC)</span>
                }
              </span>
            </fl-kv-item>
          </fl-key-value>
          @if (failed()) {
            <fl-alert tone="error" title="Could not load the schedule and run history">
              <button alertActions flButton size="sm" type="button" (click)="retry.emit()">
                Try again
              </button>
            </fl-alert>
          }
        </div>
      }
    </fl-panel>
  `,
})
export class PolicyDetailSchedule {
  readonly policy = input.required<BackupPolicy>();
  readonly activity = input<BackupPolicyActivity | null>(null);
  readonly loading = input(false);
  readonly failed = input(false);
  readonly retry = output<void>();

  protected readonly schedule = computed(() =>
    scheduleView(this.policy().cronSchedule, this.activity()),
  );
  protected readonly relative = (iso: string) => formatRelativeTime(iso);
  protected readonly local = formatLocalDateTime;
  protected readonly utc = formatUtcDateTime;
}
