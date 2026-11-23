import {
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  output,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronRight,
  lucideHistory,
  lucideLock,
  lucidePlay,
  lucidePlus,
  lucideSend,
  lucideSparkles,
  lucideX,
} from '@ng-icons/lucide';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import { AssistantModelSelectionService } from '../../service/assistant-model-selection.service';
import { AssistantModelPickerComponent } from '../assistant/assistant-model-picker.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

export type ChatModelOpts = {
  model?: string;
  provider?: string;
  connectionId?: string;
} | null;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatArtifact {
  text: string;
  code?: string;
  mutation: boolean;
}

export type AssistFn = (
  prompt: string,
  conversation: ChatTurn[],
  model: ChatModelOpts,
) => Observable<ChatArtifact>;

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  code?: string;
  mutation?: boolean;
}
interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}
interface StoredChat {
  current: ChatMessage[];
  history: ChatSession[];
}
@Component({
  selector: 'app-db-assistant-chat',
  host: { class: 'contents' },
  imports: [
    FormsModule,
    AssistantModelPickerComponent,
    FlAlert,
    FlEmptyState,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
  ],
  viewProviders: [
    provideIcons({
      lucideChevronRight,
      lucideHistory,
      lucideLock,
      lucidePlay,
      lucidePlus,
      lucideSend,
      lucideSparkles,
      lucideX,
    }),
  ],
  templateUrl: './db-assistant-chat.component.html',
})
export class DbAssistantChatComponent implements OnInit {
  private readonly inference = inject(InferenceSettingsService);
  private readonly modelSel = inject(AssistantModelSelectionService);
  private readonly router = inject(Router);

  readonly appId = input.required<string>();
  readonly storagePrefix = input.required<string>();
  readonly identity = input.required<string>();
  readonly assist = input.required<AssistFn>();
  readonly dataBlindBadge = input('schema only');
  readonly dataBlindTooltip = input(
    'The assistant receives your schema and your question, never your data.',
  );
  readonly emptyHint = input('Describe what you need in plain language.');
  readonly codeNoun = input('query');
  readonly showInsert = input(false);

  readonly insert = output<string>();
  readonly run = output<{
    code: string;
    mutation: boolean;
  }>();

  readonly scrollEl = viewChild<ElementRef<HTMLDivElement>>('scroll');

  readonly messages = signal<ChatMessage[]>([]);
  readonly sessions = signal<ChatSession[]>([]);
  readonly showHistory = signal(false);
  readonly expanded = signal(true);
  readonly thinking = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingRun = signal<string | null>(null);
  readonly imgOk = signal(true);
  prompt = '';

  readonly noInference = computed(
    () =>
      this.inference.configuredProviders().length === 0 &&
      this.inference.connections().length === 0,
  );

  constructor() {
    effect(() => {
      const data: StoredChat = { current: this.messages(), history: this.sessions() };
      const appId = this.appId();
      if (appId) this.writeStore(this.chatKey(appId), data);
    });
    effect(() => {
      this.messages();
      this.thinking();
      this.pendingRun();
      const el = this.scrollEl()?.nativeElement;
      if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
    });
  }

  ngOnInit(): void {
    this.inference.loadProviders();
    this.inference.loadConnections();
    this.inference.loadRecommendations();
    this.expanded.set(this.readStore<boolean>(this.collapseKey()) ?? true);
    const stored = this.readStore<StoredChat>(this.chatKey(this.appId()));
    if (stored) {
      this.messages.set(stored.current ?? []);
      this.sessions.set(stored.history ?? []);
    }
  }

  toggle(): void {
    const v = !this.expanded();
    this.expanded.set(v);
    this.writeStore(this.collapseKey(), v);
  }

  ask(): void {
    const q = this.prompt.trim();
    if (!q || this.thinking() || this.noInference()) return;
    const conversation: ChatTurn[] = this.messages().map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.code ? `${m.text}\n${m.code}` : m.text,
    }));
    this.messages.update((m) => [...m, { role: 'user', text: q }]);
    this.prompt = '';
    this.thinking.set(true);
    this.error.set(null);
    this.assist()(q, conversation, this.modelSel.selectedOpts()).subscribe({
      next: (res) => {
        this.messages.update((m) => [
          ...m,
          {
            role: 'ai',
            text: res.text || 'Here you go.',
            code: res.code || undefined,
            mutation: res.mutation,
          },
        ]);
        this.thinking.set(false);
      },
      error: (err) => {
        this.thinking.set(false);
        const status = (err as { status?: number })?.status;
        if (status === 404 && this.noInference()) {
          this.error.set('No AI model is configured yet. Connect one to use the assistant.');
          return;
        }
        this.error.set(this.messageFrom(err));
      },
    });
  }

  onRun(code: string, mutation: boolean): void {
    if (mutation) {
      this.pendingRun.set(code);
      return;
    }
    this.run.emit({ code, mutation: false });
  }

  confirmRun(): void {
    const code = this.pendingRun();
    if (!code) return;
    this.pendingRun.set(null);
    this.run.emit({ code, mutation: true });
  }

  cancelRun(): void {
    this.pendingRun.set(null);
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.ask();
    }
  }

  toggleHistory(): void {
    this.showHistory.update((v) => !v);
  }

  newChat(): void {
    this.archiveCurrent();
    this.messages.set([]);
    this.error.set(null);
    this.showHistory.set(false);
  }

  openSession(id: string): void {
    const session = this.sessions().find((s) => s.id === id);
    if (!session) return;
    this.archiveCurrent();
    this.messages.set(session.messages);
    this.sessions.update((list) => list.filter((s) => s.id !== id));
    this.error.set(null);
    this.showHistory.set(false);
  }

  deleteSession(id: string, event: Event): void {
    event.stopPropagation();
    this.sessions.update((list) => list.filter((s) => s.id !== id));
  }

  goConnectModel(): void {
    void this.router.navigate(['/settings'], { fragment: 'inference-connections' });
  }

  private archiveCurrent(): void {
    const messages = this.messages();
    if (!messages.length) return;
    const title = messages.find((m) => m.role === 'user')?.text ?? 'Conversation';
    this.sessions.update((list) =>
      [
        {
          id: crypto.randomUUID(),
          title: title.length > 48 ? `${title.slice(0, 48)}…` : title,
          messages,
          updatedAt: Date.now(),
        },
        ...list,
      ].slice(0, 20),
    );
  }

  private chatKey(appId: string): string {
    return `${this.storagePrefix()}.chat.${appId}`;
  }
  private collapseKey(): string {
    return `${this.storagePrefix()}.showAi`;
  }

  private readStore<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private writeStore(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  private messageFrom(err: unknown): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? 'Request failed';
  }
}
