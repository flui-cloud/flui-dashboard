import { Component, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBot } from '@ng-icons/lucide';
import { MarkdownComponent } from 'ngx-markdown';
import { AgentMessage, AgentToolStep, LogSourcesResult, UiAction } from '../../service/assistant.service';
import { AssistantOperationProgressComponent } from './assistant-operation-progress.component';
import { AssistantToolResultComponent } from './assistant-tool-result.component';

@Component({
  selector: 'app-assistant-message',
  standalone: true,
  imports: [NgIcon, MarkdownComponent, AssistantOperationProgressComponent, AssistantToolResultComponent],
  providers: [provideIcons({ lucideBot })],
  styles: [':host { display: contents; }'],
  template: `
    <div class="flex gap-2" [class.flex-row-reverse]="message().role === 'user'">
      @if (message().role !== 'user') {
        <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 mt-0.5">
          @if (imgOk()) {
            <img src="icons/assistant.png" class="h-4 w-4 object-contain" alt="" (error)="imgError.emit()" />
          } @else {
            <ng-icon name="lucideBot" class="h-3.5 w-3.5 text-blue-500" />
          }
        </div>
      }
      <div class="flex flex-col min-w-0 flex-1" [class.items-end]="message().role === 'user'">
        @if (message().role === 'user') {
          <div class="md-user-bubble w-fit max-w-[78%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm shadow-sm bg-gradient-to-br from-blue-500 to-blue-700 text-white">
            <p class="whitespace-pre-wrap break-words leading-relaxed">{{ message().content }}</p>
          </div>
        } @else {
          <div class="w-fit max-w-[82%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm shadow-sm bg-muted text-foreground border border-border/50">
            <markdown class="md leading-relaxed break-words" [data]="message().content" (ready)="markdownReady.emit()" />
          </div>
          @if (message().docLinks?.length) {
            <div class="mt-2 flex flex-wrap gap-1.5">
              @for (link of message().docLinks; track link.url) {
                <a [href]="link.url" target="_blank" rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted transition-colors">
                  📖 {{ link.title }}
                </a>
              }
            </div>
          }
          @let stepList = message().steps;
          @let logSrcs = logSourcesForSteps(stepList);
          @for (step of stepsWithResult(stepList); track step.toolCallId) {
            <app-assistant-tool-result [step]="step" [logSources]="logSrcs" (sendMessage)="sendMessage.emit($event)" />
          }
          @if (stepList && stepList.length > 0) {
            <div class="mt-1 ml-0.5">
              <button type="button" (click)="stepsExpanded.set(!stepsExpanded())"
                class="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                {{ stepsExpanded() ? '▾' : '▸' }} {{ stepList.length }} tool{{ stepList.length === 1 ? '' : 's' }} used
              </button>
              @if (stepsExpanded()) {
                <div class="mt-1 rounded-lg bg-muted/50 border border-border/40 px-2.5 py-2 font-mono text-[11px] space-y-1">
                  @for (step of stepList; track step.toolCallId) {
                    <div class="flex items-start gap-2"
                      [class]="step.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'">
                      <span class="shrink-0">{{ step.ok ? '✓' : '✗' }}</span>
                      <span>{{ step.name }}</span>
                      @if (!step.ok && step.error) {
                        <span class="text-muted-foreground">— {{ step.error }}</span>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
          @if (message().uiActions?.length) {
            <div class="mt-2 flex flex-wrap gap-2">
              @for (action of message().uiActions; track action.label) {
                @if (action.kind !== 'open_url' || action.url) {
                  <button type="button" (click)="executeUiAction(action)"
                    class="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors">
                    {{ action.label }}
                  </button>
                }
              }
            </div>
          }
          @if (message().operationPending?.length) {
            <div class="w-full max-w-[82%]">
              @for (op of message().operationPending; track op.operationId) {
                <app-assistant-operation-progress [operationId]="op.operationId" [label]="op.label" />
              }
            </div>
          }
        }
      </div>
    </div>
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

    return withResult.filter((s, i) => s.name !== 'app_logs' || lastIdxByKey.get(this.appLogsKey(s)) === i);
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
