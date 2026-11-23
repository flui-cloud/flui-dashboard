import { Component, input, output, computed } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlPanel } from '../../../ui/patterns/panel';
import { WizardStepperStep } from '../wizard-stepper/wizard-stepper.component';

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

@Component({
  selector: 'app-wizard-shell',
  imports: [FlButton, FlIcon, FlPanel],
  providers: [provideIcons({ lucideCheck, lucideChevronLeft, lucideChevronRight })],
  template: `
    <div class="fl-page">
      <div class="flex flex-col gap-1">
        <h1 class="m-0 text-fl-page-title text-fl-ink">{{ wizardTitle() }}</h1>
        <p class="m-0 hidden text-fl-body-sm text-fl-ink-muted sm:block">
          {{ wizardDescription() }}
        </p>
      </div>

      <div class="fl-wizard">
        <ol class="fl-steps">
          @for (step of stepperSteps(); track step.id; let i = $index) {
            <li
              class="fl-step"
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
              <span class="fl-step__text">
                <span class="fl-step__kicker">Step {{ i + 1 }}</span>
                <span class="fl-step__name">{{ step.title }}</span>
                @if (step.isCompleted) {
                  <span class="fl-sr">Completed</span>
                }
              </span>
            </li>
          }
        </ol>

        <div class="fl-stack">
          <fl-panel [title]="currentStep().title">
            <div class="fl-stack">
              @if (currentStep().description) {
                <p class="m-0 text-fl-body-sm text-fl-ink-muted">{{ currentStep().description }}</p>
              }
              <ng-content />
            </div>
          </fl-panel>

          <div class="fl-wizard__footer">
            @if (showCancelButton()) {
              <button flButton="ghost" type="button" (click)="onCancel()">Cancel</button>
            }
            @if (currentStepIndex() > 0) {
              <button flButton type="button" (click)="onPrevious()">
                <fl-icon name="lucideChevronLeft" />
                Previous
              </button>
            }
            @if (!isLastStep()) {
              <button
                flButton="primary"
                type="button"
                [disabled]="!currentStep().isValid"
                (click)="onNext()"
              >
                Next
                <fl-icon name="lucideChevronRight" />
              </button>
            } @else {
              <button
                flButton="primary"
                type="button"
                [disabled]="!canCreate()"
                (click)="onCreate()"
              >
                {{ createButtonText() }}
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class WizardShellComponent {
  readonly wizardTitle = input.required<string>();
  readonly wizardDescription = input.required<string>();
  readonly steps = input.required<WizardStep[]>();
  readonly currentStepIndex = input.required<number>();
  readonly createButtonText = input<string>('Create');
  readonly showCancelButton = input<boolean>(true);

  readonly next = output<void>();
  readonly previous = output<void>();
  readonly cancelled = output<void>();
  readonly create = output<void>();

  readonly currentStep = computed(() => this.steps()[this.currentStepIndex()]);
  readonly isLastStep = computed(() => this.currentStepIndex() === this.steps().length - 1);
  readonly canCreate = computed(() => {
    const lastStep = this.steps()[this.steps().length - 1];
    return lastStep?.isValid || false;
  });

  readonly stepperSteps = computed<WizardStepperStep[]>(() =>
    this.steps().map((step) => ({
      id: step.id,
      title: step.title,
      icon: step.icon,
      isValid: step.isValid,
      isCompleted: step.isCompleted,
    })),
  );

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
}
