import { Component, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideAlertCircle, lucideSend } from '@ng-icons/lucide';
import { AssistantChatService } from '../../service/assistant.service';
import { AssistantModelSelectionService } from '../../service/assistant-model-selection.service';
import { AssistantModelPickerComponent } from './assistant-model-picker.component';

@Component({
  selector: 'app-assistant-composer',
  standalone: true,
  imports: [NgIcon, AssistantModelPickerComponent],
  providers: [provideIcons({ lucideAlertCircle, lucideSend })],
  template: `
    <div class="space-y-2" [class.mx-auto]="fullscreen()" [class.max-w-3xl]="fullscreen()" [class.w-full]="fullscreen()">
      @if (chatService.destructiveEnabled()) {
        <div class="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-1.5">
          <ng-icon name="lucideAlertCircle" class="h-3.5 w-3.5 shrink-0 text-destructive" />
          <p class="text-[11px] text-destructive leading-tight">
            Destructive actions (delete/uninstall) are enabled on this server — they still ask for confirmation, but proceed with care.
          </p>
        </div>
      }
      @if (chatService.contextLong()) {
        <div class="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5">
          <p class="text-[11px] text-amber-700 dark:text-amber-400 leading-tight">
            Long conversation — responses may degrade
          </p>
          <button type="button" (click)="chatService.newConversation()"
            class="shrink-0 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap">
            New chat →
          </button>
        </div>
      }
      <div class="rounded-2xl border border-input bg-muted/50 transition-shadow focus-within:ring-1 focus-within:ring-ring">
        <textarea
          [value]="draft()"
          (input)="onDraftInput($event)"
          (keydown)="onKeydown($event)"
          [disabled]="chatService.sending()"
          rows="1"
          placeholder="Ask Flui Assistant…"
          class="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 min-h-[44px] max-h-[180px]"
        ></textarea>
        <div class="flex items-center justify-between gap-2 px-2 pb-2">
          <app-assistant-model-picker (navigated)="navigated.emit()" />
          <button type="button" (click)="submit()"
            [disabled]="chatService.sending() || !draft().trim()"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-500/30 transition-all hover:shadow-blue-500/40 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100">
            <ng-icon name="lucideSend" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AssistantComposerComponent {
  protected readonly chatService = inject(AssistantChatService);
  private readonly sel = inject(AssistantModelSelectionService);

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
