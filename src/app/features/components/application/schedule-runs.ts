import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { ScheduledJobRun, ScheduledJobRunStatus } from '../../model/scheduled-job.models';
import { localTime } from './schedule-jobs-table';

export interface RunLogs {
  jobName: string;
  logs: string;
  reason?: string | null;
}

const RUN_TONE: Record<ScheduledJobRunStatus, StatusTone> = {
  Succeeded: 'success',
  Failed: 'error',
  Running: 'progress',
  Unknown: 'neutral',
};

@Component({
  selector: 'app-schedule-runs',
  imports: [FlPanel, FlTable, FlAlert, FlEmptyState, FlLoadingState, FlStatus, FlButton, FlIcon],
  providers: [provideIcons({ lucideX })],
  host: { class: 'block' },
  template: `
    <fl-panel [title]="'Run history of ' + jobName()" [flush]="true" data-testid="schedule-runs">
      <button
        panelActions
        flButton="ghost"
        size="sm"
        type="button"
        [iconOnly]="true"
        aria-label="Close"
        (click)="closed.emit()"
      >
        <fl-icon name="lucideX" />
      </button>

      @if (loading()) {
        <fl-loading-state [rows]="2" />
      } @else if (runs().length === 0) {
        <fl-empty-state title="No runs yet" [compact]="true" />
      } @else {
        <div class="fl-table-wrap max-h-80 overflow-y-auto">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Status</th>
                <th scope="col">Trigger</th>
                <th scope="col">Started</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Logs</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.run.jobName) {
                <tr [class.is-selected]="logs()?.jobName === row.run.jobName">
                  <td class="fl-mono">{{ row.run.jobName }}</td>
                  <td>
                    <fl-status [tone]="row.tone" [label]="row.run.status" />
                    @if (row.run.reason) {
                      <div class="text-fl-caption text-fl-ink-muted">{{ row.run.reason }}</div>
                    }
                  </td>
                  <td>{{ row.run.manual ? 'Manual' : 'Cron' }}</td>
                  <td class="fl-num text-fl-ink-muted">{{ row.started }}</td>
                  <td class="is-fit">
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      (click)="viewLogs.emit(row.run)"
                    >
                      Logs
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (logs(); as l) {
        <div class="flex flex-col gap-2 border-t border-fl-border p-4">
          <div class="flex items-center justify-between gap-2">
            <span class="fl-mono text-fl-ink-muted">{{ l.jobName }}</span>
            <button flButton="ghost" size="sm" type="button" (click)="hideLogs.emit()">Hide</button>
          </div>
          @if (logsLoading()) {
            <fl-loading-state [rows]="3" />
          } @else {
            @if (l.reason) {
              <fl-alert tone="error" title="Run failed">{{ l.reason }}</fl-alert>
            }
            <pre
              class="fl-mono max-h-64 overflow-auto whitespace-pre-wrap rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3"
              >{{ l.logs || '(the run printed nothing)' }}</pre>
          }
        </div>
      }
    </fl-panel>
  `,
})
export class ScheduleRuns {
  readonly jobName = input.required<string>();
  readonly runs = input.required<readonly ScheduledJobRun[]>();
  readonly loading = input(false);
  readonly logs = input<RunLogs | null>(null);
  readonly logsLoading = input(false);
  readonly viewLogs = output<ScheduledJobRun>();
  readonly hideLogs = output<void>();
  readonly closed = output<void>();

  protected readonly rows = computed(() =>
    this.runs().map((run) => ({
      run,
      tone: RUN_TONE[run.status] ?? 'neutral',
      started: localTime(run.startTime),
    })),
  );
}
