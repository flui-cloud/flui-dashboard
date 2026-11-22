import { Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideTrash, lucideX } from '@ng-icons/lucide';

import { ClusterWorkersService } from '../../service/cluster-workers.service';
import { ToastService } from '../../../shared/services/toast.service';
import { OperationWarning, WorkerError } from '../../model/worker-operation.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-remove-worker-dialog',
  imports: [FormsModule, FlAlert, FlUsageBar, FlButton, FlIcon, FlSpinner, FlStatus],
  providers: [provideIcons({ lucideX, lucideTrash })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="onCancel()"
    >
      <div
        class="fl-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-worker-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="remove-worker-title">Remove worker</h2>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="onCancel()">
            <fl-icon name="lucideX" />
          </button>
        </header>

        @if (phase() === 'configure') {
          <div class="fl-dialog__body">
            <p class="m-0 text-fl-ink-muted">{{ subtitle() }}</p>
            <p class="m-0">
              You are about to remove <span class="fl-mono">{{ workerName() }}</span>.
            </p>
            <fl-alert tone="warning" title="This action cannot be undone.">
              <span class="block">
                Apps will be moved to other nodes when possible. Apps with strict availability rules
                may be stopped without a graceful shutdown.
              </span>
              @if (isByos()) {
                <span class="mt-1 block">
                  Flui drains the node and uninstalls k3s over SSH. The server itself stays, it is
                  yours, so you can repurpose or reconnect it later.
                </span>
              }
            </fl-alert>
            <div class="fl-field">
              <label class="fl-field__label" for="remove-worker-confirm">
                Type <span class="fl-mono">{{ workerName() }}</span> to confirm
              </label>
              <span class="fl-input fl-input--lg">
                <input
                  id="remove-worker-confirm"
                  type="text"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="Worker name"
                  autofocus
                  [ngModel]="typed()"
                  (ngModelChange)="typed.set($event)"
                />
              </span>
            </div>
            @if (submitError(); as err) {
              <fl-alert tone="error" title="Could not remove the worker">{{
                err.message
              }}</fl-alert>
            }
          </div>
          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" [disabled]="submitting()" (click)="onCancel()">
              Cancel
            </button>
            <button flButton="danger" type="button" [disabled]="!canSubmit()" (click)="onSubmit()">
              @if (submitting()) {
                <fl-spinner label="Starting" />
                Starting…
              } @else {
                <fl-icon name="lucideTrash" [size]="14" />
                Remove worker
              }
            </button>
          </footer>
        }

        @if (phase() === 'tracking' && tracking(); as t) {
          <div class="fl-dialog__body">
            @if (t.status === 'completed') {
              <fl-status tone="success" label="Worker removed." />
            } @else if (t.status === 'failed') {
              <fl-status tone="error" label="Remove worker failed." />
            } @else {
              <fl-status tone="progress" label="Freeing up the node and removing it…" />
            }
            <fl-usage-bar
              [percent]="t.progress"
              label="Progress"
              [aside]="stepLabel()"
              [warnAt]="101"
              [criticalAt]="101"
            />
            @if (t.stepDescription) {
              <p class="m-0 text-fl-body-sm text-fl-ink-muted">{{ t.stepDescription }}</p>
            }
            @if (t.status === 'failed' && t.error) {
              <fl-alert tone="error" title="Removal stopped">{{ t.error }}</fl-alert>
            }
          </div>
          <footer class="fl-dialog__footer">
            <button flButton type="button" (click)="onCloseTracking()">
              {{ t.status === 'in_progress' ? 'Run in background' : 'Close' }}
            </button>
          </footer>
        }
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
  isByos = input<boolean>(false);

  closed = output<void>();

  protected subtitle = computed(() =>
    this.isByos()
      ? 'Drains apps and uninstalls k3s over SSH. The server stays: Flui never owned it.'
      : 'Moves apps off the node and removes it from the provider.',
  );

  protected phase = signal<'configure' | 'tracking'>('configure');
  protected typed = signal<string>('');
  protected submitting = signal<boolean>(false);
  protected submitError = signal<WorkerError | null>(null);

  private readonly operationId = signal<string | null>(null);
  private readonly warningsEmitted = signal<boolean>(false);

  protected tracking = computed(() => {
    const opId = this.operationId();
    return (
      this.workersService.trackedStates()[opId ?? ''] ?? {
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
      }
    );
  });

  protected stepLabel = computed(() => {
    const t = this.tracking();
    if (t.status === 'completed') return 'Done';
    if (t.status === 'failed') return 'Stopped';
    if (t.totalSteps > 0) return `Step ${t.currentStepIndex + 1}/${t.totalSteps}`;
    return 'Starting…';
  });

  protected canSubmit = computed(
    () => !this.submitting() && this.typed().trim() === this.workerName(),
  );

  constructor() {
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
      const env = await this.workersService.removeWorker(
        this.clusterId(),
        this.nodeId(),
        this.workerName(),
      );
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
          message:
            'Could not stop new apps from being scheduled on the node before removal (master unreachable). Please verify your apps were rebalanced.',
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
      case 'UNINSTALL_FAILED':
      case 'UNINSTALL_SKIPPED':
      case 'UNINSTALL_UNCONFIRMED':
        this.toast.showWarning({
          title: 'Node removed — finish cleanup on the host',
          message:
            'k3s may still be installed on the server. SSH in and run ' +
            '`k3s-agent-uninstall.sh` to fully decommission it.',
          persistent: true,
        });
        break;
    }
  }
}
