import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideClock, lucidePlus, lucideRefreshCw, lucideX } from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import { ApplicationCronService } from '../../service/application-cron.service';
import {
  CronConcurrencyPolicy,
  ScheduledJob,
  ScheduledJobRun,
} from '../../model/scheduled-job.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { ScheduleJobsTable } from './schedule-jobs-table';
import { ScheduleEditor } from './schedule-editor';
import { RunLogs, ScheduleRuns } from './schedule-runs';
import { FlDialogFocus } from '../../../ui/overlays/dialog-focus';

@Component({
  selector: 'app-schedules-tab',
  imports: [
    FlDialogFocus,
    FlPanel,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    ScheduleJobsTable,
    ScheduleEditor,
    ScheduleRuns,
  ],
  providers: [provideIcons({ lucideClock, lucidePlus, lucideRefreshCw, lucideX })],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel
      title="Scheduled jobs"
      [count]="jobs().length || null"
      [flush]="true"
      data-testid="schedules"
    >
      <div panelActions class="fl-row">
        <button flButton="ghost" size="sm" type="button" (click)="refresh()">
          <fl-icon name="lucideRefreshCw" [size]="14" />
          Refresh
        </button>
        <button flButton="primary" size="sm" type="button" (click)="openCreate()">
          <fl-icon name="lucidePlus" [size]="14" />
          New schedule
        </button>
      </div>

      <div class="flex flex-col gap-3 p-4">
        <p class="text-fl-body-sm text-fl-ink-muted">
          Run a command with this app's image and environment on a cron schedule.
        </p>
        @if (error()) {
          <fl-alert tone="error" title="Request failed">{{ error() }}</fl-alert>
        }
      </div>

      @if (loading()) {
        <fl-loading-state [rows]="2" />
      } @else if (jobs().length === 0) {
        <fl-empty-state
          class="border-t border-fl-border"
          icon="lucideClock"
          title="No schedules yet"
          body="Create one to run a recurring command against this application."
          [compact]="true"
        />
      } @else {
        <app-schedule-jobs-table
          class="border-t border-fl-border"
          [jobs]="jobs()"
          [selected]="runsFor()?.name ?? null"
          (runNow)="trigger($event)"
          (runs)="openRuns($event)"
          (edit)="openEdit($event)"
          (toggled)="toggle($event)"
          (remove)="confirmDelete($event)"
        />
      }
    </fl-panel>

    @if (runsFor(); as job) {
      <app-schedule-runs
        [jobName]="job.name"
        [runs]="runs()"
        [loading]="runsLoading()"
        [logs]="runLogs()"
        [logsLoading]="runLogsLoading()"
        (viewLogs)="viewRunLogs($event)"
        (hideLogs)="runLogs.set(null)"
        (closed)="closeRuns()"
      />
    }

    @if (createOpen()) {
      <app-schedule-editor
        [editing]="editingName()"
        [saving]="saving()"
        [error]="formError()"
        [(name)]="fName"
        [(schedule)]="fSchedule"
        [(command)]="fCommand"
        [(timezone)]="fTimezone"
        [(concurrency)]="fConcurrency"
        (saved)="submitCreate()"
        (cancelled)="closeCreate()"
      />
    }

    @if (pendingDelete(); as job) {
      <div class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          class="fl-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="schedule-delete-title"
          flDialogFocus
          (dismissed)="pendingDelete.set(null)"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="schedule-delete-title">Delete schedule</h2>
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              (click)="pendingDelete.set(null)"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>
          <div class="fl-dialog__body">
            <p>
              Delete "{{ job.name }}"? Running jobs are not interrupted, but no further runs will be
              scheduled.
            </p>
          </div>
          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" (click)="pendingDelete.set(null)">Cancel</button>
            <button flButton="danger" type="button" (click)="executeDelete()">Delete</button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class AppSchedulesTabComponent implements OnInit, OnDestroy {
  private readonly appService = inject(ApplicationService);
  private readonly cronService = inject(ApplicationCronService);

  readonly jobs = this.cronService.jobs;
  readonly loading = this.cronService.loading;
  readonly saving = this.cronService.saving;
  readonly error = this.cronService.error;

  readonly createOpen = signal(false);
  readonly editingName = signal<string | null>(null);
  readonly pendingDelete = signal<ScheduledJob | null>(null);
  readonly formError = signal<string | null>(null);

  readonly fName = signal('');
  readonly fSchedule = signal('');
  readonly fCommand = signal('');
  readonly fTimezone = signal('');
  readonly fConcurrency = signal<CronConcurrencyPolicy>('Forbid');

  readonly runsFor = signal<ScheduledJob | null>(null);
  readonly runs = signal<ScheduledJobRun[]>([]);
  readonly runsLoading = signal(false);
  readonly runLogs = signal<RunLogs | null>(null);
  readonly runLogsLoading = signal(false);

  private appId(): string | null {
    return this.appService.selectedApplication()?.id ?? null;
  }

  ngOnInit(): void {
    void (async () => {
      const id = this.appId();
      if (id) await this.cronService.loadForApp(id);
    })();
  }

  ngOnDestroy(): void {
    this.cronService.reset();
  }

  async refresh(): Promise<void> {
    const id = this.appId();
    if (id) await this.cronService.loadForApp(id);
  }

  openCreate(): void {
    this.formError.set(null);
    this.editingName.set(null);
    this.fName.set('');
    this.fSchedule.set('');
    this.fCommand.set('');
    this.fTimezone.set('');
    this.fConcurrency.set('Forbid');
    this.createOpen.set(true);
  }

  openEdit(job: ScheduledJob): void {
    this.formError.set(null);
    this.editingName.set(job.name);
    this.fName.set(job.name);
    this.fSchedule.set(job.schedule);
    this.fCommand.set(job.command);
    this.fTimezone.set(job.timezone ?? '');
    this.fConcurrency.set(job.concurrencyPolicy);
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  async submitCreate(): Promise<void> {
    const id = this.appId();
    if (!id) return;
    const name = this.fName().trim();
    const schedule = this.fSchedule().trim();
    const command = this.fCommand().trim();
    if (!name || !schedule || !command) {
      this.formError.set('Name, schedule and command are required.');
      return;
    }
    this.formError.set(null);
    const timezone = this.fTimezone().trim() || undefined;
    const editing = this.editingName();
    const result = editing
      ? await this.cronService.update(id, editing, {
          schedule,
          command,
          timezone,
          concurrencyPolicy: this.fConcurrency(),
        })
      : await this.cronService.create(id, {
          name,
          schedule,
          command,
          timezone,
          concurrencyPolicy: this.fConcurrency(),
        });
    if (result) this.createOpen.set(false);
  }

  async toggle(job: ScheduledJob): Promise<void> {
    const id = this.appId();
    if (id) await this.cronService.toggle(id, job);
  }

  async trigger(job: ScheduledJob): Promise<void> {
    const id = this.appId();
    if (id) await this.cronService.trigger(id, job.name);
  }

  confirmDelete(job: ScheduledJob): void {
    this.pendingDelete.set(job);
  }

  async executeDelete(): Promise<void> {
    const id = this.appId();
    const job = this.pendingDelete();
    if (!id || !job) return;
    const ok = await this.cronService.delete(id, job.name);
    if (ok) this.pendingDelete.set(null);
  }

  async openRuns(job: ScheduledJob): Promise<void> {
    const id = this.appId();
    if (!id) return;
    this.runsFor.set(job);
    this.runsLoading.set(true);
    this.runs.set([]);
    this.runLogs.set(null);
    this.runs.set(await this.cronService.listRuns(id, job.name));
    this.runsLoading.set(false);
  }

  async viewRunLogs(run: ScheduledJobRun): Promise<void> {
    const id = this.appId();
    const job = this.runsFor();
    if (!id || !job) return;
    this.runLogsLoading.set(true);
    this.runLogs.set({ jobName: run.jobName, logs: '' });
    const { logs, reason } = await this.cronService.runLogs(id, job.name, run.jobName);
    this.runLogs.set({ jobName: run.jobName, logs, reason });
    this.runLogsLoading.set(false);
  }

  closeRuns(): void {
    this.runsFor.set(null);
    this.runs.set([]);
    this.runLogs.set(null);
  }
}
