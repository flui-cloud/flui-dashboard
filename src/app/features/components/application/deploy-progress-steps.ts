import { Component, input } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlStatus } from '../../../ui/primitives/status';
import { DeploymentStep } from '../../model/application.models';
import { stepElapsed, stepState } from './deploy-progress-model';

@Component({
  selector: 'app-deploy-progress-steps',
  imports: [FlPanel, FlStatus],
  template: `
    <fl-panel title="Steps" [flush]="true">
      <span panelActions class="fl-num text-fl-body-sm text-fl-ink-muted">
        {{ completedCount() }} of {{ steps().length }} completed
      </span>
      <ol class="m-0 list-none p-0">
        @for (step of steps(); track step.id) {
          @let state = stateOf(step);
          <li
            class="flex flex-col gap-2 border-b border-fl-border-subtle px-4 py-3 last:border-b-0"
            [attr.aria-current]="step.status === 'running' ? 'step' : null"
          >
            <div class="flex items-start gap-4">
              <div class="min-w-0 flex-1">
                <p
                  class="m-0 text-fl-body font-medium"
                  [class.text-fl-ink]="step.status !== 'pending'"
                  [class.text-fl-ink-muted]="step.status === 'pending'"
                >
                  {{ step.name }}
                </p>
                <p class="m-0 text-fl-caption text-fl-ink-muted">{{ step.description }}</p>
              </div>
              <fl-status class="w-24" [tone]="state.tone" [label]="state.label" />
              <span class="fl-mono fl-num w-16 text-right text-fl-ink-muted">{{
                elapsedOf(step)
              }}</span>
            </div>
            @if (step.status === 'running' && detail()) {
              <p
                class="fl-mono m-0 whitespace-pre-wrap break-all rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3 text-fl-ink-secondary"
              >
                {{ detail() }}
              </p>
            }
          </li>
        }
      </ol>
    </fl-panel>
  `,
})
export class DeployProgressSteps {
  readonly steps = input.required<readonly DeploymentStep[]>();
  readonly now = input.required<number>();
  readonly detail = input<string | null>(null);

  protected completedCount(): number {
    return this.steps().filter((s) => s.status === 'completed').length;
  }

  protected stateOf(step: DeploymentStep) {
    return stepState(step.status);
  }

  protected elapsedOf(step: DeploymentStep): string {
    return stepElapsed(step, this.now());
  }
}
