import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackupService } from '../../../service/backup.service';

@Component({
  selector: 'app-backup-progress-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (op(); as o) {
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">
            {{ title() }}
          </h3>
          @if (o.status !== 'running') {
          <button
            type="button"
            class="text-sm text-muted-foreground hover:text-foreground"
            (click)="onClose()"
          >
            Close
          </button>
          }
        </div>

        <div class="space-y-3">
          <div>
            <div class="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{{ o.message || 'In progress…' }}</span>
              <span>{{ o.percentage }}%</span>
            </div>
            <div class="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                class="h-full transition-all"
                [class]="barClass()"
                [style.width.%]="o.percentage"
              ></div>
            </div>
          </div>

          @if (o.currentStep) {
          <p class="text-xs text-muted-foreground">
            Step {{ o.currentStep }}
          </p>
          } @if (o.status === 'failed' && o.error) {
          <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {{ o.error }}
          </div>
          } @if (o.status === 'completed') {
          <div class="rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
            Completed successfully.
          </div>
          }
        </div>
      </div>
    </div>
    }
  `,
})
export class BackupProgressModalComponent {
  private readonly backup = inject(BackupService);

  readonly operationId = input.required<string | null>();
  readonly title = input<string>('Backup operation');
  readonly closed = output<void>();

  readonly op = computed(() => {
    const id = this.operationId();
    if (!id) return null;
    return this.backup.activeOperations()[id] ?? null;
  });

  readonly barClass = computed(() => {
    const o = this.op();
    if (!o) return 'bg-blue-500';
    if (o.status === 'failed') return 'bg-red-500';
    if (o.status === 'completed') return 'bg-green-500';
    return 'bg-blue-500';
  });

  onClose(): void {
    const id = this.operationId();
    if (id) this.backup.clearOperation(id);
    this.closed.emit();
  }
}
