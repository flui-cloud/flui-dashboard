import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideTrash2 } from '@ng-icons/lucide';
import { ApplicationSnapshot } from '../../model/volume-management.models';

@Component({
  selector: 'app-snapshot-delete-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideLoader, lucideTrash2 })],
  template: `
    @if (snapshot(); as snap) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="cancelled.emit()">
        <div class="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-semibold">Delete snapshot</h3>
          <p class="text-sm text-muted-foreground mt-2">
            This will permanently remove the snapshot.
            <span class="block mt-1 text-xs font-mono">{{ snap.exportId }}</span>
          </p>
          <div class="flex items-center gap-2 mt-6">
            <button
              (click)="cancelled.emit()"
              class="flex-1 px-4 py-2 border border-border rounded-md hover:bg-muted text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              (click)="execute.emit()"
              [disabled]="deleting()"
              class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm transition-colors disabled:opacity-50"
            >
              @if (deleting()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                Deleting…
              } @else {
                <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
                Delete
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class SnapshotDeleteDialogComponent {
  readonly snapshot = input<ApplicationSnapshot | null>(null);
  readonly deleting = input(false);

  readonly execute = output<void>();
  readonly cancelled = output<void>();
}
