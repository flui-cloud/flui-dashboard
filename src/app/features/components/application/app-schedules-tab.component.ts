import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideClock,
  lucideLoader,
  lucidePlay,
  lucidePlus,
  lucideRefreshCw,
  lucideTrash2,
} from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import { ApplicationCronService } from '../../service/application-cron.service';
import {
  CronConcurrencyPolicy,
  ScheduledJob,
  ScheduledJobRun,
} from '../../model/scheduled-job.models';

@Component({
  selector: 'app-schedules-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideClock,
      lucidePlus,
      lucidePlay,
      lucideTrash2,
      lucideRefreshCw,
      lucideLoader,
      lucideCircleAlert,
    }),
  ],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Scheduled jobs</h2>
          <p class="text-sm text-muted-foreground">
            Run a command on this app's image + env on a cron schedule.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted"
            (click)="refresh()"
          >
            <ng-icon name="lucideRefreshCw" class="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            (click)="openCreate()"
          >
            <ng-icon name="lucidePlus" class="h-4 w-4" />
            New schedule
          </button>
        </div>
      </div>

      @if (error()) {
        <div
          class="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300"
        >
          <ng-icon name="lucideCircleAlert" class="h-4 w-4 mt-0.5" />
          <span>{{ error() }}</span>
        </div>
      }

      @if (loading()) {
        <div class="card-inner p-4 space-y-2">
          <div class="skeleton h-6 w-full"></div>
          <div class="skeleton h-6 w-full"></div>
        </div>
      } @else if (jobs().length === 0) {
        <div class="card-inner p-8 text-center">
          <ng-icon
            name="lucideClock"
            class="h-8 w-8 mx-auto text-muted-foreground"
          />
          <p class="mt-2 text-sm font-medium">No schedules yet</p>
          <p class="text-sm text-muted-foreground">
            Create one to run a recurring command against this application.
          </p>
        </div>
      } @else {
        <div class="card-inner overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr
                class="text-left text-muted-foreground border-b border-border"
              >
                <th class="py-2 px-3 font-medium">Name</th>
                <th class="py-2 px-3 font-medium">Schedule</th>
                <th class="py-2 px-3 font-medium">Command</th>
                <th class="py-2 px-3 font-medium">State</th>
                <th class="py-2 px-3 font-medium">Last run</th>
                <th class="py-2 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (job of jobs(); track job.name) {
                <tr class="border-b border-border/60">
                  <td class="py-2 px-3 font-medium">{{ job.name }}</td>
                  <td class="py-2 px-3">
                    <code class="text-xs">{{ job.schedule }}</code>
                    @if (job.timezone) {
                      <span class="text-xs text-muted-foreground">
                        · {{ job.timezone }}</span
                      >
                    }
                  </td>
                  <td
                    class="py-2 px-3 max-w-[240px] truncate text-muted-foreground"
                    [title]="job.command"
                  >
                    {{ job.command }}
                  </td>
                  <td class="py-2 px-3">
                    <span
                      class="text-xs px-2 py-0.5 rounded-full"
                      [class]="
                        job.enabled
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      "
                    >
                      {{ job.enabled ? 'enabled' : 'suspended' }}
                    </span>
                  </td>
                  <td class="py-2 px-3 text-xs text-muted-foreground">
                    {{ formatDate(job.lastScheduleTime) }}
                  </td>
                  <td class="py-2 px-3">
                    <div class="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        class="p-1.5 rounded-md hover:bg-muted"
                        title="Run now"
                        (click)="trigger(job)"
                      >
                        <ng-icon name="lucidePlay" class="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        class="px-2 py-1 text-xs rounded-md hover:bg-muted"
                        (click)="openRuns(job)"
                      >
                        Runs
                      </button>
                      <button
                        type="button"
                        class="px-2 py-1 text-xs rounded-md hover:bg-muted"
                        (click)="openEdit(job)"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="px-2 py-1 text-xs rounded-md hover:bg-muted"
                        (click)="toggle(job)"
                      >
                        {{ job.enabled ? 'Suspend' : 'Enable' }}
                      </button>
                      <button
                        type="button"
                        class="p-1.5 rounded-md hover:bg-muted text-red-600"
                        title="Delete"
                        (click)="confirmDelete(job)"
                      >
                        <ng-icon name="lucideTrash2" class="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- Create dialog -->
    @if (createOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div
          class="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6 space-y-4"
        >
          <h3 class="text-base font-semibold">
            {{ editingName() ? 'Edit scheduled job' : 'New scheduled job' }}
          </h3>

          <label class="block space-y-1">
            <span class="text-sm font-medium">Name</span>
            <input
              class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-60"
              placeholder="nightly-cleanup"
              [disabled]="!!editingName()"
              [ngModel]="fName()"
              (ngModelChange)="fName.set($event)"
            />
            @if (editingName()) {
              <span class="text-xs text-muted-foreground">
                The name identifies the schedule and cannot be changed.
              </span>
            }
          </label>

          <label class="block space-y-1">
            <span class="text-sm font-medium">Schedule (cron)</span>
            <input
              class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono"
              placeholder="0 3 * * *"
              [ngModel]="fSchedule()"
              (ngModelChange)="fSchedule.set($event)"
            />
            <span class="text-xs text-muted-foreground">
              5 fields: minute hour day month weekday.
            </span>
          </label>

          <label class="block space-y-1">
            <span class="text-sm font-medium">Command</span>
            <input
              class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono"
              placeholder="node dist/cleanup.js"
              [ngModel]="fCommand()"
              (ngModelChange)="fCommand.set($event)"
            />
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="block space-y-1">
              <span class="text-sm font-medium">Timezone</span>
              <input
                class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                placeholder="Europe/Rome"
                [ngModel]="fTimezone()"
                (ngModelChange)="fTimezone.set($event)"
              />
            </label>
            <label class="block space-y-1">
              <span class="text-sm font-medium">Overlap</span>
              <select
                class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                [ngModel]="fConcurrency()"
                (ngModelChange)="fConcurrency.set($event)"
              >
                <option value="Forbid">Forbid (skip)</option>
                <option value="Allow">Allow</option>
                <option value="Replace">Replace</option>
              </select>
            </label>
          </div>

          @if (formError()) {
            <p class="text-sm text-red-600">{{ formError() }}</p>
          }

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted"
              (click)="closeCreate()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              [disabled]="saving()"
              (click)="submitCreate()"
            >
              @if (saving()) {
                <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
              }
              {{ editingName() ? 'Save' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete confirm -->
    @if (pendingDelete()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div
          class="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6 space-y-4"
        >
          <h3 class="text-base font-semibold">Delete schedule</h3>
          <p class="text-sm text-muted-foreground">
            Delete "{{ pendingDelete()?.name }}"? Running jobs are not
            interrupted, but no further runs will be scheduled.
          </p>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted"
              (click)="pendingDelete.set(null)"
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
              (click)="executeDelete()"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Runs panel -->
    @if (runsFor()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div
          class="bg-background rounded-lg border border-border shadow-xl max-w-2xl w-full p-6 space-y-4"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold">
              Runs · {{ runsFor()?.name }}
            </h3>
            <button
              type="button"
              class="px-3 py-1 text-sm border border-border rounded-md hover:bg-muted"
              (click)="closeRuns()"
            >
              Close
            </button>
          </div>

          @if (runsLoading()) {
            <div class="space-y-2">
              <div class="skeleton h-6 w-full"></div>
              <div class="skeleton h-6 w-full"></div>
            </div>
          } @else if (runs().length === 0) {
            <p class="text-sm text-muted-foreground">No runs yet.</p>
          } @else {
            <div class="overflow-x-auto max-h-80 overflow-y-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr
                    class="text-left text-muted-foreground border-b border-border"
                  >
                    <th class="py-2 px-3 font-medium">Run</th>
                    <th class="py-2 px-3 font-medium">Status</th>
                    <th class="py-2 px-3 font-medium">Trigger</th>
                    <th class="py-2 px-3 font-medium">Started</th>
                    <th class="py-2 px-3 font-medium text-right">Logs</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of runs(); track r.jobName) {
                    <tr class="border-b border-border/60">
                      <td class="py-2 px-3 font-mono text-xs">
                        {{ r.jobName }}
                      </td>
                      <td class="py-2 px-3">
                        <span
                          class="text-xs px-2 py-0.5 rounded-full"
                          [class]="runStatusClass(r)"
                          >{{ r.status }}</span
                        >
                      </td>
                      <td class="py-2 px-3 text-xs">
                        {{ r.manual ? 'manual' : 'cron' }}
                      </td>
                      <td class="py-2 px-3 text-xs text-muted-foreground">
                        {{ formatDate(r.startTime) }}
                      </td>
                      <td class="py-2 px-3 text-right">
                        <button
                          type="button"
                          class="px-2 py-1 text-xs rounded-md hover:bg-muted"
                          (click)="viewRunLogs(r)"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @if (runLogs()) {
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-mono text-muted-foreground">
                  {{ runLogs()?.jobName }}
                </span>
                <button
                  type="button"
                  class="text-xs text-muted-foreground hover:underline"
                  (click)="runLogs.set(null)"
                >
                  Hide
                </button>
              </div>
              @if (runLogsLoading()) {
                <div class="skeleton h-24 w-full"></div>
              } @else {
                <pre
                  class="max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap"
                >{{ runLogs()?.logs || '(no logs — the run pod may be gone or empty)' }}</pre>
              }
            </div>
          }
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
  readonly runLogs = signal<{ jobName: string; logs: string } | null>(null);
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
    const logs = await this.cronService.runLogs(id, job.name, run.jobName);
    this.runLogs.set({ jobName: run.jobName, logs });
    this.runLogsLoading.set(false);
  }

  closeRuns(): void {
    this.runsFor.set(null);
    this.runs.set([]);
    this.runLogs.set(null);
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }

  runStatusClass(run: ScheduledJobRun): string {
    switch (run.status) {
      case 'Succeeded':
        return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
      case 'Failed':
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      case 'Running':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }
}
