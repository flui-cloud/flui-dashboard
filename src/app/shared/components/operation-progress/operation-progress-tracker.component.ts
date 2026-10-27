import { Component, OnInit, input, output, computed, inject, effect, ChangeDetectionStrategy } from '@angular/core';

import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideArrowRight, lucideRotateCcw } from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';

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
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, OperationStepCardComponent, OperationProgressBarComponent],
  providers: [provideIcons({ lucideArrowLeft, lucideArrowRight, lucideRotateCcw })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="max-w-4xl mx-auto space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold tracking-tight">{{ heading() }}</h1>
          <p class="mt-1 text-sm text-muted-foreground">{{ subheading() }}</p>
        </div>
        @if (isOperationCompleted() && successRoute()) {
          <button hlmBtn size="sm" (click)="navigateToSuccess()">
            {{ mergedLabels().viewDetailsButtonText }}
            <ng-icon name="lucideArrowRight" class="ml-1.5 h-4 w-4" />
          </button>
        }
      </div>

      @if (isOperationFailed()) {
        <div class="rounded-lg border border-destructive/40 bg-card p-5">
          <p class="text-sm text-muted-foreground">{{ mergedLabels().failureMessage }}</p>
          @if (trackerService.operation()?.errorMessage) {
            <pre class="mt-3 whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2 font-mono text-xs text-destructive">{{ trackerService.operation()?.errorMessage }}</pre>
          }
          @if (retryRoute() || failureRoute()) {
            <div class="mt-4 flex items-center gap-2">
              @if (retryRoute()) {
                <button hlmBtn size="sm" (click)="navigateToRetry()">
                  <ng-icon name="lucideRotateCcw" class="mr-1.5 h-4 w-4" />
                  {{ mergedLabels().retryButtonText }}
                </button>
              }
              @if (failureRoute()) {
                <button hlmBtn variant="outline" size="sm" (click)="navigateToFailure()">
                  <ng-icon name="lucideArrowLeft" class="mr-1.5 h-4 w-4" />
                  {{ mergedLabels().backButtonText }}
                </button>
              }
            </div>
          }
        </div>
      }

      <div class="rounded-lg border border-border bg-card">
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
          <div class="divide-y divide-border border-t border-border">
            @for (step of trackerService.steps(); track step.id) {
              <app-operation-step-card
                [step]="step"
                [currentStepProgress]="getCurrentStepProgressForStep(step.id)"
                [isFailed]="isOperationFailed()"
              />
            }
          </div>
        }
      </div>
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
    this.isOperationCompleted() ? this.mergedLabels().successMessage : this.mergedLabels().subtitle
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
      this.operationFailed.emit(this.trackerService.operation()?.errorMessage || 'Operation failed');
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
    return new Date(op.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getCurrentStepProgressForStep(stepId: string): number | undefined {
    if (this.trackerService.operation()?.currentStep === stepId) {
      return this.trackerService.getCurrentStepProgress();
    }
    return undefined;
  }
}
