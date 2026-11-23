import { Component, input } from '@angular/core';
import { FlStatus } from '../../../ui/primitives/status';
import { AgentToolStep } from '../../service/assistant.service';

@Component({
  selector: 'app-assistant-step-list',
  imports: [FlStatus],
  host: {
    class:
      'flex flex-col gap-1 rounded-fl-md border border-fl-border-subtle bg-fl-surface-subtle px-3 py-2 font-mono text-fl-mono-sm',
  },
  template: `
    @for (step of steps(); track step.toolCallId) {
      <div class="flex flex-wrap items-center gap-2">
        <fl-status [tone]="step.ok ? 'success' : 'error'" [label]="step.name" />
        @if (showErrors() && !step.ok && step.error) {
          <span class="text-fl-ink-muted">{{ step.error }}</span>
        }
      </div>
    }
  `,
})
export class AssistantStepList {
  readonly steps = input.required<AgentToolStep[]>();
  readonly showErrors = input(true);
}
