import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AssistantService } from '../../core/api/api/assistant.service';
import { ChatCompletionRequestDto } from '../../core/api/model/chatCompletionRequestDto';
import { ChatMessageDto } from '../../core/api/model/chatMessageDto';

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessageDto[];
}

interface StoredState {
  conversations: Conversation[];
  activeId: string;
}

interface ChatCompletionResponse {
  choices: { message: { role: string; content: string }; finish_reason: string | null }[];
}

const STORAGE_KEY = 'flui.assistant.history';
const MAX_STORED_CONVERSATIONS = 30;

@Injectable({ providedIn: 'root' })
export class AssistantChatService {
  private readonly api = inject(AssistantService);
  private _nextId = 1;

  private readonly _conversations = signal<Conversation[]>([
    { id: '1', title: 'New chat', messages: [] },
  ]);
  private readonly _activeId = signal('1');

  readonly conversations = computed(() => this._conversations());
  readonly activeId = computed(() => this._activeId());

  readonly messages = computed(() => {
    const id = this._activeId();
    return this._conversations().find((c) => c.id === id)?.messages ?? [];
  });

  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  readonly contextLong = computed(() => {
    const msgs = this.messages();
    return msgs.length >= 20 || msgs.reduce((s, m) => s + (m.content?.length ?? 0), 0) >= 8000;
  });

  constructor() {
    const saved = this.readStorage();
    if (saved) {
      this._conversations.set(saved.conversations);
      this._activeId.set(saved.activeId);
      this._nextId = Math.max(...saved.conversations.map((c) => Number(c.id) || 0));
    }

    effect(() => {
      const conversations = this._conversations();
      const activeId = this._activeId();
      this.writeStorage({ conversations, activeId });
    });
  }

  newConversation(): void {
    const current = this._conversations().find((c) => c.id === this._activeId());
    if (current?.messages.length === 0) return;
    const id = String(++this._nextId);
    this._conversations.update((cs) => [...cs, { id, title: 'New chat', messages: [] }]);
    this._activeId.set(id);
    this.error.set(null);
  }

  switchTo(id: string): void {
    this._activeId.set(id);
    this.error.set(null);
  }

  clear(): void {
    this.deleteConversation(this._activeId());
  }

  deleteConversation(id: string): void {
    const remaining = this._conversations().filter((c) => c.id !== id);
    const wasActive = this._activeId() === id;
    const newId = String(++this._nextId);

    if (remaining.length === 0 || wasActive) {
      this._conversations.set([...remaining, { id: newId, title: 'New chat', messages: [] }]);
      this._activeId.set(newId);
    } else {
      this._conversations.set(remaining);
    }
    this.error.set(null);
  }

  send(
    content: string,
    opts?: { model?: string; provider?: string; connectionId?: string },
  ): void {
    const userMsg: ChatMessageDto = { role: ChatMessageDto.RoleEnum.User, content };
    const id = this._activeId();

    this._conversations.update((cs) =>
      cs.map((c) => {
        if (c.id !== id) return c;
        const isFirst = c.messages.length === 0;
        return {
          ...c,
          title: isFirst ? content.slice(0, 45) : c.title,
          messages: [...c.messages, userMsg],
        };
      }),
    );

    this.error.set(null);
    this.sending.set(true);

    const body: ChatCompletionRequestDto = {
      messages: this.messages(),
      ...(opts?.model ? { model: opts.model } : {}),
      ...(opts?.provider
        ? { provider: opts.provider as ChatCompletionRequestDto.ProviderEnum }
        : {}),
      ...(opts?.connectionId ? { connectionId: opts.connectionId } : {}),
    };

    this.api.assistantControllerChatCompletions(body).subscribe({
      next: (res: any) => {
        const reply = (res as ChatCompletionResponse).choices?.[0]?.message?.content ?? '';
        this._conversations.update((cs) =>
          cs.map((c) =>
            c.id === id
              ? {
                  ...c,
                  messages: [
                    ...c.messages,
                    { role: ChatMessageDto.RoleEnum.Assistant, content: reply },
                  ],
                }
              : c,
          ),
        );
        this.sending.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.message ?? 'Request failed');
        this.sending.set(false);
      },
    });
  }

  private readStorage(): StoredState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as StoredState;
      if (!Array.isArray(data.conversations) || !data.activeId) return null;
      const activeExists = data.conversations.some((c) => c.id === data.activeId);
      return {
        conversations: data.conversations,
        activeId: activeExists ? data.activeId : data.conversations[0].id,
      };
    } catch {
      return null;
    }
  }

  private writeStorage(state: StoredState): void {
    try {
      const trimmed: StoredState = {
        ...state,
        conversations: state.conversations.slice(-MAX_STORED_CONVERSATIONS),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // localStorage full or unavailable — silently skip
    }
  }
}
