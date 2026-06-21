import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideX } from '@ng-icons/lucide';
import { CreateSnapshotRequest } from '../../model/volume-management.models';

@Component({
  selector: 'app-snapshot-create-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIconComponent],
  providers: [provideIcons({ lucideX, lucideLoader })],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="cancelled.emit()">
        <div class="bg-background rounded-lg border border-border shadow-xl max-w-md w-full p-6" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-lg font-semibold">Create snapshot</h3>
              <p class="text-xs text-muted-foreground mt-1">
                Captures the current data of this application's volume.
              </p>
            </div>
            <button (click)="cancelled.emit()" class="p-1 hover:bg-muted rounded">
              <ng-icon name="lucideX" class="h-4 w-4" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium mb-1 block" for="snapshot-description">Description (optional)</label>
              <input
                id="snapshot-description"
                type="text"
                [ngModel]="description()"
                (ngModelChange)="description.set($event)"
                placeholder="e.g. before-major-upgrade"
                maxlength="120"
                class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block" for="snapshot-pvc">PVC name (optional)</label>
              <input
                id="snapshot-pvc"
                type="text"
                [ngModel]="pvcName()"
                (ngModelChange)="pvcName.set($event)"
                placeholder="leave empty if the app has a single volume"
                class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono text-xs"
              />
            </div>
          </div>

          <div class="flex items-center gap-2 mt-6">
            <button
              (click)="cancelled.emit()"
              class="flex-1 px-4 py-2 border border-border rounded-md hover:bg-muted text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              (click)="onSubmit()"
              [disabled]="creating()"
              class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors disabled:opacity-50"
            >
              @if (creating()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                Creating…
              } @else {
                Create
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class SnapshotCreateDialogComponent {
  readonly open = input(false);
  readonly creating = input(false);

  readonly submitRequest = output<CreateSnapshotRequest>();
  readonly cancelled = output<void>();

  readonly description = signal('');
  readonly pvcName = signal('');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.description.set('');
        this.pvcName.set('');
      }
    });
  }

  onSubmit(): void {
    const description = this.description().trim();
    const volumeName = this.pvcName().trim();
    this.submitRequest.emit({
      description: description || undefined,
      volumeName: volumeName || undefined,
    });
  }
}
