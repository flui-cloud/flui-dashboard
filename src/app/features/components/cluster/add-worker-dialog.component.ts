import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideX,
  lucidePlus,
  lucideMinus,
  lucideLoader,
  lucideCircleCheck,
  lucideCircleAlert,
  lucideTriangleAlert,
} from '@ng-icons/lucide';

import { ClusterWorkersService } from '../../service/cluster-workers.service';
import { ToastService } from '../../../shared/services/toast.service';
import { WorkerError } from '../../model/worker-operation.models';

@Component({
  selector: 'app-add-worker-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  providers: [
    provideIcons({
      lucideX,
      lucidePlus,
      lucideMinus,
      lucideLoader,
      lucideCircleCheck,
      lucideCircleAlert,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" (click)="onCancel()">
      <div class="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] p-4">
        <div
          class="card-surface p-5 space-y-4"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-lg font-semibold text-foreground">Add worker(s)</h2>
              <p class="text-xs text-muted-foreground mt-0.5">
                Provision new worker nodes attached to this cluster's VNet.
              </p>
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
            <!-- Count stepper -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">How many workers?</label>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  (click)="decrement()"
                  [disabled]="count() <= 1"
                  class="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ng-icon name="lucideMinus" class="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min="1"
                  max="5"
                  [ngModel]="count()"
                  (ngModelChange)="setCount($event)"
                  class="h-9 w-16 text-center border border-border rounded-md bg-background text-foreground"
                />
                <button
                  type="button"
                  (click)="increment()"
                  [disabled]="count() >= 5"
                  class="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ng-icon name="lucidePlus" class="h-4 w-4" />
                </button>
                <span class="text-xs text-muted-foreground">Min 1 · Max 5 per call</span>
              </div>
            </div>

            <!-- Context -->
            <div class="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground space-y-1.5">
              <div class="flex items-center justify-between gap-2 tabular-nums">
                <span>Current nodes</span>
                <span class="font-medium text-foreground">{{ currentNodes() }}</span>
              </div>
              <div class="flex items-center justify-between gap-2 tabular-nums">
                <span class="font-medium text-foreground">Total after</span>
                <span class="font-semibold text-foreground">
                  {{ projectedTotal() }}@if (maxNodes() != null) { <span class="text-muted-foreground font-normal"> / {{ maxNodes() }} max</span> }
                </span>
              </div>
              <p class="pt-1 border-t border-border">Estimated time: 3–6 minutes per worker.</p>
            </div>

            <!-- Cap warning -->
            @if (capWarning(); as w) {
              <div class="rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                {{ w }}
              </div>
            }

            <!-- Submit error -->
            @if (submitError(); as err) {
              <div class="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs space-y-1.5">
                <p class="text-red-800 dark:text-red-300">{{ err.message }}</p>
                @if (err.kind === 'no-vnet') {
                  <button
                    type="button"
                    (click)="goToNetwork()"
                    class="text-red-700 dark:text-red-200 underline hover:no-underline font-medium"
                  >
                    Open Network tab
                  </button>
                }
              </div>
            }

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
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
                class="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                @if (submitting()) {
                  <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                  Starting…
                } @else {
                  <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
                  Add {{ count() }} worker{{ count() === 1 ? '' : 's' }}
                }
              </button>
            </div>
          }

          @if (phase() === 'tracking' && tracking(); as t) {
            <div class="space-y-3">
              <!-- Status header -->
              <div class="flex items-center gap-2">
                @if (t.status === 'completed') {
                  <ng-icon name="lucideCircleCheck" class="h-5 w-5 text-green-600 dark:text-green-400" />
                  <p class="text-sm font-medium text-foreground">Workers added.</p>
                } @else if (t.status === 'failed') {
                  <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-red-600 dark:text-red-400" />
                  <p class="text-sm font-medium text-foreground">Add worker failed.</p>
                } @else {
                  <ng-icon name="lucideLoader" class="h-5 w-5 text-blue-600 animate-spin" />
                  <p class="text-sm font-medium text-foreground">Provisioning workers…</p>
                }
              </div>

              <!-- Progress bar -->
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
export class AddWorkerDialogComponent {
  private readonly workersService = inject(ClusterWorkersService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  clusterId = input.required<string>();
  currentNodes = input<number>(0);
  maxNodes = input<number | null>(null);

  closed = output<void>();

  protected count = signal<number>(1);
  protected phase = signal<'configure' | 'tracking'>('configure');
  protected submitting = signal<boolean>(false);
  protected submitError = signal<WorkerError | null>(null);

  private readonly operationId = signal<string | null>(null);
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
      warnings: [],
      status: 'pending' as const,
      error: null,
    };
  });

  protected projectedTotal = computed(() => this.currentNodes() + this.count());

  protected capWarning = computed(() => {
    const max = this.maxNodes();
    if (max == null) return null;
    const projected = this.currentNodes() + this.count();
    if (projected > max) {
      return `Adding ${this.count()} would exceed maxNodes=${max} (current: ${this.currentNodes()}). Raise the limit from the Autoscaling tab first.`;
    }
    return null;
  });

  protected canSubmit = computed(() => {
    if (this.submitting()) return false;
    const c = this.count();
    if (c < 1 || c > 5) return false;
    if (this.capWarning()) return false;
    return true;
  });

  setCount(value: number | string): void {
    const n = Math.max(1, Math.min(5, Number(value) || 1));
    this.count.set(n);
  }

  increment(): void { this.setCount(this.count() + 1); }
  decrement(): void { this.setCount(this.count() - 1); }

  async onSubmit(): Promise<void> {
    this.submitError.set(null);
    this.submitting.set(true);
    try {
      const env = await this.workersService.addWorkers(this.clusterId(), this.count());
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
    if (t.status === 'completed') {
      this.toast.showSuccess({
        title: 'Worker(s) added',
        message:
          'New pods and HPA scale-ups will use the new node(s). Restart apps from the Applications tab to redistribute existing pods.',
      });
    }
    if (opId && (t.status === 'completed' || t.status === 'failed')) {
      this.workersService.clearTracking(opId);
    }
    this.closed.emit();
  }

  onCancel(): void {
    if (this.phase() === 'tracking') {
      // Treat the backdrop click as "run in background" — keep tracking alive.
      this.closed.emit();
      return;
    }
    this.closed.emit();
  }

  goToNetwork(): void {
    this.router.navigate(['/cluster', this.clusterId(), 'network']);
    this.closed.emit();
  }
}
