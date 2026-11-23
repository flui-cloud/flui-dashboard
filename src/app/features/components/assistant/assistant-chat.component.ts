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
import { provideIcons } from '@ng-icons/core';
import { lucideSend, lucideTrash2 } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { AssistantChatService } from '../../service/assistant.service';
import { InferenceSettingsService } from '../../service/inference-settings.service';

interface PickerOption {
  label: string;
  opts: { model?: string; provider?: string; connectionId?: string } | null;
}

@Component({
  selector: 'app-assistant-chat',
  imports: [FlAlert, FlPanel, FlEmptyState, FlButton, FlIcon, FlSpinner, FlStatus],
  providers: [provideIcons({ lucideSend, lucideTrash2 })],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Flui Assistant" [flush]="true">
      @if (chatService.messages().length > 0) {
        <button panelActions flButton="ghost" size="sm" type="button" (click)="chatService.clear()">
          <fl-icon name="lucideTrash2" />
          Clear
        </button>
      }
      <div class="flex h-full max-h-screen flex-col">
        <p class="px-4 pt-3 text-fl-caption text-fl-ink-muted">
          EU-hosted inference, no data leaves your cluster
        </p>
        <div #scrollEl class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          @if (chatService.messages().length === 0) {
            <fl-empty-state
              title="No messages yet"
              body="Send a message to start a conversation."
            />
          }

          @for (msg of chatService.messages(); track $index) {
            <div class="flex min-w-0 flex-col gap-1">
              <span class="text-fl-caption text-fl-ink-muted">
                {{ msg.role === 'user' ? 'You' : 'Flui Assistant' }}
              </span>
              <p class="whitespace-pre-wrap break-words text-fl-body-sm text-fl-ink">
                {{ msg.content }}
              </p>
            </div>
          }

          @if (chatService.sending()) {
            <fl-status tone="progress" label="Thinking" />
          }

          @if (chatService.error()) {
            <fl-alert tone="error" title="The assistant could not answer">
              {{ chatService.error() }}
            </fl-alert>
          }
        </div>

        <div class="flex shrink-0 flex-col gap-2 border-t border-fl-border p-4">
          @if (pickerOptions().length > 1) {
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Model"
                (change)="onPickerChange($event)"
              >
                @for (opt of pickerOptions(); track $index) {
                  <option [value]="$index">{{ opt.label }}</option>
                }
              </select>
            </span>
          }

          <div class="flex items-end gap-2">
            <textarea
              #inputEl
              class="fl-textarea min-h-0"
              rows="2"
              aria-label="Message"
              placeholder="Message Flui Assistant"
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
              @if (chatService.sending()) {
                <fl-spinner label="Sending" />
              } @else {
                <fl-icon name="lucideSend" />
              }
            </button>
          </div>
        </div>
      </div>
    </fl-panel>
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
          opts.push({ label: `${p.provider}, ${m}`, opts: { provider: p.provider, model: m } });
        }
      } else {
        opts.push({ label: p.provider, opts: { provider: p.provider } });
      }
    }
    for (const c of this.inferenceService.connections()) {
      if (c.models.length) {
        for (const m of c.models) {
          opts.push({ label: `${c.label}, ${m}`, opts: { connectionId: c.id, model: m } });
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
