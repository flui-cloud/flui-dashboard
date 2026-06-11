import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Configuration } from '../../core/api';
import { AssistantService } from '../../core/api/api/assistant.service';
import { AgentRequestDto } from '../../core/api/model/agentRequestDto';
import { AuthService } from '../../core/services/auth.service';

type AgentStreamEvent =
  | { type: 'delta'; text?: string }
  | { type: 'step'; step?: AgentToolStep }
  | { type: 'done'; result: AgentResult }
  | { type: 'error'; message?: string };

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
  steps?: AgentToolStep[];
  uiActions?: UiAction[];
  operationPending?: OperationPending[];
  docLinks?: DocLink[];
}

export interface DocLink {
  title: string;
  url: string;
}

export interface AgentToolStep {
  toolCallId: string;
  name: string;
  ok: boolean;
  error?: string;
  result?: unknown;
}

export interface PendingAction {
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  tier: 'write' | 'destructive';
  label?: string;
  groupKey?: string;
}

export interface LogSourcesResult {
  apps: string[];
  namespaces: string[];
}

export type UiAction =
  | { kind: 'open_url'; url?: string; label: string }
  | { kind: 'submit_form'; url: string; fields: Record<string, string>; label: string };

export interface OperationPending {
  operationId: string;
  label: string;
  name: string;
}

interface AgentResult {
  type: 'message' | 'pending_action';
  content?: string;
  pending?: PendingAction[];
  steps: AgentToolStep[];
  messages: AgentMessage[];
  uiActions?: UiAction[];
  operationPending?: OperationPending[];
  docLinks?: DocLink[];
}

interface Conversation {
  id: string;
  title: string;
  messages: AgentMessage[];
}

interface StoredState {
  conversations: Conversation[];
  activeId: string;
}

const STORAGE_KEY = 'flui.assistant.history';
const MAX_STORED_CONVERSATIONS = 30;

@Injectable({ providedIn: 'root' })
export class AssistantChatService {
  private readonly api = inject(AssistantService);
  private readonly config = inject(Configuration);
  private readonly auth = inject(AuthService);
  private _nextId = 1;
  private _abort: AbortController | null = null;

  private readonly _conversations = signal<Conversation[]>([
    { id: '1', title: 'New chat', messages: [] },
  ]);
  private readonly _activeId = signal('1');
  private readonly _pendingMessages = signal<AgentMessage[]>([]);
  private readonly _pendingOpts = signal<{ model?: string; provider?: string; connectionId?: string } | null>(null);

  readonly conversations = computed(() => this._conversations());
  readonly activeId = computed(() => this._activeId());

  readonly messages = computed(() => {
    const id = this._activeId();
    return this._conversations().find((c) => c.id === id)?.messages ?? [];
  });

  readonly displayMessages = computed(() =>
    this.messages().filter(
      (m) => (m.role === 'user' || m.role === 'assistant') && m.content != null && m.content !== '',
    ),
  );

  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingActions = signal<PendingAction[]>([]);
  // Server-wide destructive enablement (MCP_ALLOW_DESTRUCTIVE), surfaced for the banner.
  readonly destructiveEnabled = signal(false);

  private readonly _streamingText = signal('');
  private readonly _streamingSteps = signal<AgentToolStep[]>([]);
  readonly streamingText = computed(() => this._streamingText());
  readonly streamingSteps = computed(() => this._streamingSteps());

  readonly contextLong = computed(() => {
    const msgs = this.displayMessages();
    return msgs.length >= 20 || msgs.reduce((s, m) => s + (m.content?.length ?? 0), 0) >= 8000;
  });

  constructor() {
    const saved = this.readStorage();
    if (saved) {
      this._conversations.set(saved.conversations);
      this._activeId.set(saved.activeId);
      this._nextId = Math.max(1, ...saved.conversations.map((c) => Number(c.id) || 0));
    }

    effect(() => {
      const conversations = this._conversations();
      const activeId = this._activeId();
      this.writeStorage({ conversations, activeId });
    });

    this.api.assistantControllerInfo().subscribe({
      next: (info: any) =>
        this.destructiveEnabled.set(!!info?.capabilities?.destructiveEnabled),
      error: () => this.destructiveEnabled.set(false),
    });
  }

  newConversation(): void {
    const current = this._conversations().find((c) => c.id === this._activeId());
    if (current?.messages.length === 0) return;
    const id = String(++this._nextId);
    this._conversations.update((cs) => [...cs, { id, title: 'New chat', messages: [] }]);
    this._activeId.set(id);
    this.error.set(null);
    this._cancelInFlight();
    this._clearPending();
  }

  switchTo(id: string): void {
    this._activeId.set(id);
    this.error.set(null);
    this._cancelInFlight();
    this._clearPending();
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
    if (wasActive) {
      this._cancelInFlight();
      this._clearPending();
    }
  }

  send(content: string, opts?: { model?: string; provider?: string; connectionId?: string }): void {
    const userMsg: AgentMessage = { role: 'user', content };
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
    this._clearPending();
    this._pendingOpts.set(opts ?? null);

    this._startTurn(id, this._buildBody(this.messages(), opts));
  }

  approvePending(approvedIds: string[]): void {
    const messages = this._pendingMessages();
    if (!messages.length) return;

    const id = this._activeId();
    const opts = this._pendingOpts();
    this.sending.set(true);
    this.pendingActions.set([]);

    this._startTurn(id, this._buildBody(messages, opts, approvedIds));
  }

  private _buildBody(
    messages: AgentMessage[],
    opts: { model?: string; provider?: string; connectionId?: string } | null | undefined,
    approvedToolCallIds?: string[],
  ): AgentRequestDto {
    const body: AgentRequestDto = {
      messages: messages.map(
        ({ steps: _s, uiActions: _u, operationPending: _o, ...m }) => m,
      ) as AgentRequestDto['messages'],
    };
    if (approvedToolCallIds) body.approvedToolCallIds = approvedToolCallIds;
    if (opts?.model) body.model = opts.model;
    if (opts?.provider) body.provider = opts.provider as AgentRequestDto.ProviderEnum;
    if (opts?.connectionId) body.connectionId = opts.connectionId;
    return body;
  }

  private _startTurn(convId: string, body: AgentRequestDto): void {
    this._abort?.abort();
    const controller = new AbortController();
    this._abort = controller;
    this._streamingText.set('');
    this._streamingSteps.set([]);
    void this._streamAgent(convId, body, controller);
  }

  private async _streamAgent(
    convId: string,
    body: AgentRequestDto,
    controller: AbortController,
  ): Promise<void> {
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
      const res = await this._openStream(body, controller);
      reader = res.body!.getReader();
      if (await this._pumpFrames(reader, convId, controller)) return;
      throw new Error('stream closed without done');
    } catch (err) {
      this._handleStreamFailure(convId, body, controller, err);
    } finally {
      void reader?.cancel().catch(() => undefined);
    }
  }

  private async _pumpFrames(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    convId: string,
    controller: AbortController,
  ): Promise<boolean> {
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return false;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const event = this._parseFrame(buffer.slice(0, sep));
        buffer = buffer.slice(sep + 2);
        if (event && this._consumeFrame(convId, controller, event)) return true;
      }
    }
  }

  private _handleStreamFailure(
    convId: string,
    body: AgentRequestDto,
    controller: AbortController,
    err: unknown,
  ): void {
    if (controller.signal.aborted || this._abort !== controller) return;
    const hadData = this._streamingText().length > 0 || this._streamingSteps().length > 0;
    if (hadData) this._finishWithError(err);
    else this._runBuffered(convId, body, controller);
  }

  private async _openStream(body: AgentRequestDto, controller: AbortController): Promise<Response> {
    const base = this.config.basePath ?? '';
    const token = this.auth.getToken();
    const res = await fetch(`${base}/api/v1/assistant/v1/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      credentials: this.config.withCredentials ? 'include' : 'same-origin',
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`stream failed: ${res.status}`);
    return res;
  }

  private _consumeFrame(convId: string, controller: AbortController, event: AgentStreamEvent): boolean {
    if (this._abort !== controller) return true;
    switch (event.type) {
      case 'delta':
        this._streamingText.update((t) => t + (event.text ?? ''));
        return false;
      case 'step':
        if (event.step) this._streamingSteps.update((s) => [...s, event.step!]);
        return false;
      case 'done':
        this._finishStream();
        this._handleResult(convId, event.result);
        return true;
      case 'error':
        throw new Error(event.message ?? 'stream error');
      default:
        return false;
    }
  }

  private _parseFrame(frame: string): AgentStreamEvent | null {
    const data = frame
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('\n');
    if (!data) return null;
    try {
      return JSON.parse(data) as AgentStreamEvent;
    } catch {
      return null;
    }
  }

  private _runBuffered(convId: string, body: AgentRequestDto, controller: AbortController): void {
    this._streamingText.set('');
    this._streamingSteps.set([]);
    this.api.assistantControllerAgentTurn(body).subscribe({
      next: (res: unknown) => {
        if (this._abort !== controller) return;
        this._finishStream();
        this._handleResult(convId, res as AgentResult);
      },
      error: (e) => {
        if (this._abort !== controller) return;
        this._finishWithError(e);
      },
    });
  }

  private _finishStream(): void {
    this._abort = null;
    this.sending.set(false);
    this._streamingText.set('');
    this._streamingSteps.set([]);
  }

  private _finishWithError(err: unknown): void {
    this._finishStream();
    this.error.set(this._errorMessage(err));
  }

  private _errorMessage(err: unknown): string {
    const httpMessage = (err as { error?: { message?: string } })?.error?.message;
    if (httpMessage) return httpMessage;
    if (err instanceof Error && err.message) return err.message;
    return 'Request failed';
  }

  private _cancelInFlight(): void {
    this._abort?.abort();
    this._abort = null;
    this._streamingText.set('');
    this._streamingSteps.set([]);
    this.sending.set(false);
  }

  private _handleResult(convId: string, result: AgentResult): void {
    if (result.type !== 'message') {
      this._pendingMessages.set(result.messages ?? []);
      this.pendingActions.set(result.pending ?? []);
      return;
    }
    const oldMessages = this._conversations().find((c) => c.id === convId)?.messages ?? [];
    const updated = this._mergeRenderData(result.messages ?? [], oldMessages);
    this._attachCurrentTurnData(updated, result);
    this._conversations.update((cs) =>
      cs.map((c) => (c.id === convId ? { ...c, messages: updated } : c)),
    );
    this._clearPending();
  }

  private _mergeRenderData(incoming: AgentMessage[], prev: AgentMessage[]): AgentMessage[] {
    return incoming.map((msg, i) => {
      const old = prev[i];
      if (!old) return msg;
      const patch: Partial<AgentMessage> = {};
      if (old.steps) patch.steps = old.steps;
      if (old.uiActions) patch.uiActions = old.uiActions;
      if (old.operationPending) patch.operationPending = old.operationPending;
      if (old.docLinks) patch.docLinks = old.docLinks;
      return Object.keys(patch).length ? { ...msg, ...patch } : msg;
    });
  }

  private _attachCurrentTurnData(messages: AgentMessage[], result: AgentResult): void {
    if (
      !result.steps?.length &&
      !result.uiActions?.length &&
      !result.operationPending?.length &&
      !result.docLinks?.length
    )
      return;
    const lastIdx = this._lastAssistantIdx(messages);
    if (lastIdx < 0) return;
    const patch: Partial<AgentMessage> = {};
    if (result.steps?.length) patch.steps = result.steps;
    if (result.uiActions?.length) patch.uiActions = result.uiActions;
    if (result.operationPending?.length) patch.operationPending = result.operationPending;
    if (result.docLinks?.length) patch.docLinks = result.docLinks;
    messages[lastIdx] = { ...messages[lastIdx], ...patch };
  }

  private _lastAssistantIdx(messages: AgentMessage[]): number {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].content) return i;
    }
    return -1;
  }

  private _clearPending(): void {
    this.pendingActions.set([]);
    this._pendingMessages.set([]);
  }

  private readStorage(): StoredState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as StoredState;
      if (!Array.isArray(data.conversations) || !data.conversations.length || !data.activeId) return null;
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
      /* localStorage unavailable */
    }
  }
}
