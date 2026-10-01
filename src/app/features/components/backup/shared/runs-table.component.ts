import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight, lucideLock, lucideLockOpen } from '@ng-icons/lucide';

import { formatBytes } from '../../../model/backup.models';
import { runStatusBadge, runStoredBadge } from '../../../model/backup-badges';
import { BackupRun } from '../../../model/backup-run.models';
import {
  formatDuration,
  formatLocalDateTime,
  formatRelativeTime,
  formatUtcDateTime,
  runEncryptionMarker,
  runTime,
  runTriggerLabel,
  sortRunsNewestFirst,
} from '../../../model/backup-activity';

@Component({
  selector: 'app-backup-runs-table',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight, lucideLock, lucideLockOpen })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-xs text-muted-foreground">
          <tr class="border-b border-border">
            <th scope="col" class="px-2 py-1.5 text-left font-medium">When</th>
            @if (!compact()) {
            <th scope="col" class="px-2 py-1.5 text-left font-medium">Trigger</th>
            }
            <th scope="col" class="px-2 py-1.5 text-left font-medium">Status</th>
            @if (!compact()) {
            <th scope="col" class="px-2 py-1.5 text-left font-medium">Duration</th>
            }
            <th scope="col" class="px-2 py-1.5 text-right font-medium">Size</th>
            <th scope="col" class="px-2 py-1.5 text-center font-medium"><span class="sr-only">Encryption</span></th>
            @if (!compact()) {
            <th scope="col" class="px-2 py-1.5 text-left font-medium">Stored</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (run of rows(); track run.jobId) {
          <tr class="border-b border-border/60 last:border-0">
            <td class="px-2 py-1.5 whitespace-nowrap" [attr.title]="hoverTime(run)">
              @if (!compact() && run.errorMessage) {
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:underline"
                [attr.aria-expanded]="expanded() === run.jobId"
                [attr.aria-label]="relative(runTime(run)) + ', show error'"
                (click)="toggle(run)"
              >
                <ng-icon
                  [name]="expanded() === run.jobId ? 'lucideChevronDown' : 'lucideChevronRight'"
                  class="h-3 w-3 text-muted-foreground"
                />
                {{ relative(runTime(run)) }}
              </button>
              } @else {
              {{ relative(runTime(run)) }}
              }
            </td>
            @if (!compact()) {
            <td class="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{{ trigger(run.trigger) }}</td>
            }
            <td class="px-2 py-1.5">
              <span
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                [class]="status(run.status).classes"
                [attr.title]="compact() ? run.errorMessage : null"
              >
                {{ status(run.status).label }}
              </span>
            </td>
            @if (!compact()) {
            <td class="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{{ duration(run.durationSeconds) }}</td>
            }
            <td class="px-2 py-1.5 text-right text-muted-foreground whitespace-nowrap">{{ size(run.sizeBytes) }}</td>
            <td class="px-2 py-1.5 text-center" [attr.title]="lock(run.encrypted).label">
              @if (lock(run.encrypted).icon; as icon) {
              <ng-icon
                [name]="icon"
                class="h-3.5 w-3.5 align-middle"
                [class]="run.encrypted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'"
                role="img"
                [attr.aria-label]="lock(run.encrypted).label"
              />
              } @else {
              <span class="text-muted-foreground" [attr.aria-label]="lock(run.encrypted).label">—</span>
              }
            </td>
            @if (!compact()) {
            <td class="px-2 py-1.5">
              @if (producedNothing(run)) {
              <span class="text-muted-foreground" aria-label="Nothing stored">—</span>
              } @else {
              <span
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                [class]="stored(run.stored).classes"
                [attr.title]="run.expiresAt ? 'Expires ' + absolute(run.expiresAt) : null"
              >
                {{ stored(run.stored).label }}
              </span>
              }
            </td>
            }
          </tr>
          @if (!compact() && run.errorMessage && expanded() === run.jobId) {
          <tr class="border-b border-border/60">
            <td [attr.colspan]="7" class="px-2 pb-2">
              <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400 break-words">
                {{ run.errorMessage }}
              </div>
            </td>
          </tr>
          }
          }
        </tbody>
      </table>
    </div>
  `,
})
export class BackupRunsTableComponent {
  readonly runs = input.required<BackupRun[]>();
  readonly compact = input(false);
  readonly limit = input<number | null>(null);

  protected readonly expanded = signal<string | null>(null);

  protected readonly rows = computed(() => {
    const sorted = sortRunsNewestFirst(this.runs());
    const limit = this.limit();
    return limit ? sorted.slice(0, limit) : sorted;
  });

  protected readonly runTime = runTime;
  protected readonly relative = (iso: string | null) => formatRelativeTime(iso);
  protected readonly absolute = formatLocalDateTime;
  protected readonly trigger = runTriggerLabel;
  protected readonly status = runStatusBadge;
  protected readonly stored = runStoredBadge;
  protected readonly producedNothing = (run: BackupRun): boolean =>
    run.stored === 'unknown' &&
    (run.status === 'failed' || run.status === 'cancelled');
  protected readonly duration = formatDuration;
  protected readonly size = formatBytes;
  protected readonly lock = runEncryptionMarker;

  protected hoverTime(run: BackupRun): string | null {
    const iso = runTime(run);
    if (!iso) return null;
    return `${formatLocalDateTime(iso)} (${formatUtcDateTime(iso)})`;
  }

  protected toggle(run: BackupRun): void {
    this.expanded.update((id) => (id === run.jobId ? null : run.jobId));
  }
}
