import { Component, computed, input, output } from '@angular/core';
import { FlTable } from '../../../ui/patterns/table';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { ScheduledJob } from '../../model/scheduled-job.models';
import { untilTime } from './app-recap-view';
import { describeCron, nextCronRun } from './cron-text';

export function lastRunState(job: ScheduledJob): { tone: StatusTone; label: string } {
  if (job.activeRuns > 0) return { tone: 'progress', label: 'Running' };
  if (job.failing) return { tone: 'error', label: 'Failing' };
  switch (job.lastRunStatus) {
    case 'Succeeded':
      return { tone: 'success', label: 'Succeeded' };
    case 'Failed':
      return { tone: 'error', label: 'Failed' };
    case 'Running':
      return { tone: 'progress', label: 'Running' };
  }
  return job.lastScheduleTime
    ? { tone: 'neutral', label: 'No result' }
    : { tone: 'neutral', label: 'Never run' };
}

function nextRunLabel(job: ScheduledJob, next: Date | null, now: number): string {
  if (!job.enabled) return 'Suspended';
  return next ? untilTime(next.toISOString(), now) : '—';
}

export function localTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

@Component({
  selector: 'app-schedule-jobs-table',
  imports: [FlTable, FlActionsMenu, FlStatus, FlButton],
  host: { class: 'block' },
  template: `
    <div class="fl-table-wrap" data-testid="schedules-table">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Schedule</th>
            <th scope="col">Last run</th>
            <th scope="col">Next run</th>
            <th scope="col">Enabled</th>
            <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.job.name) {
            @let job = row.job;
            <tr [class.is-selected]="selected() === job.name">
              <td>
                <div class="font-medium">{{ job.name }}</div>
                <div class="fl-mono fl-cell-clip text-fl-ink-muted" [title]="job.command">
                  {{ job.command }}
                </div>
                @if (job.origin === 'manifest') {
                  <div class="text-fl-caption text-fl-ink-muted">From flui.yaml</div>
                }
                @if (job.onCluster === false) {
                  <div
                    class="text-fl-caption text-fl-ink-muted"
                    title="Recorded by Flui; the next release or a run puts it back on the cluster."
                  >
                    Not on the cluster yet
                  </div>
                }
              </td>
              <td>
                <div class="fl-mono">{{ job.schedule }}</div>
                <div class="text-fl-caption text-fl-ink-muted">
                  {{ row.description }}{{ job.timezone ? ' · ' + job.timezone : '' }}
                </div>
              </td>
              <td>
                <fl-status
                  [tone]="row.last.tone"
                  [label]="row.last.label"
                  [title]="
                    job.failing ? 'The last ' + job.consecutiveFailures + ' runs failed' : ''
                  "
                />
                <div class="text-fl-caption text-fl-ink-muted">{{ row.lastAt }}</div>
              </td>
              <td [title]="row.nextTitle">{{ row.next }}</td>
              <td>
                <label
                  class="fl-check"
                  [title]="job.origin === 'manifest' ? 'Changed in flui.yaml' : ''"
                >
                  <input
                    type="checkbox"
                    [checked]="job.enabled"
                    [disabled]="job.origin === 'manifest'"
                    [attr.aria-label]="(job.enabled ? 'Suspend ' : 'Enable ') + job.name"
                    (change)="onToggle(job, $event)"
                  />
                  {{ job.enabled ? 'Enabled' : 'Suspended' }}
                </label>
              </td>
              <td class="is-fit">
                <div class="fl-row flex-nowrap justify-end">
                  <button flButton size="sm" type="button" (click)="runNow.emit(job)">
                    Run now
                  </button>
                  <fl-actions-menu
                    [compact]="true"
                    [label]="'Actions for ' + job.name"
                    [items]="row.menu"
                    (action)="onAction(job, $event)"
                  />
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class ScheduleJobsTable {
  readonly jobs = input.required<readonly ScheduledJob[]>();
  readonly selected = input<string | null>(null);
  readonly runNow = output<ScheduledJob>();
  readonly runs = output<ScheduledJob>();
  readonly edit = output<ScheduledJob>();
  readonly toggled = output<ScheduledJob>();
  readonly remove = output<ScheduledJob>();

  protected readonly rows = computed(() => {
    const now = Date.now();
    return this.jobs().map((job) => {
      const next = job.enabled ? nextCronRun(job.schedule, job.timezone, now) : null;
      const menu: MenuAction[] = [{ id: 'runs', label: 'Run history' }];
      if (job.origin !== 'manifest') {
        menu.push(
          { id: 'edit', label: 'Edit' },
          { id: 'delete', label: 'Delete', danger: true, separatorBefore: true },
        );
      }
      return {
        job,
        description: describeCron(job.schedule),
        last: lastRunState(job),
        lastAt: localTime(job.lastScheduleTime),
        next: nextRunLabel(job, next, now),
        nextTitle: next ? next.toLocaleString() : '',
        menu,
      };
    });
  });

  protected onToggle(job: ScheduledJob, event: Event): void {
    (event.target as HTMLInputElement).checked = job.enabled;
    this.toggled.emit(job);
  }

  protected onAction(job: ScheduledJob, id: string): void {
    if (id === 'runs') this.runs.emit(job);
    else if (id === 'edit') this.edit.emit(job);
    else if (id === 'delete') this.remove.emit(job);
  }
}
