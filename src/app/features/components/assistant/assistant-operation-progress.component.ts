import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideCircleX, lucideLoaderCircle } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { InfrastructureOperationsService } from '../../../core/api/api/infrastructureOperations.service';

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
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCircleCheck, lucideCircleX, lucideLoaderCircle })],
  template: `
    <div class="mt-2 rounded-xl border px-3 py-2.5 text-xs"
      [class]="succeeded()
        ? 'border-green-500/30 bg-green-500/5'
        : failed()
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-border/50 bg-muted/30'">

      <div class="flex items-center gap-2">
        @if (succeeded()) {
          <ng-icon name="lucideCircleCheck" class="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
        } @else if (failed()) {
          <ng-icon name="lucideCircleX" class="h-4 w-4 shrink-0 text-destructive" />
        } @else {
          <ng-icon name="lucideLoaderCircle" class="h-4 w-4 shrink-0 text-blue-500 animate-spin" />
        }
        <span class="font-medium text-foreground truncate">{{ label() }}</span>
        <div class="flex-1"></div>
        @if (isRunning() && hasProgress()) {
          <span class="shrink-0 font-mono text-[11px] text-muted-foreground">{{ progress() }}%</span>
        }
      </div>

      @if (isRunning()) {
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          @if (hasProgress()) {
            <div class="h-full rounded-full bg-blue-500 transition-[width] duration-500 ease-out"
              [style.width.%]="progress()"></div>
          } @else {
            <div class="h-full w-1/3 rounded-full bg-blue-500/60 animate-pulse"></div>
          }
        </div>
        @if (stepLabel()) {
          <p class="mt-1.5 text-[11px] text-muted-foreground">{{ stepLabel() }}</p>
        }
      } @else if (failed()) {
        <p class="mt-1.5 text-[11px] text-destructive/90 break-words">{{ failureText() }}</p>
      }
    </div>
  `,
})
export class AssistantOperationProgressComponent implements OnInit, OnDestroy {
  readonly operationId = input.required<string>();
  readonly label = input.required<string>();

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
  protected readonly failed = computed(() => this.status() === 'FAILED' || this.status() === 'CANCELLED');
  protected readonly isRunning = computed(() => !this.succeeded() && !this.failed());
  protected readonly stepLabel = computed(() => this.humanizeStep(this.currentStep()));

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
    try {
      const res = (await firstValueFrom(
        this.operationsApi.infrastructureOperationsControllerGetOperationStatus(this.operationId()),
      )) as OperationStatusResponse;

      if (this.stopped) return;

      this.status.set(res.status);
      if (typeof res.progress === 'number') this.progressValue.set(Math.max(0, Math.min(100, res.progress)));
      if (res.currentStep) this.currentStep.set(res.currentStep);
      if (res.errorMessage) this.error.set(res.errorMessage);

      if (TERMINAL.has(res.status)) {
        if (res.status === 'COMPLETED') this.progressValue.set(100);
        return;
      }
    } catch {
      /* transient error — keep polling */
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.poll(), POLL_INTERVAL);
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
