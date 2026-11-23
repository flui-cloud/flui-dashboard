import { Component, input } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { AgentToolStep } from '../../service/assistant.service';
import { AssistantStepList } from './assistant-step-list';

@Component({
  selector: 'app-assistant-streaming-row',
  imports: [MarkdownComponent, FlSpinner, FlStatus, AssistantStepList],
  host: { class: 'flex min-w-0 flex-col gap-1' },
  template: `
    <span class="text-fl-caption text-fl-ink-muted">Flui Assistant</span>
    @if (text() || steps().length) {
      @if (steps().length) {
        <app-assistant-step-list [steps]="steps()" [showErrors]="false" />
      }
      @if (text()) {
        <div class="flex items-end gap-2 text-fl-body-sm text-fl-ink">
          <markdown class="md min-w-0 break-words" [data]="text()" />
          <fl-spinner label="Writing" />
        </div>
      }
    } @else {
      <fl-status tone="progress" label="Thinking" />
    }
  `,
})
export class AssistantStreamingRow {
  readonly text = input('');
  readonly steps = input<AgentToolStep[]>([]);
}
