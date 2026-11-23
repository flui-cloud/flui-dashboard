import { Component, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideBookOpen, lucideChevronDown, lucideChevronRight } from '@ng-icons/lucide';
import { MarkdownComponent } from 'ngx-markdown';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import {
  AgentMessage,
  AgentToolStep,
  LogSourcesResult,
  UiAction,
} from '../../service/assistant.service';
import { AssistantOperationProgressComponent } from './assistant-operation-progress.component';
import { AssistantToolResultComponent } from './assistant-tool-result.component';
import { AssistantStepList } from './assistant-step-list';

@Component({
  selector: 'app-assistant-message',
  imports: [
    MarkdownComponent,
    FlButton,
    FlIcon,
    AssistantOperationProgressComponent,
    AssistantToolResultComponent,
    AssistantStepList,
  ],
  providers: [provideIcons({ lucideBookOpen, lucideChevronDown, lucideChevronRight })],
  host: { class: 'flex min-w-0 flex-col gap-1' },
  template: `
    <span class="text-fl-caption text-fl-ink-muted">
      {{ message().role === 'user' ? 'You' : 'Flui Assistant' }}
    </span>
    @if (message().role === 'user') {
      <p class="whitespace-pre-wrap break-words text-fl-body-sm text-fl-ink">
        {{ message().content }}
      </p>
    } @else {
      <markdown
        class="md break-words text-fl-body-sm text-fl-ink"
        [data]="message().content"
        (ready)="markdownReady.emit()"
      />
      @if (message().docLinks?.length) {
        <div class="fl-row mt-1">
          @for (link of message().docLinks; track link.url) {
            <a
              class="fl-link inline-flex items-center gap-1 text-fl-body-sm"
              [href]="link.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <fl-icon name="lucideBookOpen" [size]="14" />
              {{ link.title }}
            </a>
          }
        </div>
      }
      @let stepList = message().steps;
      @let logSrcs = logSourcesForSteps(stepList);
      @for (step of stepsWithResult(stepList); track step.toolCallId) {
        <app-assistant-tool-result
          [step]="step"
          [logSources]="logSrcs"
          (sendMessage)="sendMessage.emit($event)"
        />
      }
      @if (stepList && stepList.length > 0) {
        <div class="flex flex-col items-start gap-1">
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [attr.aria-expanded]="stepsExpanded()"
            (click)="stepsExpanded.set(!stepsExpanded())"
          >
            <fl-icon [name]="stepsExpanded() ? 'lucideChevronDown' : 'lucideChevronRight'" />
            {{ stepList.length }} tool{{ stepList.length === 1 ? '' : 's' }} used
          </button>
          @if (stepsExpanded()) {
            <app-assistant-step-list class="w-full" [steps]="stepList" />
          }
        </div>
      }
      @if (message().uiActions?.length) {
        <div class="fl-row mt-1">
          @for (action of message().uiActions; track action.label) {
            @if (action.kind !== 'open_url' || action.url) {
              <button flButton size="sm" type="button" (click)="executeUiAction(action)">
                {{ action.label }}
              </button>
            }
          }
        </div>
      }
      @if (message().operationPending?.length) {
        <div class="flex flex-col gap-2">
          @for (op of message().operationPending; track op.operationId) {
            <app-assistant-operation-progress [operationId]="op.operationId" [label]="op.label" />
          }
        </div>
      }
    }
  `,
})
export class AssistantMessageComponent {
  readonly message = input.required<AgentMessage>();
  readonly imgOk = input(true);

  readonly imgError = output<void>();
  readonly sendMessage = output<string>();
  readonly markdownReady = output<void>();

  protected readonly stepsExpanded = signal(false);

  protected stepsWithResult(steps: AgentToolStep[] | undefined): AgentToolStep[] {
    if (!steps) return [];
    const withResult = steps.filter((s) => s.result != null);

    const lastIdxByKey = new Map<string, number>();
    withResult.forEach((s, i) => {
      if (s.name === 'app_logs') lastIdxByKey.set(this.appLogsKey(s), i);
    });

    return withResult.filter(
      (s, i) => s.name !== 'app_logs' || lastIdxByKey.get(this.appLogsKey(s)) === i,
    );
  }

  protected logSourcesForSteps(steps: AgentToolStep[] | undefined): LogSourcesResult | null {
    const src = steps?.find((s) => s.name === 'log_sources' && s.result != null);
    return src ? (src.result as LogSourcesResult) : null;
  }

  protected executeUiAction(action: UiAction): void {
    if (action.kind === 'open_url') {
      if (!action.url) return;
      window.open(action.url, '_blank', 'noopener,noreferrer');
      return;
    }
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action.url;
    form.target = '_blank';
    form.style.display = 'none';
    for (const [name, value] of Object.entries(action.fields)) {
      const i = document.createElement('input');
      i.type = 'hidden';
      i.name = name;
      i.value = value;
      form.appendChild(i);
    }
    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  private appLogsKey(step: AgentToolStep): string {
    const res = step.result as { app?: string; namespace?: string; cluster_id?: string };
    return `${res.app ?? ''}\x00${res.namespace ?? ''}\x00${res.cluster_id ?? ''}`;
  }
}
