/**
 * Operation Tracker Service
 *
 * Shared service for tracking long-running operations via polling.
 * Used by cluster creation, build agent creation, deployments, etc.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InfrastructureOperationsService } from '../../core/api/api/infrastructureOperations.service';
import { OperationStatus, ClusterCreationStep } from '../../features/model/cluster.models';

export type OperationType = 'cluster' | 'build-agent' | 'deployment' | 'scaling';

export interface OperationTrackingState {
  operationId: string;
  operationType: OperationType;
  resourceId?: string;
  resourceName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OperationTrackerService {
  private readonly operationsApi = inject(InfrastructureOperationsService);

  // State signals
  private readonly operationStatus = signal<OperationStatus | null>(null);
  private readonly creationSteps = signal<ClusterCreationStep[]>([]);
  private readonly creationProgress = signal<number>(0);
  private readonly creationMessage = signal<string>('');
  private readonly currentStepIndex = signal<number>(0);
  private readonly totalSteps = signal<number>(0);
  private readonly currentStepProgress = signal<number>(0);
  private readonly error = signal<string | null>(null);
  private readonly stepMessages: Set<string> = new Set(); // Track unique step identifiers

  // Public readonly signals
  readonly operation = this.operationStatus.asReadonly();
  readonly steps = this.creationSteps.asReadonly();
  readonly progress = this.creationProgress.asReadonly();
  readonly progressMessage = this.creationMessage.asReadonly();
  readonly stepIndex = this.currentStepIndex.asReadonly();
  readonly stepsTotal = this.totalSteps.asReadonly();
  readonly stepProgress = this.currentStepProgress.asReadonly();
  readonly errorMessage = this.error.asReadonly();

  // Computed signals
  readonly isOperationFailed = computed(() => {
    const op = this.operationStatus();
    return op?.status === 'FAILED';
  });

  readonly isOperationCompleted = computed(() => {
    const op = this.operationStatus();
    return op?.status === 'COMPLETED';
  });

  readonly isOperationInProgress = computed(() => {
    const op = this.operationStatus();
    return op?.status === 'IN_PROGRESS' || op?.status === 'PENDING';
  });

  readonly getCompletedStepsCount = computed(() => {
    // Count only steps with status 'completed'
    return this.creationSteps().filter(step => step.status === 'completed').length;
  });

  /**
   * Reset all state for a new operation
   */
  resetState(): void {
    this.operationStatus.set(null);
    this.creationSteps.set([]);
    this.creationProgress.set(0);
    this.creationMessage.set('');
    this.currentStepIndex.set(0);
    this.totalSteps.set(0);
    this.currentStepProgress.set(0);
    this.error.set(null);
    this.stepMessages.clear();
  }

  /**
   * Synchronize frontend steps with backend metadata.operationSteps
   * Reconstructs missing completed steps when polling starts mid-operation
   */
  private syncStepsFromMetadata(status: OperationStatus): void {
    const operationSteps = status.metadata?.operationSteps || [];
    const currentStepIndex = status.currentStepIndex || 0;

    if (operationSteps.length === 0) {
      return; // No metadata available
    }

    const existingSteps = this.creationSteps();
    const existingStepIds = new Set(existingSteps.map(s => s.id));

    console.log(`🔍 Syncing steps: currentIndex=${currentStepIndex}, totalSteps=${status.totalSteps}, existing=${existingSteps.length}`);

    // Reconstruct all steps BEFORE current step as completed
    for (let i = 0; i < currentStepIndex; i++) {
      const stepDef = operationSteps[i];
      const stepId = stepDef.step;

      if (!existingStepIds.has(stepId)) {
        console.log(`🔧 Reconstructing completed step ${i + 1}/${status.totalSteps}: ${stepDef.description}`);

        // Mark as seen to prevent duplicate creation
        this.stepMessages.add(stepId);

        // Use status.startedAt if available, otherwise use current time
        const timestamp = status.startedAt ? new Date(status.startedAt) : new Date();

        const completedStep: ClusterCreationStep = {
          id: stepId,
          title: stepDef.description || stepId,
          description: `Step ${i + 1} of ${status.totalSteps}`,
          status: 'completed',
          startedAt: timestamp,
          completedAt: timestamp,
        };

        // Insert at correct position to maintain order
        this.creationSteps.update((steps) => {
          const newSteps = [...steps];
          // Find correct insertion point based on step order in operationSteps
          let insertIndex = 0;
          for (let j = 0; j < newSteps.length; j++) {
            const existingIdx = operationSteps.findIndex(s => s.step === newSteps[j].id);
            if (existingIdx !== -1 && existingIdx > i) {
              break;
            }
            insertIndex = j + 1;
          }
          newSteps.splice(insertIndex, 0, completedStep);
          return newSteps;
        });
      }
    }
  }

  /**
   * Start tracking an operation by operationId
   * Polls until completion or failure
   */
  async trackOperation(operationId: string): Promise<void> {
    const POLL_INTERVAL = 3000; // Poll every 3 seconds
    const MAX_POLLS = 600; // Max 30 minutes (600 * 3s)
    let pollCount = 0;

    const poll = async (): Promise<void> => {
      if (pollCount >= MAX_POLLS) {
        this.error.set('Operation timeout. Please check the status manually.');
        this.creationMessage.set('Operation timeout');
        return;
      }

      pollCount++;

      try {
        const statusResponse = await firstValueFrom(
          this.operationsApi.infrastructureOperationsControllerGetOperationStatus(operationId)
        );

        const status = statusResponse as OperationStatus;
        console.log(`📊 Operation status (${pollCount}):`, status);

        // Update operation status signal
        this.operationStatus.set(status);

        // Update progress signals
        this.creationProgress.set(status.progress);
        this.currentStepIndex.set(status.currentStepIndex);
        this.totalSteps.set(status.totalSteps);
        this.currentStepProgress.set(status.currentStepProgress);

        const stepDescription = status.metadata?.stepDescription || 'Processing...';
        if (status.totalSteps > 0) {
          this.creationMessage.set(
            `Step ${status.currentStepIndex + 1}/${status.totalSteps}: ${stepDescription}`
          );
        } else {
          this.creationMessage.set(stepDescription);
        }

        // Sync steps from metadata (reconstruct missing completed steps)
        this.syncStepsFromMetadata(status);

        // Create/update current dynamic step
        this.addDynamicStep(
          status.currentStep,
          stepDescription,
          status.currentStepIndex,
          status.totalSteps,
          status.currentStepProgress,
          status.progress
        );

        // Check completion
        if (status.status === 'COMPLETED') {
          console.log('✅ Operation completed!');
          this.creationProgress.set(100);
          this.creationMessage.set('Operation completed successfully!');

          // Mark last step as completed
          const steps = this.creationSteps();
          if (steps.length > 0) {
            const lastStep = steps.at(-1)!;
            if (lastStep.status === 'running') {
              this.updateCreationStep(lastStep.id, {
                status: 'completed',
                completedAt: new Date(),
              });
            }
          }

          // Add final completion step
          const finalStep: ClusterCreationStep = {
            id: `step-final-${Date.now()}`,
            title: 'Operation completed successfully!',
            description: 'Resource is ready to use',
            status: 'completed',
            startedAt: new Date(),
            completedAt: new Date(),
          };
          this.creationSteps.update((currentSteps) => [...currentSteps, finalStep]);

          return;
        } else if (status.status === 'FAILED') {
          const errorMsg = status.errorMessage || 'Operation failed';
          console.error('❌ Operation failed:', errorMsg);
          this.error.set(errorMsg);
          this.creationMessage.set(errorMsg);

          // Mark last step as error
          const steps = this.creationSteps();
          if (steps.length > 0) {
            const lastStep = steps.at(-1)!;
            if (lastStep.status === 'running') {
              this.updateCreationStep(lastStep.id, {
                status: 'error',
                details: errorMsg,
              });
            }
          }

          return;
        } else {
          // Continue polling
          setTimeout(() => poll(), POLL_INTERVAL);
        }
      } catch (error: any) {
        console.error('❌ Error polling operation status:', error);
        setTimeout(() => poll(), POLL_INTERVAL);
      }
    };

    // Start polling
    poll();
  }

  /**
   * Add or update dynamic step based on API structure
   * Handles steps that may have been pre-created by syncStepsFromMetadata()
   */
  private addDynamicStep(
    currentStepId: string,
    stepDescription: string,
    currentStepIndex: number,
    totalSteps: number,
    currentStepProgress: number,
    overallProgress: number
  ): void {
    if (!currentStepId || currentStepId.trim() === '') return;

    // Check if step already exists (might be created by syncStepsFromMetadata)
    const existingSteps = this.creationSteps();
    const existingStep = existingSteps.find(s => s.id === currentStepId);

    if (existingStep) {
      // Step exists, just update if running
      if (existingStep.status === 'running') {
        this.updateCreationStep(existingStep.id, {
          description: `Step ${currentStepIndex + 1} of ${totalSteps}`,
          title: stepDescription || existingStep.title,
        });
      }
      return;
    }

    // Check if this is a new step we haven't seen before
    if (!this.stepMessages.has(currentStepId)) {
      this.stepMessages.add(currentStepId);

      // Complete previous running step
      if (existingSteps.length > 0) {
        const lastStep = existingSteps.at(-1)!;
        if (lastStep.status === 'running') {
          this.updateCreationStep(lastStep.id, {
            status: 'completed',
            completedAt: new Date(),
          });
        }
      }

      // Create new running step
      const newStep: ClusterCreationStep = {
        id: currentStepId,
        title: stepDescription || currentStepId,
        description: `Step ${currentStepIndex + 1} of ${totalSteps}`,
        status: 'running',
        startedAt: new Date(),
      };

      this.creationSteps.update((currentSteps) => [...currentSteps, newStep]);
      console.log(
        `📝 Created step [${currentStepIndex + 1}/${totalSteps}]: ${stepDescription} (${currentStepProgress}%)`
      );
    }
  }

  /**
   * Update a specific creation step
   */
  private updateCreationStep(
    stepId: string,
    updates: Partial<ClusterCreationStep>
  ): void {
    this.creationSteps.update((steps) =>
      steps.map((step) => (step.id === stepId ? { ...step, ...updates } : step))
    );
  }

  /**
   * Get overall progress percentage
   */
  getOverallProgress(): number {
    const op = this.operationStatus();
    if (!op) return 0;

    if (op.status === 'FAILED') {
      return op.progress || 0;
    }

    const operationSteps = op.metadata?.operationSteps;
    const currentStepIndex = op.currentStepIndex || 0;

    if (!operationSteps || operationSteps.length === 0) {
      return op.progress || 0;
    }

    // Calculate weight completed
    let completedWeight = 0;
    for (let i = 0; i < currentStepIndex; i++) {
      completedWeight += operationSteps[i].weight;
    }

    // Add partial progress of current step
    const currentStepProgress = this.getCurrentStepProgress();
    if (currentStepIndex < operationSteps.length) {
      const currentWeight = operationSteps[currentStepIndex].weight;
      completedWeight += (currentStepProgress / 100) * currentWeight;
    }

    return Math.min(Math.round(completedWeight), 100);
  }

  /**
   * Get current step progress percentage
   * Uses time-based simulation capped at 90%, or API value if >= 90%
   */
  getCurrentStepProgress(): number {
    const op = this.operationStatus();
    if (!op) return 0;

    if (op.status === 'FAILED') {
      return op.currentStepProgress || 0;
    }

    // If API provides progress >= 90%, use it (step completing/completed)
    const apiProgress = op.currentStepProgress || 0;
    if (apiProgress >= 90) {
      return apiProgress;
    }

    // Otherwise, use time-based simulated progress (capped at 90%)
    const simulated = this.getSimulatedStepProgress();

    // Use whichever is higher (API or simulated), but still cap at 90
    return Math.min(Math.max(apiProgress, simulated), 90);
  }

  /**
   * Calculate simulated step progress based on elapsed time
   * Returns progress capped at 90% until API confirms completion
   */
  private getSimulatedStepProgress(): number {
    const op = this.operationStatus();
    if (!op?.startedAt) return 0;

    // Get estimated total duration from metadata or root level
    const estimatedTotal = op.metadata?.estimatedDurationInSeconds || op.estimatedDurationInSeconds || 0;
    if (estimatedTotal === 0) return 0;

    const currentStepIndex = op.currentStepIndex || 0;
    const operationSteps = op.metadata?.operationSteps || [];

    if (operationSteps.length === 0) return 0;
    if (currentStepIndex >= operationSteps.length) return 0;

    // Calculate time spent on previous steps
    let previousStepsTime = 0;
    for (let i = 0; i < currentStepIndex; i++) {
      const stepWeight = operationSteps[i].weight / 100;
      previousStepsTime += estimatedTotal * stepWeight;
    }

    // Current step estimated duration
    const currentStep = operationSteps[currentStepIndex];
    const stepWeight = currentStep.weight / 100;
    const stepDuration = estimatedTotal * stepWeight;

    if (stepDuration === 0) return 0;

    // Elapsed time for current step
    const now = Date.now();
    const started = new Date(op.startedAt).getTime();
    const totalElapsed = (now - started) / 1000; // seconds
    const stepElapsed = Math.max(0, totalElapsed - previousStepsTime);

    // Progress percentage for current step
    const progress = (stepElapsed / stepDuration) * 100;

    // Cap at 90% - let API push to 100%
    return Math.min(Math.round(progress), 90);
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.error.set(null);
  }
}
