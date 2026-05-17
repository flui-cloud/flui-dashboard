import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideChevronLeft,
  lucideChevronRight,
  lucideRocket,
} from '@ng-icons/lucide';
import { WizardStepperComponent, WizardStepperStep } from '../wizard-stepper/wizard-stepper.component';

/**
 * Wizard Step Definition
 */
export interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  isValid: boolean;
  isCompleted: boolean;
}

/**
 * Wizard Shell Component
 *
 * Reusable wizard wrapper providing:
 * - Progress stepper with icons
 * - Step navigation (Previous/Next/Create)
 * - Header with title and description
 * - Content projection for step content
 *
 * Used by:
 * - Cluster Creation Wizard
 * - Build Agent Wizard
 * - Future wizards (Load Balancer, Database, etc.)
 */
@Component({
  selector: 'app-wizard-shell',
  standalone: true,
  imports: [CommonModule, NgIconComponent, WizardStepperComponent],
  providers: [
    provideIcons({
      lucideCheck,
      lucideChevronLeft,
      lucideChevronRight,
      lucideRocket,
    }),
  ],
  template: `
    <div class="bg-background">
      <div class="container mx-auto px-4 py-4">
        <!-- Wizard Header -->
        <div class="mb-4 flex items-baseline gap-3">
          <h1 class="text-xl font-bold text-slate-900 dark:text-white">
            {{ wizardTitle() }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
            {{ wizardDescription() }}
          </p>
        </div>

        <!-- Progress Stepper -->
        <div class="mb-4">
          <app-wizard-stepper
            [steps]="stepperSteps()"
            [currentStepIndex]="currentStepIndex()"
            [allowStepClick]="false"
          />
        </div>

        <!-- Step Content Card -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5 mb-4">
          <!-- Current Step Header -->
          <div class="mb-4">
            <h2 class="text-base font-semibold text-slate-900 dark:text-white">
              {{ currentStep().title }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {{ currentStep().description }}
            </p>
          </div>

          <!-- Step Content (projected) -->
          <ng-content></ng-content>
        </div>

        <!-- Navigation Buttons -->
        <div class="flex items-center justify-between">
          <button
            *ngIf="currentStepIndex() > 0"
            (click)="onPrevious()"
            class="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <ng-icon name="lucideChevronLeft" size="16"></ng-icon>
            <span>Previous</span>
          </button>

          <div *ngIf="currentStepIndex() === 0"></div>

          <div class="flex items-center gap-3">
            <button
              *ngIf="showCancelButton()"
              (click)="onCancel()"
              class="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              *ngIf="!isLastStep()"
              (click)="onNext()"
              [disabled]="!currentStep().isValid"
              [class]="getNextButtonClass()"
              class="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-all duration-200"
            >
              <span>Next</span>
              <ng-icon name="lucideChevronRight" size="16"></ng-icon>
            </button>

            <button
              *ngIf="isLastStep()"
              (click)="onCreate()"
              [disabled]="!canCreate()"
              [class]="getCreateButtonClass()"
              class="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-all duration-200"
            >
              <ng-icon name="lucideRocket" size="16"></ng-icon>
              <span>{{ createButtonText() }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class WizardShellComponent {
  // === Inputs ===
  readonly wizardTitle = input.required<string>();
  readonly wizardDescription = input.required<string>();
  readonly steps = input.required<WizardStep[]>();
  readonly currentStepIndex = input.required<number>();
  readonly createButtonText = input<string>('Create');
  readonly showCancelButton = input<boolean>(true);

  // === Outputs ===
  readonly next = output<void>();
  readonly previous = output<void>();
  readonly cancelled = output<void>();
  readonly create = output<void>();

  // === Computed ===
  readonly currentStep = computed(() => this.steps()[this.currentStepIndex()]);
  readonly isLastStep = computed(() => this.currentStepIndex() === this.steps().length - 1);
  readonly canCreate = computed(() => {
    const lastStep = this.steps()[this.steps().length - 1];
    return lastStep?.isValid || false;
  });

  // Convert WizardStep to WizardStepperStep (for app-wizard-stepper component)
  readonly stepperSteps = computed<WizardStepperStep[]>(() =>
    this.steps().map(step => ({
      id: step.id,
      title: step.title,
      icon: step.icon,
      isValid: step.isValid,
      isCompleted: step.isCompleted,
    }))
  );

  // === Methods ===

  onNext(): void {
    this.next.emit();
  }

  onPrevious(): void {
    this.previous.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onCreate(): void {
    this.create.emit();
  }

  /**
   * Get CSS class for step circle
   */
  getStepCircleClass(step: WizardStep, index: number): string {
    const isActive = index === this.currentStepIndex();

    if (step.isCompleted) {
      return 'bg-green-500 dark:bg-green-600';
    }

    if (isActive) {
      return 'bg-blue-600 dark:bg-blue-500 ring-4 ring-blue-200 dark:ring-blue-900';
    }

    return 'bg-slate-200 dark:bg-slate-700';
  }

  /**
   * Get CSS class for step icon
   */
  getStepIconClass(index: number): string {
    const isActive = index === this.currentStepIndex();

    if (isActive) {
      return 'text-white';
    }

    return 'text-slate-500 dark:text-slate-400';
  }

  /**
   * Get CSS class for step label
   */
  getStepLabelClass(index: number): string {
    const isActive = index === this.currentStepIndex();

    if (isActive) {
      return 'text-blue-600 dark:text-blue-400';
    }

    return 'text-slate-600 dark:text-slate-400';
  }

  /**
   * Get CSS class for connector line
   */
  getConnectorClass(step: WizardStep): string {
    if (step.isCompleted) {
      return 'bg-green-500 dark:bg-green-600';
    }

    return 'bg-slate-200 dark:bg-slate-700';
  }

  /**
   * Get CSS class for Next button
   */
  getNextButtonClass(): string {
    if (!this.currentStep().isValid) {
      return 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed';
    }

    return 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600';
  }

  /**
   * Get CSS class for Create button
   */
  getCreateButtonClass(): string {
    if (!this.canCreate()) {
      return 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed';
    }

    return 'bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600';
  }
}
