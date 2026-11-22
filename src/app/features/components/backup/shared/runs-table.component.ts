import { Component, computed, input, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideLock,
  lucideLockOpen,
} from '@ng-icons/lucide';

import { FlAlert } from '../../../../ui/patterns/alert';
import { FlTable } from '../../../../ui/patterns/table';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlStatus } from '../../../../ui/primitives/status';
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
import { backupBadgeTone, runStoredTone } from './backup-tones';

@Component({
  selector: 'app-backup-runs-table',
  imports: [FlTable, FlStatus, FlIcon, FlAlert],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight, lucideLock, lucideLockOpen })],
  host: { class: 'block' },
  template: `
    <div class="fl-table-wrap">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">When</th>
            @if (!compact()) {
              <th scope="col">Trigger</th>
            }
            <th scope="col">Status</th>
            @if (!compact()) {
              <th scope="col" class="is-num">Duration</th>
            }
            <th scope="col" class="is-num">Size</th>
            <th scope="col" class="is-fit"><span class="fl-sr">Encryption</span></th>
            @if (!compact()) {
              <th scope="col">Stored</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (run of rows(); track run.jobId) {
            <tr>
              <td [attr.title]="hoverTime(run)">
                @if (!compact() && run.errorMessage) {
                  <button
                    type="button"
                    class="fl-link inline-flex items-center gap-1"
                    [attr.aria-expanded]="expanded() === run.jobId"
                    [attr.aria-label]="relative(runTime(run)) + ', show error'"
                    (click)="toggle(run)"
                  >
                    <fl-icon
                      [name]="expanded() === run.jobId ? 'lucideChevronDown' : 'lucideChevronRight'"
                      [size]="14"
                    />
                    {{ relative(runTime(run)) }}
                  </button>
                } @else {
                  {{ relative(runTime(run)) }}
                }
              </td>
              @if (!compact()) {
                <td class="text-fl-ink-muted">{{ trigger(run.trigger) }}</td>
              }
              <td [attr.title]="compact() ? run.errorMessage : null">
                <fl-status [tone]="statusTone(run.status)" [label]="status(run.status).label" />
              </td>
              @if (!compact()) {
                <td class="is-num text-fl-ink-muted">{{ duration(run.durationSeconds) }}</td>
              }
              <td class="is-num text-fl-ink-muted">{{ size(run.sizeBytes) }}</td>
              <td class="is-fit text-fl-ink-muted" [attr.title]="lock(run.encrypted).label">
                @if (lock(run.encrypted).icon; as icon) {
                  <span
                    class="inline-flex"
                    role="img"
                    [attr.aria-label]="lock(run.encrypted).label"
                  >
                    <fl-icon [name]="icon" [size]="14" />
                  </span>
                } @else {
                  <span [attr.aria-label]="lock(run.encrypted).label">—</span>
                }
              </td>
              @if (!compact()) {
                <td>
                  @if (producedNothing(run)) {
                    <span class="text-fl-ink-muted" aria-label="Nothing stored">—</span>
                  } @else {
                    <span
                      class="inline-flex"
                      [attr.title]="run.expiresAt ? 'Expires ' + absolute(run.expiresAt) : null"
                    >
                      <fl-status
                        [tone]="storedTone(run.stored)"
                        [label]="stored(run.stored).label"
                      />
                    </span>
                  }
                </td>
              }
            </tr>
            @if (!compact() && run.errorMessage && expanded() === run.jobId) {
              <tr>
                <td [attr.colspan]="7" class="whitespace-normal">
                  <fl-alert tone="error" title="Run failed">{{ run.errorMessage }}</fl-alert>
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
  protected readonly statusTone = (status: string) => backupBadgeTone('job', status);
  protected readonly storedTone = runStoredTone;
  protected readonly producedNothing = (run: BackupRun): boolean =>
    run.stored === 'unknown' && (run.status === 'failed' || run.status === 'cancelled');
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
