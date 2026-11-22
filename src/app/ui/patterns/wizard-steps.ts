import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { FlIcon } from '../primitives/icon';

export interface WizardStep {
  readonly name: string;
  readonly summary?: string;
}

@Component({
  selector: 'fl-wizard-steps',
  imports: [FlIcon],
  providers: [provideIcons({ lucideCheck })],
  template: `
    <ol class="fl-steps">
      @for (step of steps(); track step.name; let i = $index) {
        <li
          class="fl-step"
          [class.is-done]="i < current()"
          [attr.aria-current]="i === current() ? 'step' : null"
        >
          <span class="fl-step__num">
            @if (i < current()) {
              <fl-icon name="lucideCheck" [size]="13" />
            } @else {
              {{ i + 1 }}
            }
          </span>
          <span class="fl-step__text">
            <span class="fl-step__kicker">Step {{ i + 1 }}</span>
            @if (i < current()) {
              <button
                type="button"
                class="fl-step__name fl-link text-left"
                (click)="stepSelect.emit(i)"
              >
                {{ step.name }}
              </button>
              @if (step.summary) {
                <span class="fl-step__detail">{{ step.summary }}</span>
              }
            } @else {
              <span class="fl-step__name">{{ step.name }}</span>
            }
          </span>
        </li>
      }
    </ol>
  `,
})
export class FlWizardSteps {
  readonly steps = input.required<readonly WizardStep[]>();
  readonly current = input.required<number>();
  readonly stepSelect = output<number>();
}
