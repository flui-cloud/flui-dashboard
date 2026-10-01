import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideRotateCcw } from '@ng-icons/lucide';
import { VolumeBackup } from '../../model/volume-backup.models';
import { RestoreTarget } from './volume-backup-browser.component';
import { formatDate } from './snapshot-format';

@Component({
  selector: 'app-volume-backup-restore-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIconComponent],
  providers: [provideIcons({ lucideLoader, lucideRotateCcw })],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      (click)="dismissed.emit()"
    >
      <div
        class="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6 space-y-4"
        (click)="$event.stopPropagation()"
      >
        <h3 class="text-lg font-semibold">Restore whole backup</h3>
        <p class="text-sm text-muted-foreground">
          The backup of {{ taken() }} is
          written into a new volume. The running app is not touched; switch to
          the new volume when you are ready.
        </p>
        <label class="block text-sm">
          <span class="text-xs text-muted-foreground">Restore into</span>
          <select
            [ngModel]="target()"
            (ngModelChange)="target.set($event)"
            class="mt-1 block w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">This app</option>
            @for (t of targets(); track t.id) {
              <option [value]="t.id">{{ t.name }}</option>
            }
          </select>
        </label>
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
            (click)="confirm.emit(target())"
            [disabled]="working()"
            class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            <ng-icon
              [name]="working() ? 'lucideLoader' : 'lucideRotateCcw'"
              class="h-3.5 w-3.5"
              [class.animate-spin]="working()"
            />
            Restore
          </button>
        </div>
      </div>
    </div>
  `,
})
export class VolumeBackupRestoreDialogComponent {
  readonly backup = input.required<VolumeBackup>();
  readonly targets = input<RestoreTarget[]>([]);
  readonly working = input(false);
  readonly error = input<string | null>(null);

  readonly confirm = output<string>();
  readonly dismissed = output<void>();

  protected readonly target = signal('');
  protected readonly taken = computed(() => {
    const at = this.backup().createdAt;
    return at ? formatDate(at) : '—';
  });
}
