import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InfrastructureOperationsService } from '../../../core/api/api/infrastructureOperations.service';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

type OperationState = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface OperationStatusResponse {
  status: OperationState;
  progress?: number;
  currentStep?: string;
  errorMessage?: string;
}

const POLL_INTERVAL = 2500;
const TERMINAL = new Set<OperationState>(['COMPLETED', 'FAILED', 'CANCELLED']);

@Component({
  selector: 'app-assistant-operation-progress',
  imports: [FlStatus],
  host: {
    class: 'mt-2 flex flex-col gap-2 rounded-fl-lg border border-fl-border bg-fl-surface p-3',
  },
  template: `
    <div class="flex items-center gap-3">
      <span class="min-w-0 flex-1 truncate text-fl-body-sm font-medium text-fl-ink">{{
        label()
      }}</span>
      @if (isRunning() && hasProgress()) {
        <span class="fl-mono fl-num shrink-0 text-fl-ink-muted">{{ progress() }}%</span>
      }
      <fl-status [tone]="tone()" [label]="statusLabel()" />
    </div>

    @if (isRunning()) {
      @if (hasProgress()) {
        <span
          class="fl-bar"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-valuenow]="progress()"
          [attr.aria-label]="label()"
          ><span [style.width.%]="progress()"></span
        ></span>
      }
      @if (stepLabel()) {
        <ol class="fl-steps">
          <li class="fl-step" aria-current="step">
            <span class="fl-step__text">
              <span class="fl-step__kicker">Current step</span>
              <span class="fl-step__name">{{ stepLabel() }}</span>
            </span>
          </li>
        </ol>
      }
    } @else if (failed()) {
      <p class="break-words text-fl-body-sm text-fl-ink-secondary">{{ failureText() }}</p>
    }
  `,
})
export class AssistantOperationProgressComponent implements OnInit, OnDestroy {
  readonly operationId = input.required<string>();
  readonly label = input.required<string>();
  readonly settled = output<OperationState>();

  private readonly operationsApi = inject(InfrastructureOperationsService);

  private readonly status = signal<OperationState>('PENDING');
  private readonly progressValue = signal<number | null>(null);
  private readonly currentStep = signal<string>('');
  private readonly error = signal<string>('');
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  protected readonly progress = computed(() => this.progressValue() ?? 0);
  protected readonly hasProgress = computed(() => this.progressValue() != null);
  protected readonly succeeded = computed(() => this.status() === 'COMPLETED');
  protected readonly failed = computed(
    () => this.status() === 'FAILED' || this.status() === 'CANCELLED',
  );
  protected readonly isRunning = computed(() => !this.succeeded() && !this.failed());
  protected readonly stepLabel = computed(() => this.humanizeStep(this.currentStep()));

  protected readonly tone = computed<StatusTone>(() => {
    if (this.succeeded()) return 'success';
    if (this.failed()) return 'error';
    return 'progress';
  });

  protected readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'COMPLETED':
        return 'Completed';
      case 'FAILED':
        return 'Failed';
      case 'CANCELLED':
        return 'Cancelled';
      case 'PENDING':
        return 'Pending';
      default:
        return 'Running';
    }
  });

  protected readonly failureText = computed(() => {
    if (this.status() === 'CANCELLED') return 'Operation cancelled.';
    return this.error() || 'Operation failed.';
  });

  ngOnInit(): void {
    void this.poll();
  }

  ngOnDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private async poll(): Promise<void> {
    if (this.stopped) return;
    const res = await this.fetchStatus();
    if (this.stopped) return;
    if (res) {
      this.status.set(res.status);
      if (typeof res.progress === 'number')
        this.progressValue.set(Math.max(0, Math.min(100, res.progress)));
      if (res.currentStep) this.currentStep.set(res.currentStep);
      if (res.errorMessage) this.error.set(res.errorMessage);

      if (TERMINAL.has(res.status)) {
        if (res.status === 'COMPLETED') this.progressValue.set(100);
        this.settled.emit(res.status);
        return;
      }
    }
    this.timer = setTimeout(() => void this.poll(), POLL_INTERVAL);
  }

  private fetchStatus(): Promise<OperationStatusResponse | null> {
    return firstValueFrom(
      this.operationsApi.infrastructureOperationsControllerGetOperationStatus(this.operationId()),
    ).then(
      (res) => res as OperationStatusResponse,
      () => null,
    );
  }

  private humanizeStep(step: string): string {
    const cleaned = step
      .replace(/^catalog_(install|uninstall)_/, '')
      .replace(/^app_/, '')
      .replaceAll('_', ' ')
      .trim();
    if (!cleaned) return '';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1) + '…';
  }
}
