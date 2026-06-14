import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronRight,
  lucideHistory,
  lucideLoader,
  lucidePlay,
  lucidePlus,
  lucideSend,
  lucideSparkles,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import { AssistantModelSelectionService } from '../../service/assistant-model-selection.service';
import { AssistantModelPickerComponent } from '../assistant/assistant-model-picker.component';

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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [CommonModule, FormsModule, NgIcon, AssistantModelPickerComponent],
  viewProviders: [
    provideIcons({
      lucideChevronRight,
      lucideHistory,
      lucideLoader,
      lucidePlay,
      lucidePlus,
      lucideSend,
      lucideSparkles,
      lucideTriangleAlert,
    }),
  ],
  template: `
    @if (!expanded()) {
      <button
        type="button"
        (click)="toggle()"
        title="Show assistant"
        class="flex h-8 w-8 shrink-0 self-start items-center justify-center rounded-lg border border-border bg-card text-primary transition-colors hover:bg-muted"
      >
        <ng-icon name="lucideSparkles" class="h-4 w-4" />
      </button>
    } @else {
      <aside class="flex w-80 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div class="border-b border-border bg-muted/40">
          <div class="flex items-center gap-2 px-3 py-2 text-sm font-medium">
            @if (imgOk()) {
              <img src="icons/assistant.png" class="h-4 w-4 object-contain" alt="" (error)="imgOk.set(false)" />
            } @else {
              <ng-icon name="lucideSparkles" class="h-4 w-4 text-primary" />
            }
            {{ identity() }}
            <div class="ml-auto flex items-center gap-0.5">
              <button type="button" (click)="newChat()" title="New chat"
                class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                <ng-icon name="lucidePlus" class="h-4 w-4" />
              </button>
              <button type="button" (click)="toggleHistory()" title="History" [class.bg-muted]="showHistory()"
                class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                <ng-icon name="lucideHistory" class="h-4 w-4" />
              </button>
              <button type="button" (click)="toggle()" title="Collapse"
                class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                <ng-icon name="lucideChevronRight" class="h-4 w-4" />
              </button>
            </div>
          </div>

          @if (showHistory()) {
            <div class="max-h-48 overflow-auto border-t border-border py-1">
              @if (sessions().length === 0) {
                <p class="px-3 py-1.5 text-xs text-muted-foreground">No past chats yet. “New chat” archives the current one here.</p>
              } @else {
                @for (s of sessions(); track s.id) {
                  <div class="group flex items-center gap-1 px-2 py-1 hover:bg-muted">
                    <button type="button" (click)="openSession(s.id)" class="min-w-0 flex-1 truncate text-left text-xs" [title]="s.title">{{ s.title }}</button>
                    <button type="button" (click)="deleteSession(s.id, $event)" class="shrink-0 px-1 text-xs text-muted-foreground/60 opacity-0 hover:text-foreground group-hover:opacity-100" title="Delete">✕</button>
                  </div>
                }
              }
            </div>
          }
        </div>

        <div #scroll class="flex-1 space-y-3 overflow-auto p-3">
          @if (noInference()) {
            <div class="space-y-3 text-center">
              <p class="text-sm font-medium text-foreground">Connect a model to get started</p>
              <p class="text-xs text-muted-foreground">The assistant uses your configured inference provider — the same one the Flui assistant uses.</p>
              <button type="button" (click)="goConnectModel()"
                class="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-md hover:shadow-blue-500/40">
                Connect a model
              </button>
            </div>
          } @else if (messages().length === 0) {
            <p class="text-xs text-muted-foreground">{{ emptyHint() }}</p>
          }
          @for (m of messages(); track $index) {
            @if (m.role === 'user') {
              <div class="ml-6 rounded-lg bg-primary/10 px-3 py-2 text-sm">{{ m.text }}</div>
            } @else {
              <div class="mr-2 space-y-2">
                <div class="flex items-start gap-2 text-sm text-muted-foreground">
                  @if (imgOk()) {
                    <img src="icons/assistant.png" class="mt-0.5 h-4 w-4 shrink-0 object-contain" alt="" (error)="imgOk.set(false)" />
                  } @else {
                    <ng-icon name="lucideSparkles" class="mt-0.5 h-4 w-4 shrink-0" />
                  }
                  <span class="whitespace-pre-wrap">{{ m.text }}</span>
                </div>
                @if (m.code) {
                  <pre class="overflow-auto rounded-md border border-border bg-muted/40 p-2 text-xs"><code>{{ m.code }}</code></pre>
                  @if (m.mutation) {
                    <div class="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                      <ng-icon name="lucideTriangleAlert" class="h-3 w-3" /> Changes data — runs as a write after confirmation.
                    </div>
                  }
                  <div class="flex gap-2">
                    @if (showInsert()) {
                      <button type="button" (click)="insert.emit(m.code!)" class="rounded border border-border px-2 py-1 text-xs hover:bg-muted">Insert</button>
                    }
                    <button type="button" (click)="onRun(m.code!, m.mutation ?? false)"
                      class="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                      <ng-icon name="lucidePlay" class="h-3 w-3" /> Run
                    </button>
                  </div>
                }
              </div>
            }
          }
          @if (pendingRun(); as p) {
            <div class="overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm">
              <div class="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2">
                <ng-icon name="lucideTriangleAlert" class="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p class="text-xs font-semibold text-amber-700 dark:text-amber-400">Confirm write</p>
              </div>
              <div class="space-y-2 p-3">
                <p class="text-xs text-muted-foreground">This {{ codeNoun() }} changes data or structure. It runs as a WRITE (read-only disabled).</p>
                <pre class="overflow-auto rounded-md border border-border bg-muted/40 p-2 text-[11px]"><code>{{ p }}</code></pre>
                <div class="flex gap-2 pt-0.5">
                  <button type="button" (click)="cancelRun()" class="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancel</button>
                  <button type="button" (click)="confirmRun()"
                    class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                    <ng-icon name="lucidePlay" class="h-3 w-3" /> Run write
                  </button>
                </div>
              </div>
            </div>
          }
          @if (thinking()) {
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          }
          @if (error(); as e) {
            <div class="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span class="whitespace-pre-wrap">{{ e }}</span>
            </div>
          }
        </div>

        <div class="border-t border-border p-2">
          <div class="rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-ring">
            <textarea
              [(ngModel)]="prompt"
              (keydown)="onKey($event)"
              [disabled]="noInference()"
              rows="2"
              [placeholder]="noInference() ? 'Connect a model first…' : 'Ask in natural language…'"
              class="w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none disabled:opacity-60"
            ></textarea>
            <div class="flex items-center justify-between gap-2 px-1.5 pb-1.5">
              <div class="flex min-w-0 items-center gap-1.5">
                <app-assistant-model-picker />
                <span class="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground" [title]="dataBlindTooltip()">
                  🔒 {{ dataBlindBadge() }}
                </span>
              </div>
              <button type="button" (click)="ask()" [disabled]="thinking() || noInference()"
                class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                <ng-icon name="lucideSend" class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    }
  `,
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
    'The assistant receives your schema and your question — never your data.',
  );
  readonly emptyHint = input('Describe what you need in plain language.');
  readonly codeNoun = input('query');
  readonly showInsert = input(false);

  @Output() readonly insert = new EventEmitter<string>();
  @Output() readonly run = new EventEmitter<{ code: string; mutation: boolean }>();

  @ViewChild('scroll') scrollEl?: ElementRef<HTMLDivElement>;

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
      const el = this.scrollEl?.nativeElement;
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
          { role: 'ai', text: res.text || 'Here you go.', code: res.code || undefined, mutation: res.mutation },
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
    } catch {
    }
  }

  private messageFrom(err: unknown): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? 'Request failed';
  }
}
