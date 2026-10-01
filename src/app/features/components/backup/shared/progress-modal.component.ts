import { Component, computed, effect, inject, input, output, ChangeDetectionStrategy } from '@angular/core';

import { BackupService } from '../../../service/backup.service';
import { ActiveOperation } from '../../../model/backup.models';

@Component({
  selector: 'app-backup-progress-modal',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (op(); as o) {
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg" role="dialog" aria-modal="true">
        <h3 class="mb-4 text-lg font-semibold">{{ title() }}</h3>

        <div class="space-y-3">
          <div>
            <div class="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{{ o.status === 'running' ? (o.message || 'In progress…') : '' }}</span>
              <span>{{ o.percentage }}%</span>
            </div>
            <div class="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div class="h-full transition-all" [class]="barClass()" [style.width.%]="o.percentage"></div>
            </div>
          </div>

          @if (o.status === 'running' && o.currentStep) {
          <p class="text-xs text-muted-foreground">Step {{ o.currentStep }}</p>
          }
          @if (o.status === 'failed') {
          <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400" data-testid="progress-failed">
            {{ o.error || 'It failed.' }}
          </div>
          } @else if (o.status === 'completed' && o.partial) {
          <div class="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400" data-testid="progress-partial">
            Finished, but not everything was backed up.
            @if (o.detail) {
            <span class="block mt-1">{{ o.detail }}</span>
            }
          </div>
          } @else if (o.status === 'completed') {
          <div class="rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400" data-testid="progress-completed">
            Completed successfully.
            @if (o.detail) {
            <span class="block mt-1 text-xs">{{ o.detail }}</span>
            }
          </div>
          }
        </div>

        <div class="mt-5 flex justify-end">
          <button
            type="button"
            class="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            data-testid="progress-close"
            (click)="onClose()"
          >
            {{ o.status === 'running' ? 'Keep running in background' : 'Close' }}
          </button>
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
  readonly settled = output<ActiveOperation>();

  private announced: string | null = null;

  readonly op = computed(() => {
    const id = this.operationId();
    if (!id) return null;
    return this.backup.activeOperations()[id] ?? null;
  });

  readonly barClass = computed(() => {
    const o = this.op();
    if (!o) return 'bg-blue-500';
    if (o.status === 'failed') return 'bg-red-500';
    if (o.status === 'completed') return o.partial ? 'bg-amber-500' : 'bg-green-500';
    return 'bg-blue-500';
  });

  constructor() {
    effect(() => {
      const o = this.op();
      if (!o || o.status === 'running' || this.announced === o.operationId) return;
      this.announced = o.operationId;
      this.settled.emit(o);
    });
  }

  onClose(): void {
    const id = this.operationId();
    this.closed.emit();
    if (id) this.backup.clearOperation(id);
  }
}
