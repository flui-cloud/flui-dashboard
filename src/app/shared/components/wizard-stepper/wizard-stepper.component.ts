import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { FlIcon } from '../../../ui/primitives/icon';

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

@Component({
  selector: 'app-wizard-stepper',
  imports: [FlIcon],
  providers: [provideIcons({ lucideCheck })],
  template: `
    <ol class="m-0 flex list-none items-center gap-3 p-0">
      @for (step of steps(); track step.id; let i = $index; let isLast = $last) {
        <li
          class="fl-step items-center"
          [class.flex-1]="!isLast"
          [class.is-done]="step.isCompleted"
          [attr.aria-current]="i === currentStepIndex() ? 'step' : null"
        >
          <span class="fl-step__num">
            @if (step.isCompleted) {
              <fl-icon name="lucideCheck" [size]="13" />
            } @else {
              {{ i + 1 }}
            }
          </span>
          @if (allowStepClick() && canNavigateToStep(i)) {
            <button type="button" class="fl-step__name whitespace-nowrap" (click)="onStepClick(i)">
              {{ step.title }}
            </button>
          } @else {
            <span class="fl-step__name whitespace-nowrap">{{ step.title }}</span>
          }
          @if (step.isCompleted) {
            <span class="fl-sr">Completed</span>
          }
          @if (!isLast) {
            <span
              class="h-px min-w-4 flex-1"
              [class]="step.isCompleted ? 'bg-fl-accent' : 'bg-fl-border'"
              aria-hidden="true"
            ></span>
          }
        </li>
      }
    </ol>
  `,
})
export class WizardStepperComponent {
  readonly steps = input.required<WizardStepperStep[]>();
  readonly currentStepIndex = input.required<number>();
  readonly allowStepClick = input<boolean>(false);

  readonly stepClicked = output<number>();

  onStepClick(stepIndex: number): void {
    if (this.allowStepClick() && this.canNavigateToStep(stepIndex)) {
      this.stepClicked.emit(stepIndex);
    }
  }

  canNavigateToStep(stepIndex: number): boolean {
    const step = this.steps()[stepIndex];
    return step?.isCompleted || stepIndex === this.currentStepIndex();
  }
}
