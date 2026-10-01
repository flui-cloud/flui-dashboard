import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideFolderOpen,
  lucideLoader,
  lucideLock,
  lucideRotateCcw,
  lucideTrash2,
} from '@ng-icons/lucide';
import {
  VolumeBackup,
  backupTriggerLabel,
  backupTriggerTitle,
  bytesOrDash,
} from '../../model/volume-backup.models';
import { formatDate } from './snapshot-format';

@Component({
  selector: 'app-volume-backups-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent],
  providers: [
    provideIcons({
      lucideFolderOpen,
      lucideLoader,
      lucideLock,
      lucideRotateCcw,
      lucideTrash2,
    }),
  ],
  template: `
    <div class="card-inner overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-muted-foreground border-b border-border">
            <th class="px-4 py-3 font-normal">Taken</th>
            <th class="px-4 py-3 font-normal">Volume</th>
            <th class="px-4 py-3 font-normal">Trigger</th>
            <th class="px-4 py-3 font-normal text-right">Size</th>
            <th class="px-4 py-3 font-normal text-right">Added</th>
            <th class="px-4 py-3 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          @for (b of backups(); track b.id) {
            <tr
              class="border-b border-border/50 last:border-0 hover:bg-muted/30"
              [class.bg-muted]="browsingId() === b.id"
            >
              <td class="px-4 py-3 text-xs whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5">
                  @if (b.encrypted) {
                    <ng-icon
                      name="lucideLock"
                      class="h-3 w-3 text-emerald-600"
                      title="Encrypted"
                    />
                  }
                  {{ b.createdAt ? formatDate(b.createdAt) : '—' }}
                </span>
                @if (b.stored !== 'present') {
                  <div class="text-[11px] text-amber-600">
                    {{ b.reason ?? 'No longer stored' }}
                  </div>
                }
              </td>
              <td class="px-4 py-3 font-mono text-xs">
                {{ b.volumeName || '—' }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="text-xs px-2 py-0.5 rounded-full"
                  [class]="
                    b.kept === 'retention'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                  "
                  [title]="triggerTitle(b)"
                >
                  {{ triggerLabel(b) }}
                </span>
              </td>
              <td class="px-4 py-3 text-right whitespace-nowrap">
                {{ bytes(b.logicalBytes) }}
              </td>
              <td class="px-4 py-3 text-right whitespace-nowrap text-muted-foreground">
                {{ bytes(b.uploadedBytes) }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex items-center gap-1">
                  <button
                    (click)="browse.emit(b)"
                    [disabled]="!b.browsable"
                    class="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
                    [title]="b.browsable ? 'Browse files' : 'This backup can only be restored whole'"
                  >
                    <ng-icon name="lucideFolderOpen" class="h-3.5 w-3.5" />
                  </button>
                  <button
                    (click)="restore.emit(b)"
                    [disabled]="!b.restorable || busyIds().has(b.id)"
                    class="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors disabled:opacity-40"
                    [title]="b.restorable ? 'Restore whole backup' : (b.reason ?? 'Not restorable')"
                  >
                    <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" />
                  </button>
                  <button
                    (click)="remove.emit(b)"
                    [disabled]="busyIds().has(b.id)"
                    class="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors disabled:opacity-40"
                    title="Delete backup"
                  >
                    @if (deletingIds().has(b.id)) {
                      <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                    } @else {
                      <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
                    }
                  </button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class VolumeBackupsTableComponent {
  readonly backups = input.required<VolumeBackup[]>();
  readonly browsingId = input<string | null>(null);
  readonly busyIds = input<ReadonlySet<string>>(new Set());
  readonly deletingIds = input<ReadonlySet<string>>(new Set());

  readonly browse = output<VolumeBackup>();
  readonly restore = output<VolumeBackup>();
  readonly remove = output<VolumeBackup>();

  protected readonly formatDate = formatDate;
  protected readonly triggerLabel = backupTriggerLabel;
  protected readonly triggerTitle = backupTriggerTitle;
  protected readonly bytes = bytesOrDash;
}
