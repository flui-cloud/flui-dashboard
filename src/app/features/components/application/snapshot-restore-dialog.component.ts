import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideRotateCcw } from '@ng-icons/lucide';
import { ApplicationSnapshot } from '../../model/volume-management.models';

@Component({
  selector: 'app-snapshot-restore-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideLoader, lucideRotateCcw })],
  template: `
    @if (snapshot(); as snap) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="cancelled.emit()">
        <div class="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-semibold">Restore snapshot</h3>
          <p class="text-sm text-muted-foreground mt-2">
            Creates a brand-new PVC with the data from this snapshot. Your live application is NOT affected.
            <span class="block mt-1 text-xs font-mono break-all">{{ snap.exportId }}</span>
          </p>
          <label class="flex items-start gap-2 mt-4 text-sm cursor-pointer">
            <input
              type="checkbox"
              [checked]="restoreAndSwap()"
              (change)="restoreAndSwap.set(!restoreAndSwap())"
              class="mt-0.5"
            />
            <span>
              Also swap the live application to the new PVC
              <span class="block text-xs text-muted-foreground mt-0.5">
                Triggers a rolling restart. The current PVC stays in the cluster as a backup.
              </span>
            </span>
          </label>
          <div class="flex items-center gap-2 mt-6">
            <button
              (click)="cancelled.emit()"
              [disabled]="restoring()"
              class="flex-1 px-4 py-2 border border-border rounded-md hover:bg-muted text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              (click)="execute.emit(restoreAndSwap())"
              [disabled]="restoring()"
              class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors disabled:opacity-50"
            >
              @if (restoring()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                {{ restoreAndSwap() ? 'Restoring & swapping…' : 'Restoring…' }}
              } @else {
                <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" />
                {{ restoreAndSwap() ? 'Restore & swap' : 'Restore' }}
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class SnapshotRestoreDialogComponent {
  readonly snapshot = input<ApplicationSnapshot | null>(null);
  readonly restoring = input(false);

  readonly execute = output<boolean>();
  readonly cancelled = output<void>();

  readonly restoreAndSwap = signal(false);

  constructor() {
    effect(() => {
      if (this.snapshot()) {
        this.restoreAndSwap.set(false);
      }
    });
  }
}
