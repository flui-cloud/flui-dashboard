import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';

/**
 * Wizard Step Definition
 */
export interface WizardStepperStep {
  id: string;
  title: string;
  icon: string;
  isValid: boolean;
  isCompleted: boolean;
}

/**
 * Wizard Stepper Component
 *
 * Reusable horizontal stepper component for multi-step wizards.
 * Provides:
 * - Visual progress indicator with icons
 * - Step completion status (completed/active/inactive)
 * - Optional click navigation between steps
 * - Consistent styling across all wizards
 *
 * Used by:
 * - WizardShellComponent
 * - BuildAgentWizardComponent
 * - Future wizards
 *
 * @example
 * ```html
 * <app-wizard-stepper
 *   [steps]="steps()"
 *   [currentStepIndex]="currentStepIndex()"
 *   [allowStepClick]="false"
 *   (stepClicked)="onStepClick($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-wizard-stepper',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideCheck,
    }),
  ],
  template: `
    <div class="flex items-center">
      @for (step of steps(); track step.id; let i = $index; let isLast = $last) {
        <div
          class="flex items-center"
          [class.flex-1]="!isLast"
        >
          <!-- Step Circle -->
          <div
            class="flex flex-col items-center"
            [class.cursor-pointer]="allowStepClick() && canNavigateToStep(i)"
            (click)="onStepClick(i)"
          >
            <div
              [class]="getStepCircleClass(step, i)"
              class="flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200"
            >
              <ng-icon
                *ngIf="step.isCompleted"
                name="lucideCheck"
                size="20"
                class="text-white"
              ></ng-icon>
              <ng-icon
                *ngIf="!step.isCompleted"
                [name]="step.icon"
                size="20"
                [class]="getStepIconClass(i)"
              ></ng-icon>
            </div>
            <span
              [class]="getStepLabelClass(i)"
              class="mt-2 text-sm font-medium transition-colors duration-200"
            >
              {{ step.title }}
            </span>
          </div>

          <!-- Connector Line -->
          @if (!isLast) {
            <div
              [class]="getConnectorClass(step)"
              class="mx-4 h-1 flex-1 transition-all duration-200"
            ></div>
          }
        </div>
      }
    </div>
  `,
  styles: [],
})
export class WizardStepperComponent {
  // === Inputs ===
  readonly steps = input.required<WizardStepperStep[]>();
  readonly currentStepIndex = input.required<number>();
  readonly allowStepClick = input<boolean>(false);

  // === Outputs ===
  readonly stepClicked = output<number>();

  // === Methods ===

  /**
   * Handle step click (if enabled)
   */
  onStepClick(stepIndex: number): void {
    if (this.allowStepClick() && this.canNavigateToStep(stepIndex)) {
      this.stepClicked.emit(stepIndex);
    }
  }

  /**
   * Check if user can navigate to a specific step
   * (only to completed steps or current step)
   */
  canNavigateToStep(stepIndex: number): boolean {
    const step = this.steps()[stepIndex];
    return step?.isCompleted || stepIndex === this.currentStepIndex();
  }

  /**
   * Get CSS class for step circle
   */
  getStepCircleClass(step: WizardStepperStep, index: number): string {
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
  getConnectorClass(step: WizardStepperStep): string {
    if (step.isCompleted) {
      return 'bg-green-500 dark:bg-green-600';
    }

    return 'bg-slate-200 dark:bg-slate-700';
  }
}
