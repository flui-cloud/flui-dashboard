import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideX,
  lucideTrash,
  lucideLoader,
  lucideCircleCheck,
  lucideCircleAlert,
  lucideTriangleAlert,
} from '@ng-icons/lucide';

import { ClusterWorkersService } from '../../service/cluster-workers.service';
import { ToastService } from '../../../shared/services/toast.service';
import { OperationWarning, WorkerError } from '../../model/worker-operation.models';

@Component({
  selector: 'app-remove-worker-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  providers: [
    provideIcons({
      lucideX,
      lucideTrash,
      lucideLoader,
      lucideCircleCheck,
      lucideCircleAlert,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" (click)="onCancel()">
      <div class="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] p-4">
        <div class="card-surface p-5 space-y-4" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-2.5">
              <div class="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center">
                <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-foreground">Remove worker</h2>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Moves apps off the node and removes it from the provider.
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="onCancel()"
              class="text-muted-foreground hover:text-foreground p-1 rounded"
            >
              <ng-icon name="lucideX" class="h-4 w-4" />
            </button>
          </div>

          @if (phase() === 'configure') {
            <div class="rounded-md bg-muted px-3 py-2 text-sm">
              <p class="text-xs text-muted-foreground">You are about to remove:</p>
              <p class="font-mono font-semibold text-foreground mt-0.5">{{ workerName() }}</p>
            </div>

            <div class="rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
              <p class="font-medium">This action cannot be undone.</p>
              <p class="mt-0.5">
                Apps will be moved to other nodes when possible. Apps with strict availability
                rules may be stopped without a graceful shutdown.
              </p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs text-muted-foreground">
                Type <span class="font-mono text-foreground">{{ workerName() }}</span> to confirm:
              </label>
              <input
                type="text"
                [ngModel]="typed()"
                (ngModelChange)="typed.set($event)"
                class="w-full h-9 px-3 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:border-primary"
                placeholder="Worker name"
                autofocus
              />
            </div>

            @if (submitError(); as err) {
              <div class="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-800 dark:text-red-300">
                {{ err.message }}
              </div>
            }

            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                (click)="onCancel()"
                [disabled]="submitting()"
                class="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                (click)="onSubmit()"
                [disabled]="!canSubmit()"
                class="px-3 py-1.5 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                @if (submitting()) {
                  <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                  Starting…
                } @else {
                  <ng-icon name="lucideTrash" class="h-3.5 w-3.5" />
                  Remove worker
                }
              </button>
            </div>
          }

          @if (phase() === 'tracking' && tracking(); as t) {
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                @if (t.status === 'completed') {
                  <ng-icon name="lucideCircleCheck" class="h-5 w-5 text-green-600 dark:text-green-400" />
                  <p class="text-sm font-medium text-foreground">Worker removed.</p>
                } @else if (t.status === 'failed') {
                  <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-red-600 dark:text-red-400" />
                  <p class="text-sm font-medium text-foreground">Remove worker failed.</p>
                } @else {
                  <ng-icon name="lucideLoader" class="h-5 w-5 text-blue-600 animate-spin" />
                  <p class="text-sm font-medium text-foreground">Freeing up the node and removing it…</p>
                }
              </div>

              <div>
                <div class="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>
                    @if (t.status === 'completed') {
                      Done
                    } @else if (t.status === 'failed') {
                      Stopped
                    } @else if (t.totalSteps > 0) {
                      Step {{ t.currentStepIndex + 1 }}/{{ t.totalSteps }}
                    } @else {
                      Starting…
                    }
                  </span>
                  <span class="tabular-nums">{{ t.progress }}%</span>
                </div>
                <div class="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    class="h-full transition-all"
                    [class]="t.status === 'failed' ? 'bg-red-500' : t.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'"
                    [style.width.%]="t.progress"
                  ></div>
                </div>
                @if (t.stepDescription) {
                  <p class="text-xs text-muted-foreground mt-1.5">{{ t.stepDescription }}</p>
                }
              </div>

              @if (t.status === 'failed' && t.error) {
                <div class="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-800 dark:text-red-300">
                  {{ t.error }}
                </div>
              }

              <div class="flex justify-end pt-1">
                <button
                  type="button"
                  (click)="onCloseTracking()"
                  class="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted"
                >
                  {{ t.status === 'in_progress' ? 'Run in background' : 'Close' }}
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class RemoveWorkerDialogComponent {
  private readonly workersService = inject(ClusterWorkersService);
  private readonly toast = inject(ToastService);

  clusterId = input.required<string>();
  nodeId = input.required<string>();
  workerName = input.required<string>();

  closed = output<void>();

  protected phase = signal<'configure' | 'tracking'>('configure');
  protected typed = signal<string>('');
  protected submitting = signal<boolean>(false);
  protected submitError = signal<WorkerError | null>(null);

  private readonly operationId = signal<string | null>(null);
  private readonly warningsEmitted = signal<boolean>(false);

  protected tracking = computed(() => {
    const opId = this.operationId();
    return this.workersService.trackedStates()[opId ?? ''] ?? {
      operationId: null,
      clusterId: null,
      type: null,
      progress: 0,
      currentStepIndex: 0,
      totalSteps: 0,
      stepDescription: '',
      warnings: [] as OperationWarning[],
      status: 'pending' as const,
      error: null,
    };
  });

  protected canSubmit = computed(() =>
    !this.submitting() && this.typed().trim() === this.workerName()
  );

  constructor() {
    // Surface warnings as toasts as soon as the operation completes,
    // even if the user has already dismissed the dialog.
    effect(() => {
      const t = this.tracking();
      if (t.status !== 'completed' || this.warningsEmitted()) return;
      this.warningsEmitted.set(true);
      for (const w of t.warnings) {
        this.emitWarningToast(w);
      }
    });
  }

  async onSubmit(): Promise<void> {
    this.submitError.set(null);
    this.submitting.set(true);
    try {
      const env = await this.workersService.removeWorker(this.clusterId(), this.nodeId(), this.workerName());
      this.operationId.set(env.operationId);
      this.phase.set('tracking');
    } catch (err) {
      this.submitError.set(err as WorkerError);
    } finally {
      this.submitting.set(false);
    }
  }

  onCloseTracking(): void {
    const t = this.tracking();
    const opId = this.operationId();
    if (t.status === 'completed' && t.warnings.length === 0) {
      this.toast.showSuccess(`Worker ${this.workerName()} removed.`);
    }
    if (opId && (t.status === 'completed' || t.status === 'failed')) {
      this.workersService.clearTracking(opId);
    }
    this.closed.emit();
  }

  onCancel(): void {
    this.closed.emit();
  }

  private emitWarningToast(w: OperationWarning): void {
    switch (w.code) {
      case 'DRAIN_FAILED':
        this.toast.showWarning({
          title: 'Worker removed with warnings',
          message:
            'Could not move all apps off the node (availability rules or timeout). Some apps may have been stopped without a graceful shutdown — please verify them.',
          persistent: true,
        });
        break;
      case 'CORDON_FAILED':
        this.toast.showWarning({
          title: 'Worker removed with warnings',
          message: 'Could not stop new apps from being scheduled on the node before removal (master unreachable). Please verify your apps were rebalanced.',
          persistent: true,
        });
        break;
      case 'DRAIN_SKIPPED':
      case 'CORDON_SKIPPED':
        this.toast.showInfo({
          title: 'Worker removed',
          message: `${w.code === 'DRAIN_SKIPPED' ? 'App migration' : 'Node lockdown'} skipped: ${w.reason}`,
        });
        break;
    }
  }
}
