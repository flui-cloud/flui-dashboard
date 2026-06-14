import {
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideAlertCircle,
  lucideLoader,
  lucideSend,
  lucideTrash2,
} from '@ng-icons/lucide';
import { AssistantChatService } from '../../service/assistant.service';
import { InferenceSettingsService } from '../../service/inference-settings.service';

interface PickerOption {
  label: string;
  opts: { model?: string; provider?: string; connectionId?: string } | null;
}

@Component({
  selector: 'app-assistant-chat',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideAlertCircle, lucideLoader, lucideSend, lucideTrash2 })],
  template: `
    <div class="flex flex-col h-full max-h-[calc(100vh-120px)]">

      <div class="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 class="text-lg font-semibold text-foreground">Flui Assistant</h1>
          <p class="text-xs text-muted-foreground">EU-hosted inference · no data leaves your cluster</p>
        </div>
        @if (chatService.messages().length > 0) {
          <button
            type="button"
            (click)="chatService.clear()"
            class="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
            Clear
          </button>
        }
      </div>

      <div #scrollEl class="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
        @if (chatService.messages().length === 0) {
          <div class="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p class="text-sm text-muted-foreground">Send a message to start a conversation.</p>
          </div>
        }

        @for (msg of chatService.messages(); track $index) {
          <div
            class="flex"
            [class.justify-end]="msg.role === 'user'"
            [class.justify-start]="msg.role !== 'user'"
          >
            <div
              class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm"
              [class]="msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm'"
            >
              <p class="whitespace-pre-wrap break-words">{{ msg.content }}</p>
            </div>
          </div>
        }

        @if (chatService.sending()) {
          <div class="flex justify-start">
            <div class="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
              <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        }

        @if (chatService.error()) {
          <div class="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ng-icon name="lucideAlertCircle" class="h-4 w-4 shrink-0" />
            {{ chatService.error() }}
          </div>
        }
      </div>

      <div class="shrink-0 border-t border-border px-6 py-4 space-y-2">
        @if (pickerOptions().length > 1) {
          <select
            (change)="onPickerChange($event)"
            class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            @for (opt of pickerOptions(); track $index) {
              <option [value]="$index">{{ opt.label }}</option>
            }
          </select>
        }

        <div class="flex gap-2 items-end">
          <textarea
            #inputEl
            [value]="draft()"
            (input)="onDraftInput($event)"
            (keydown)="onKeydown($event)"
            [disabled]="chatService.sending()"
            rows="2"
            placeholder="Message Flui Assistant…"
            class="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          ></textarea>
          <button
            type="button"
            (click)="submit()"
            [disabled]="chatService.sending() || !draft().trim()"
            class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (chatService.sending()) {
              <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
            } @else {
              <ng-icon name="lucideSend" class="h-4 w-4" />
            }
          </button>
        </div>
      </div>

    </div>
  `,
})
export class AssistantChatComponent implements OnInit {
  protected readonly chatService = inject(AssistantChatService);
  private readonly inferenceService = inject(InferenceSettingsService);

  private readonly scrollEl = viewChild<ElementRef<HTMLElement>>('scrollEl');
  protected readonly draft = signal('');
  protected readonly selectedIdx = signal(0);

  protected readonly pickerOptions = computed<PickerOption[]>(() => {
    const opts: PickerOption[] = [{ label: 'Default (auto)', opts: null }];
    for (const p of this.inferenceService.configuredProviders()) {
      const models = p.models ?? [];
      if (models.length) {
        for (const m of models) {
          opts.push({ label: `${p.provider} — ${m}`, opts: { provider: p.provider, model: m } });
        }
      } else {
        opts.push({ label: p.provider, opts: { provider: p.provider } });
      }
    }
    for (const c of this.inferenceService.connections()) {
      if (c.models.length) {
        for (const m of c.models) {
          opts.push({ label: `${c.label} — ${m}`, opts: { connectionId: c.id, model: m } });
        }
      } else {
        opts.push({ label: c.label, opts: { connectionId: c.id } });
      }
    }
    return opts;
  });

  constructor() {
    effect(() => {
      this.chatService.messages();
      this.chatService.sending();
      queueMicrotask(() => {
        const el = this.scrollEl()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  ngOnInit(): void {
    this.inferenceService.loadProviders();
    this.inferenceService.loadConnections();
  }

  protected onDraftInput(e: Event): void {
    this.draft.set((e.target as HTMLTextAreaElement).value);
  }

  protected onPickerChange(e: Event): void {
    this.selectedIdx.set(+(e.target as HTMLSelectElement).value);
  }

  protected onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.submit();
    }
  }

  protected submit(): void {
    const content = this.draft().trim();
    if (!content || this.chatService.sending()) return;
    const selectedOpts = this.pickerOptions()[this.selectedIdx()]?.opts ?? undefined;
    this.draft.set('');
    this.chatService.send(content, selectedOpts ?? undefined);
  }
}
