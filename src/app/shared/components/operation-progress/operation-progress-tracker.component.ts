import {
  Component,
  OnInit,
  input,
  output,
  computed,
  inject,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';

import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideArrowRight, lucideRotateCcw } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';

import { OperationTrackerService, OperationType } from '../../services/operation-tracker.service';
import { OperationStepCardComponent } from './operation-step-card.component';
import { OperationProgressBarComponent } from './operation-progress-bar.component';

export interface OperationLabels {
  title?: string;
  subtitle?: string;
  progressTitle?: string;
  successTitle?: string;
  successMessage?: string;
  failureTitle?: string;
  failureMessage?: string;
  retryButtonText?: string;
  backButtonText?: string;
  viewDetailsButtonText?: string;
}

const DEFAULT_LABELS: OperationLabels = {
  title: 'Operation in progress',
  subtitle: 'Processing your request',
  progressTitle: 'Progress',
  successTitle: 'Operation completed',
  successMessage: 'The resource is ready to use',
  failureTitle: 'Operation failed',
  failureMessage: 'The operation could not be completed',
  retryButtonText: 'Retry',
  backButtonText: 'Back',
  viewDetailsButtonText: 'View details',
};

@Component({
  selector: 'app-operation-progress-tracker',
  imports: [
    FlButton,
    FlIcon,
    FlAlert,
    FlPanel,
    OperationStepCardComponent,
    OperationProgressBarComponent,
  ],
  providers: [provideIcons({ lucideArrowLeft, lucideArrowRight, lucideRotateCcw })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="fl-stack mx-auto max-w-4xl">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1">
          <h1 class="m-0 text-fl-page-title text-fl-ink">{{ heading() }}</h1>
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">{{ subheading() }}</p>
        </div>
        @if (isOperationCompleted() && successRoute()) {
          <button flButton="primary" type="button" (click)="navigateToSuccess()">
            {{ mergedLabels().viewDetailsButtonText }}
            <fl-icon name="lucideArrowRight" />
          </button>
        }
      </div>

      @if (isOperationFailed()) {
        <fl-alert
          tone="error"
          [title]="mergedLabels().failureMessage || 'The operation could not be completed'"
        >
          @if (trackerService.operation()?.errorMessage) {
            <pre
              class="m-0 whitespace-pre-wrap break-words font-mono text-fl-mono-sm text-fl-ink"
              >{{ trackerService.operation()?.errorMessage }}</pre>
          }
          @if (retryRoute() || failureRoute()) {
            <div alertActions class="flex items-center gap-2">
              @if (retryRoute()) {
                <button flButton="primary" size="sm" type="button" (click)="navigateToRetry()">
                  <fl-icon name="lucideRotateCcw" [size]="14" />
                  {{ mergedLabels().retryButtonText }}
                </button>
              }
              @if (failureRoute()) {
                <button flButton="ghost" size="sm" type="button" (click)="navigateToFailure()">
                  <fl-icon name="lucideArrowLeft" [size]="14" />
                  {{ mergedLabels().backButtonText }}
                </button>
              }
            </div>
          }
        </fl-alert>
      }

      <fl-panel [flush]="true">
        <app-operation-progress-bar
          [title]="mergedLabels().progressTitle || 'Progress'"
          [progress]="trackerService.getOverallProgress()"
          [totalSteps]="trackerService.stepsTotal()"
          [currentStep]="trackerService.stepIndex() + 1"
          [startedTime]="getFormattedStartTime()"
          [isFailed]="isOperationFailed()"
          [isCompleted]="isOperationCompleted()"
        />
        @if (trackerService.steps().length > 0) {
          <ol class="m-0 list-none divide-y divide-fl-border border-t border-fl-border p-0">
            @for (step of trackerService.steps(); track step.id) {
              <li>
                <app-operation-step-card
                  [step]="step"
                  [currentStepProgress]="getCurrentStepProgressForStep(step.id)"
                  [isFailed]="isOperationFailed()"
                />
              </li>
            }
          </ol>
        }
      </fl-panel>
    </div>
  `,
})
export class OperationProgressTrackerComponent implements OnInit {
  private readonly router = inject(Router);
  trackerService = inject(OperationTrackerService);

  operationId = input.required<string>();
  operationType = input.required<OperationType>();
  resourceName = input<string>('');
  labels = input<Partial<OperationLabels>>({});
  successRoute = input<string>();
  failureRoute = input<string>();
  retryRoute = input<string>();

  operationCompleted = output<void>();
  operationFailed = output<string>();

  readonly isOperationFailed = this.trackerService.isOperationFailed;
  readonly isOperationCompleted = this.trackerService.isOperationCompleted;

  readonly mergedLabels = computed<OperationLabels>(() => ({
    ...DEFAULT_LABELS,
    ...this.labels(),
  }));

  readonly heading = computed(() => {
    const labels = this.mergedLabels();
    if (this.isOperationFailed()) return labels.failureTitle;
    if (this.isOperationCompleted()) return labels.successTitle;
    return labels.title;
  });

  readonly subheading = computed(() =>
    this.isOperationCompleted() ? this.mergedLabels().successMessage : this.mergedLabels().subtitle,
  );

  private completionEmitted = false;
  private failureEmitted = false;
  private readonly emitOutcome = effect(() => {
    if (this.isOperationCompleted() && !this.completionEmitted) {
      this.completionEmitted = true;
      this.operationCompleted.emit();
    }
    if (this.isOperationFailed() && !this.failureEmitted) {
      this.failureEmitted = true;
      this.operationFailed.emit(
        this.trackerService.operation()?.errorMessage || 'Operation failed',
      );
    }
  });

  ngOnInit(): void {
    const opId = this.operationId();
    if (!opId) return;
    this.trackerService.resetState();
    this.trackerService.trackOperation(opId).catch((error) => {
      console.error('Failed to track operation:', error);
    });
  }

  navigateToSuccess(): void {
    const route = this.successRoute();
    if (route) {
      void this.router.navigate([route]);
    }
  }

  navigateToFailure(): void {
    const route = this.failureRoute();
    if (route) {
      void this.router.navigate([route]);
    }
  }

  navigateToRetry(): void {
    const route = this.retryRoute();
    if (route) {
      void this.router.navigate([route]);
    }
  }

  getFormattedStartTime(): string {
    const op = this.trackerService.operation();
    if (!op?.startedAt) return '';
    return new Date(op.startedAt).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getCurrentStepProgressForStep(stepId: string): number | undefined {
    if (this.trackerService.operation()?.currentStep === stepId) {
      return this.trackerService.getCurrentStepProgress();
    }
    return undefined;
  }
}
