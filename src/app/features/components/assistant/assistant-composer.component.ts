import { Component, computed, inject, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideSend } from '@ng-icons/lucide';
import { SandboxService } from '../../../core/services/sandbox.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { AssistantChatService } from '../../service/assistant.service';
import { AssistantModelSelectionService } from '../../service/assistant-model-selection.service';

@Component({
  selector: 'app-assistant-composer',
  imports: [FlAlert, FlButton, FlIcon],
  providers: [provideIcons({ lucideSend })],
  template: `
    <div
      class="flex flex-col gap-2"
      [class.mx-auto]="fullscreen()"
      [class.max-w-3xl]="fullscreen()"
      [class.w-full]="fullscreen()"
    >
      @if (destructiveNotice()) {
        <fl-alert
          tone="warning"
          title="Destructive actions are enabled"
          data-testid="assistant-destructive-notice"
        >
          Delete and uninstall are enabled on this server. They still ask for confirmation, so
          proceed with care.
        </fl-alert>
      }
      @if (chatService.contextLong()) {
        <fl-alert tone="info" title="Long conversation">
          Responses may degrade.
          <button
            alertActions
            flButton="ghost"
            size="sm"
            type="button"
            (click)="chatService.newConversation()"
          >
            New chat
          </button>
        </fl-alert>
      }
      <div class="flex items-end gap-2">
        <textarea
          class="fl-textarea max-h-44 min-h-0"
          rows="2"
          aria-label="Message"
          placeholder="Ask Flui Assistant"
          [value]="draft()"
          (input)="onDraftInput($event)"
          (keydown)="onKeydown($event)"
          [disabled]="chatService.sending()"
        ></textarea>
        <button
          flButton="primary"
          [iconOnly]="true"
          type="button"
          aria-label="Send"
          (click)="submit()"
          [disabled]="chatService.sending() || !draft().trim()"
        >
          <fl-icon name="lucideSend" />
        </button>
      </div>
    </div>
  `,
})
export class AssistantComposerComponent {
  protected readonly chatService = inject(AssistantChatService);
  private readonly sel = inject(AssistantModelSelectionService);
  private readonly sandbox = inject(SandboxService);

  protected readonly destructiveNotice = computed(
    () => this.chatService.destructiveEnabled() && !this.sandbox.inSandbox(),
  );

  readonly fullscreen = input(false);
  readonly sent = output<void>();
  readonly navigated = output<void>();

  protected readonly draft = signal('');
  private historyIdx = -1;

  protected onDraftInput(e: Event): void {
    this.draft.set((e.target as HTMLTextAreaElement).value);
  }

  protected onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.submit();
    } else if (e.key === 'ArrowUp') {
      this.historyOlder(e);
    } else if (e.key === 'ArrowDown') {
      this.historyNewer(e);
    }
  }

  protected submit(): void {
    const content = this.draft().trim();
    if (!content || this.chatService.sending()) return;
    this.draft.set('');
    this.historyIdx = -1;
    this.chatService.send(content, this.sel.selectedOpts() ?? undefined);
    this.sent.emit();
  }

  private userHistory(): string[] {
    return this.chatService
      .messages()
      .filter((m) => m.role === 'user' && m.content)
      .map((m) => m.content ?? '');
  }

  private historyOlder(e: KeyboardEvent): void {
    if (this.historyIdx === -1 && this.draft().trim()) return;
    const msgs = this.userHistory();
    const idx = this.historyIdx + 1;
    if (idx >= msgs.length) return;
    e.preventDefault();
    this.historyIdx = idx;
    this.draft.set(msgs[msgs.length - 1 - idx]);
    this.moveCaretToEnd(e.target as HTMLTextAreaElement);
  }

  private historyNewer(e: KeyboardEvent): void {
    if (this.historyIdx < 0) return;
    e.preventDefault();
    const idx = this.historyIdx - 1;
    if (idx < 0) {
      this.historyIdx = -1;
      this.draft.set('');
      return;
    }
    const msgs = this.userHistory();
    this.historyIdx = idx;
    this.draft.set(msgs[msgs.length - 1 - idx]);
  }

  private moveCaretToEnd(ta: HTMLTextAreaElement): void {
    setTimeout(() => {
      if (ta.isConnected) ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  }
}
