import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideTrash2 } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

export interface ConversationSummary {
  id: string;
  title: string;
  messages: unknown[];
}

@Component({
  selector: 'app-assistant-conversation-list',
  imports: [FlButton, FlIcon],
  providers: [provideIcons({ lucideTrash2 })],
  host: { class: 'block' },
  template: `
    <ul class="divide-y divide-fl-border-subtle">
      @for (conv of conversations(); track conv.id) {
        <li
          class="flex items-center gap-2 pr-3 hover:bg-fl-surface-hover"
          [class.bg-fl-accent-row]="conv.id === activeId()"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 flex-col px-4 py-2 text-left"
            [attr.aria-current]="conv.id === activeId() ? 'true' : null"
            (click)="selected.emit(conv.id)"
          >
            <span class="truncate text-fl-body-sm font-medium text-fl-ink">{{ conv.title }}</span>
            <span class="text-fl-caption text-fl-ink-muted">
              {{ conv.messages.length }} {{ conv.messages.length === 1 ? 'message' : 'messages' }}
            </span>
          </button>
          <button
            flButton="ghost"
            size="sm"
            [iconOnly]="true"
            type="button"
            [attr.aria-label]="'Delete ' + conv.title"
            (click)="removed.emit(conv.id)"
          >
            <fl-icon name="lucideTrash2" />
          </button>
        </li>
      }
    </ul>
  `,
})
export class AssistantConversationList {
  readonly conversations = input.required<ConversationSummary[]>();
  readonly activeId = input<string | null>(null);
  readonly selected = output<string>();
  readonly removed = output<string>();
}
