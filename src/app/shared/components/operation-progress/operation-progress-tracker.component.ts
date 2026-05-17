/**
 * Operation Progress Tracker Component
 *
 * Generic component for tracking long-running operations (cluster creation, build agent creation, etc.)
 * Displays progress, steps, and handles success/failure states.
 *
 * Usage:
 * <app-operation-progress-tracker
 *   [operationId]="operationId"
 *   [operationType]="'cluster' | 'build-agent'"
 *   [resourceName]="'My Cluster'"
 *   [labels]="customLabels"
 *   [successRoute]="'/cluster/123'"
 *   [failureRoute]="'/cluster'"
 *   (operationCompleted)="onComplete($event)"
 *   (operationFailed)="onFailed($event)"
 * />
 */

import { Component, OnInit, OnDestroy, input, output, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideLoader,
  lucideX,
  lucidePlay,
  lucideCircleAlert,
  lucideArrowRight,
  lucideArrowLeft,
} from '@ng-icons/lucide';

import { OperationTrackerService, OperationType } from '../../services/operation-tracker.service';
import { OperationStepCardComponent } from './operation-step-card.component';
import { OperationProgressBarComponent } from './operation-progress-bar.component';
import { OperationActivityFeedComponent } from './operation-activity-feed.component';

export interface OperationLabels {
  title?: string; // e.g., "Creating Your Cluster" or "Creating Build Agent"
  subtitle?: string; // e.g., "Setting up X on Y"
  progressTitle?: string; // e.g., "Deployment Progress"
  successTitle?: string; // e.g., "Cluster Created Successfully!"
  successMessage?: string; // e.g., "Your cluster is ready to use"
  failureTitle?: string; // e.g., "Cluster Creation Failed"
  failureMessage?: string; // e.g., "The cluster could not be created"
  retryButtonText?: string; // e.g., "Retry Creation"
  backButtonText?: string; // e.g., "Back to Clusters"
  viewDetailsButtonText?: string; // e.g., "Go to Cluster"
}

const DEFAULT_LABELS: OperationLabels = {
  title: 'Operation in Progress',
  subtitle: 'Processing your request...',
  progressTitle: 'Progress',
  successTitle: 'Operation Completed Successfully!',
  successMessage: 'Your resource is ready to use',
  failureTitle: 'Operation Failed',
  failureMessage: 'The operation could not be completed',
  retryButtonText: 'Retry',
  backButtonText: 'Back',
  viewDetailsButtonText: 'View Details',
};

@Component({
  selector: 'app-operation-progress-tracker',
  standalone: true,
  imports: [
    CommonModule,
    NgIcon,
    OperationStepCardComponent,
    OperationProgressBarComponent,
    OperationActivityFeedComponent,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideLoader,
      lucideX,
      lucidePlay,
      lucideCircleAlert,
      lucideArrowRight,
      lucideArrowLeft,
    }),
  ],
  template: `
    <div class="max-w-4xl mx-auto space-y-6">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center"
             [class]="isOperationFailed()
               ? 'bg-red-100 dark:bg-red-900/20'
               : isOperationCompleted()
                 ? 'bg-green-100 dark:bg-green-900/20'
                 : 'bg-blue-100 dark:bg-blue-900/20'">
          @if (isOperationFailed()) {
            <ng-icon name="lucideX" class="h-8 w-8 text-red-600" />
          } @else if (isOperationCompleted()) {
            <ng-icon name="lucideCheck" class="h-8 w-8 text-green-600" />
          } @else {
            <ng-icon name="lucideLoader" class="h-8 w-8 text-blue-600 animate-spin" />
          }
        </div>
        <h1 class="text-2xl font-bold">
          {{ isOperationFailed() ? mergedLabels().failureTitle : isOperationCompleted() ? mergedLabels().successTitle : mergedLabels().title }}
        </h1>
        <p class="text-muted-foreground mt-2">
          {{ isOperationCompleted() ? mergedLabels().successMessage : mergedLabels().subtitle }}
        </p>
      </div>

      <!-- Overall Progress -->
      <app-operation-progress-bar
        [title]="mergedLabels().progressTitle || 'Progress'"
        [progress]="trackerService.getOverallProgress()"
        [completedSteps]="trackerService.getCompletedStepsCount()"
        [totalSteps]="trackerService.stepsTotal()"
        [currentStep]="trackerService.stepIndex() + 1"
        [startedTime]="getFormattedStartTime()"
        [estimatedCompletion]="getEstimatedCompletion()"
        [isFailed]="isOperationFailed()"
      />

      <!-- Detailed Steps -->
      <div class="space-y-4">
        @for (step of trackerService.steps(); track step.id) {
          <app-operation-step-card
            [step]="step"
            [currentStepProgress]="getCurrentStepProgressForStep(step.id)"
            [isFailed]="isOperationFailed()"
          />
        }
      </div>

      <!-- Live Activity Feed -->
      <app-operation-activity-feed
        [steps]="trackerService.steps()"
      />

      <!-- Success Message and Action Button -->
      @if (isOperationCompleted() && showSuccessModal()) {
        @if (showSuccessMessage()) {
          <!-- Success Modal with Button -->
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-500">
            <div class="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg p-8 max-w-md mx-4 shadow-xl animate-in zoom-in duration-500">
              <div class="flex flex-col items-center text-center space-y-4">
                <div class="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center animate-bounce">
                  <ng-icon name="lucideCheck" class="h-8 w-8 text-white" />
                </div>
                <h2 class="text-2xl font-bold text-green-900 dark:text-green-100">
                  {{ mergedLabels().successTitle }}
                </h2>
                <p class="text-green-700 dark:text-green-300">
                  {{ mergedLabels().successMessage }}
                </p>

                @if (!showGoToButton()) {
                  <!-- Loading state for first 3 seconds -->
                  <div class="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
                    <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                    <span>Preparing...</span>
                  </div>
                } @else {
                  <!-- Button appears after 3 seconds -->
                  <button
                    (click)="navigateToSuccess()"
                    class="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl animate-in fade-in zoom-in duration-300"
                  >
                    {{ mergedLabels().viewDetailsButtonText }}
                    <ng-icon name="lucideArrowRight" class="h-5 w-5" />
                  </button>
                }
              </div>
            </div>
          </div>
        }
      } @else if (isOperationFailed()) {
        <!-- Failed State Error Card -->
        <div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-600 rounded-lg p-6">
          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 h-12 w-12 rounded-full bg-red-500 flex items-center justify-center">
              <ng-icon name="lucideX" class="h-6 w-6 text-white" />
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-red-900 dark:text-red-100">
                {{ mergedLabels().failureTitle }}
              </h3>
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">
                {{ mergedLabels().failureMessage }}
              </p>

              <!-- Error Message -->
              @if (trackerService.operation()?.errorMessage) {
                <div class="mt-4 p-3 bg-red-100 dark:bg-red-900/40 rounded-md border border-red-300 dark:border-red-700">
                  <div class="flex items-start">
                    <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                    <div class="flex-1">
                      <p class="text-sm font-medium text-red-800 dark:text-red-200">Error Details:</p>
                      <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ trackerService.operation()?.errorMessage }}</p>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="mt-6 flex items-center space-x-4">
            @if (retryRoute()) {
              <button
                (click)="navigateToRetry()"
                class="inline-flex items-center justify-center rounded-md bg-red-600 px-6 py-3 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                <ng-icon name="lucidePlay" class="h-4 w-4 mr-2" />
                {{ mergedLabels().retryButtonText }}
              </button>
            }
            @if (failureRoute()) {
              <button
                (click)="navigateToFailure()"
                class="inline-flex items-center justify-center rounded-md border border-red-300 dark:border-red-700 bg-background px-6 py-3 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <ng-icon name="lucideArrowLeft" class="h-4 w-4 mr-2" />
                {{ mergedLabels().backButtonText }}
              </button>
            }
          </div>
        </div>
      } @else {
        <!-- Cancel Button (only show if not completed and not failed) -->
        <div class="text-center pt-4">
          <button
            class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            disabled
          >
            <ng-icon name="lucideX" class="h-4 w-4 mr-2" />
            Cancel Operation
            <span class="text-xs text-muted-foreground ml-2">(Coming Soon)</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class OperationProgressTrackerComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  trackerService = inject(OperationTrackerService);

  // Inputs
  operationId = input.required<string>();
  operationType = input.required<OperationType>();
  resourceName = input<string>('');
  labels = input<Partial<OperationLabels>>({});
  successRoute = input<string>();
  failureRoute = input<string>();
  retryRoute = input<string>();
  showSuccessModal = input<boolean>(true); // Allow disabling built-in success modal

  // Outputs
  operationCompleted = output<void>();
  operationFailed = output<string>();

  // Internal state
  private successTimeout?: number;
  showSuccessMessage = signal(false);
  showGoToButton = signal(false);

  // Computed
  readonly isOperationFailed = this.trackerService.isOperationFailed;
  readonly isOperationCompleted = this.trackerService.isOperationCompleted;

  readonly mergedLabels = computed<OperationLabels>(() => ({
    ...DEFAULT_LABELS,
    ...this.labels(),
  }));

  ngOnInit(): void {
    void (async () => {
      const opId = this.operationId();
  
      if (opId) {
        this.trackerService.resetState();
  
        try {
          await this.trackerService.trackOperation(opId);
        } catch (error) {
          console.error('Failed to track operation:', error);
        }
      }
  
      // Watch for completion/failure
      effect(() => {
        if (this.isOperationCompleted() && !this.showSuccessMessage()) {
          this.showSuccessWithDelay();
          this.operationCompleted.emit();
        }
  
        if (this.isOperationFailed()) {
          const errorMsg = this.trackerService.operation()?.errorMessage || 'Operation failed';
          this.operationFailed.emit(errorMsg);
        }
      });
    })();
  }

  ngOnDestroy(): void {
    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
    }
  }

  private showSuccessWithDelay(): void {
    this.showSuccessMessage.set(true);
    this.showGoToButton.set(false);

    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
    }

    // After 3 seconds, show the button
    this.successTimeout = setTimeout(() => {
      this.showGoToButton.set(true);
    }, 3000) as any;
  }

  // Navigation methods
  navigateToSuccess(): void {
    const route = this.successRoute();
    if (route) {
      this.router.navigate([route]);
    }
  }

  navigateToFailure(): void {
    const route = this.failureRoute();
    if (route) {
      this.router.navigate([route]);
    }
  }

  navigateToRetry(): void {
    const route = this.retryRoute();
    if (route) {
      this.router.navigate([route]);
    }
  }

  // Helper methods
  getFormattedStartTime(): string {
    const op = this.trackerService.operation();
    if (!op?.startedAt) return '';

    const date = new Date(op.startedAt);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getEstimatedCompletion(): string {
    const op = this.trackerService.operation();

    // Hide when completed or failed
    if (op?.status === 'COMPLETED' || op?.status === 'FAILED') {
      return '';
    }

    const steps = this.trackerService.steps();
    const runningStep = steps.find(s => s.status === 'running');

    if (!runningStep) return 'Calculating...';

    const pendingSteps = steps.filter(s => s.status === 'pending');
    const totalRemainingTime = pendingSteps.reduce((sum, step) => sum + (step.estimatedDuration || 0), 0);

    let currentStepRemaining = 0;
    if (runningStep.startedAt && runningStep.estimatedDuration) {
      const elapsed = (Date.now() - runningStep.startedAt.getTime()) / 1000;
      currentStepRemaining = Math.max(0, runningStep.estimatedDuration - elapsed);
    }

    const totalSeconds = totalRemainingTime + currentStepRemaining;
    const completionTime = new Date(Date.now() + totalSeconds * 1000);

    return completionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getCurrentStepProgressForStep(stepId: string): number | undefined {
    const currentStep = this.trackerService.operation()?.currentStep;
    if (currentStep === stepId) {
      return this.trackerService.getCurrentStepProgress();
    }
    return undefined;
  }
}
