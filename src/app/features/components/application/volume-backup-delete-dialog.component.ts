import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideTrash2 } from '@ng-icons/lucide';
import { VolumeBackup } from '../../model/volume-backup.models';
import { formatDate } from './snapshot-format';

@Component({
  selector: 'app-volume-backup-delete-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideLoader, lucideTrash2 })],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      (click)="dismissed.emit()"
    >
      <div
        class="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6 space-y-4"
        (click)="$event.stopPropagation()"
      >
        <h3 class="text-lg font-semibold">Delete backup</h3>
        <p class="text-sm text-muted-foreground">
          The backup of {{ taken() }}
          ({{ backup().volumeName || 'volume' }}) is removed from backup storage and
          cannot be restored afterwards.
        </p>
        @if (error(); as e) {
          <p class="text-sm text-red-600">{{ e }}</p>
        }
        <div class="flex items-center gap-2">
          <button
            (click)="dismissed.emit()"
            class="flex-1 px-4 py-2 border border-border rounded-md hover:bg-muted text-sm"
          >
            Cancel
          </button>
          <button
            (click)="confirm.emit()"
            [disabled]="working()"
            class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm disabled:opacity-50"
          >
            <ng-icon
              [name]="working() ? 'lucideLoader' : 'lucideTrash2'"
              class="h-3.5 w-3.5"
              [class.animate-spin]="working()"
            />
            Delete
          </button>
        </div>
      </div>
    </div>
  `,
})
export class VolumeBackupDeleteDialogComponent {
  readonly backup = input.required<VolumeBackup>();
  readonly working = input(false);
  readonly error = input<string | null>(null);

  readonly confirm = output<void>();
  readonly dismissed = output<void>();

  protected readonly taken = computed(() => {
    const at = this.backup().createdAt;
    return at ? formatDate(at) : '—';
  });
}
