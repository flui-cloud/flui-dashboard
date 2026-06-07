import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { MarkdownComponent } from 'ngx-markdown';
import {
  lucideAlertCircle,
  lucideBot,
  lucideChevronLeft,
  lucideHistory,
  lucideMaximize2,
  lucideMinimize2,
  lucideSend,
  lucideSquarePen,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import { AssistantChatService } from '../../service/assistant.service';
import { InferenceSettingsService } from '../../service/inference-settings.service';

interface PickerOption {
  label: string;
  opts: { model?: string; provider?: string; connectionId?: string } | null;
}

@Component({
  selector: 'app-assistant-widget',
  standalone: true,
  imports: [NgIcon, MarkdownComponent],
  providers: [
    provideIcons({
      lucideBot,
      lucideX,
      lucideAlertCircle,
      lucideSend,
      lucideTrash2,
      lucideMaximize2,
      lucideMinimize2,
      lucideSquarePen,
      lucideHistory,
      lucideChevronLeft,
    }),
  ],
  styles: [`
    .panel-sm { width: 384px; height: min(580px, calc(100vh - 100px)); }
    .panel-lg { width: 680px; height: min(80vh, 800px); min-width: 360px; min-height: 300px; resize: both; }
  `],
  template: `
    <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      <!-- Panel -->
      <div
        class="flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-black/20 border border-border/50 transition-[transform,opacity] duration-300 ease-out origin-bottom-right"
        [class]="panelClasses()"
      >
        <!-- Header -->
        <div class="shrink-0 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-700">
          @if (showHistory()) {
            <button type="button" (click)="showHistory.set(false)"
              class="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <ng-icon name="lucideChevronLeft" class="h-4 w-4 text-white" />
            </button>
            <p class="flex-1 text-sm font-semibold text-white leading-none">Conversations</p>
          } @else {
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10">
              @if (imgOk()) {
                <img src="icons/assistant.png" class="h-6 w-6 object-contain brightness-0 invert" alt="" (error)="imgOk.set(false)" />
              } @else {
                <ng-icon name="lucideBot" class="h-4 w-4 text-white" />
              }
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-white leading-none">Flui Assistant</p>
              @if (endpointLabel()) {
                <p class="mt-0.5 text-[10px] text-white/60 leading-none truncate">{{ endpointLabel() }}</p>
              }
            </div>
            @if (chatService.messages().length > 0) {
              <button type="button" (click)="chatService.clear()"
                class="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <ng-icon name="lucideTrash2" class="h-3.5 w-3.5 text-white/80" />
              </button>
            }
            @if (chatService.messages().length > 0) {
              <button type="button" (click)="newConv()"
                class="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <ng-icon name="lucideSquarePen" class="h-3.5 w-3.5 text-white" />
              </button>
            }
            @if (chatService.conversations().length > 1) {
              <button type="button" (click)="openHistory()"
                class="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <ng-icon name="lucideHistory" class="h-3.5 w-3.5 text-white" />
                <span class="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[8px] font-bold text-blue-600 leading-none">
                  {{ chatService.conversations().length }}
                </span>
              </button>
            }
          }
          <button type="button" (click)="toggleSize()"
            class="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <ng-icon [name]="sizeMode() === 'lg' ? 'lucideMinimize2' : 'lucideMaximize2'" class="h-3.5 w-3.5 text-white" />
          </button>
          <button type="button" (click)="expanded.set(false)"
            class="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <ng-icon name="lucideX" class="h-3.5 w-3.5 text-white" />
          </button>
        </div>

        <!-- Messages / History view -->
        <div #scrollEl class="flex-1 overflow-y-auto min-h-0 bg-background">
          @if (showHistory()) {
            <div class="p-3 space-y-1">
              @for (conv of chatService.conversations(); track conv.id) {
                <div class="group flex items-center gap-1 rounded-xl border transition-colors hover:bg-muted/80"
                  [class]="conv.id === chatService.activeId()
                    ? 'bg-blue-500/10 border-blue-500/20'
                    : 'bg-transparent border-transparent'">
                  <button type="button" (click)="selectConv(conv.id)" class="flex-1 text-left px-3 py-2.5 min-w-0">
                    <p class="text-sm font-medium text-foreground truncate">{{ conv.title }}</p>
                    <p class="text-xs text-muted-foreground mt-0.5">
                      {{ conv.messages.length }} {{ conv.messages.length === 1 ? 'message' : 'messages' }}
                    </p>
                  </button>
                  <button type="button" (click)="deleteConv(conv.id)"
                    class="shrink-0 mr-2 flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all">
                    <ng-icon name="lucideTrash2" class="h-3 w-3" />
                  </button>
                </div>
              }
            </div>
          } @else {
            <div class="p-4 space-y-3">
              @if (chatService.messages().length === 0) {
                <div class="flex flex-col items-center justify-center h-full py-10 gap-4 text-center">
                  <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20">
                    @if (imgOk()) {
                      <img src="icons/assistant.png" class="h-9 w-9 object-contain" alt="" (error)="imgOk.set(false)" />
                    } @else {
                      <ng-icon name="lucideBot" class="h-7 w-7 text-blue-500" />
                    }
                  </div>
                  <div>
                    <p class="text-sm font-medium text-foreground">Ask anything</p>
                    <p class="text-xs text-muted-foreground mt-0.5">{{ emptyStateHint() }}</p>
                  </div>
                </div>
              }

              @for (msg of chatService.messages(); track $index) {
                <div class="flex gap-2" [class.flex-row-reverse]="msg.role === 'user'">
                  @if (msg.role !== 'user') {
                    <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 mt-0.5">
                      @if (imgOk()) {
                        <img src="icons/assistant.png" class="h-4 w-4 object-contain" alt="" (error)="imgOk.set(false)" />
                      } @else {
                        <ng-icon name="lucideBot" class="h-3.5 w-3.5 text-blue-500" />
                      }
                    </div>
                  }
                  @if (msg.role === 'user') {
                    <div class="md-user-bubble max-w-[78%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm shadow-sm bg-gradient-to-br from-blue-500 to-blue-700 text-white">
                      <p class="whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
                    </div>
                  } @else {
                    <div class="max-w-[82%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm shadow-sm bg-muted text-foreground border border-border/50">
                      <markdown class="md leading-relaxed break-words" [data]="msg.content" (ready)="onMarkdownReady()" />
                    </div>
                  }
                </div>
              }

              @if (chatService.sending()) {
                <div class="flex gap-2">
                  <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                    @if (imgOk()) {
                      <img src="icons/assistant.png" class="h-4 w-4 object-contain" alt="" (error)="imgOk.set(false)" />
                    } @else {
                      <ng-icon name="lucideBot" class="h-3.5 w-3.5 text-blue-500" />
                    }
                  </div>
                  <div class="bg-muted border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div class="flex gap-1.5 items-center">
                      <div class="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]"></div>
                      <div class="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]"></div>
                      <div class="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"></div>
                    </div>
                  </div>
                </div>
              }

              @if (chatService.error()) {
                <div class="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive border border-destructive/20">
                  <ng-icon name="lucideAlertCircle" class="h-3.5 w-3.5 shrink-0" />
                  {{ chatService.error() }}
                </div>
              }
            </div>
          }
        </div>

        <!-- Composer -->
        @if (!showHistory()) {
          <div class="shrink-0 bg-background border-t border-border/50 p-3 space-y-2">
            @if (chatService.contextLong()) {
              <div class="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5">
                <p class="text-[11px] text-amber-700 dark:text-amber-400 leading-tight">
                  Long conversation — responses may degrade
                </p>
                <button type="button" (click)="newConv()"
                  class="shrink-0 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap">
                  New chat →
                </button>
              </div>
            }
            @if (pickerOptions().length > 1) {
              <select (change)="onPickerChange($event)"
                class="w-full rounded-lg border border-input bg-muted/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                @for (opt of pickerOptions(); track $index) {
                  <option [value]="$index">{{ opt.label }}</option>
                }
              </select>
            }
            <div class="flex gap-2 items-end">
              <textarea
                [value]="draft()"
                (input)="onDraftInput($event)"
                (keydown)="onKeydown($event)"
                [disabled]="chatService.sending()"
                rows="1"
                placeholder="Ask Flui Assistant…"
                class="flex-1 resize-none rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 min-h-[36px] max-h-[96px]"
              ></textarea>
              <button type="button" (click)="submit()"
                [disabled]="chatService.sending() || !draft().trim()"
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-500/30 transition-all hover:shadow-blue-500/40 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100">
                <ng-icon name="lucideSend" class="h-4 w-4" />
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Toggle button -->
      <button type="button" (click)="toggle()"
        class="relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
        [class]="expanded()
          ? 'bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-500/30 hover:shadow-blue-500/40 hover:shadow-xl'
          : 'bg-card border border-border shadow-black/10 hover:shadow-black/20'"
      >
        @if (!expanded()) {
          <div class="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-10"></div>
          @if (imgOk()) {
            <img src="icons/assistant.png" class="h-9 w-9 object-contain" alt="Flui Assistant" (error)="imgOk.set(false)" />
          } @else {
            <ng-icon name="lucideBot" class="h-6 w-6 text-blue-600" />
          }
        } @else {
          <ng-icon name="lucideX" class="h-6 w-6 text-white" />
        }
      </button>

    </div>
  `,
})
export class AssistantWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly chatService = inject(AssistantChatService);
  private readonly inferenceService = inject(InferenceSettingsService);
  private readonly scrollEl = viewChild<ElementRef<HTMLElement>>('scrollEl');
  private copyObserver?: MutationObserver;

  readonly expanded = signal(false);
  protected readonly sizeMode = signal<'sm' | 'lg'>('sm');
  protected readonly draft = signal('');
  protected readonly selectedIdx = signal(0);
  protected readonly imgOk = signal(true);
  protected readonly showHistory = signal(false);

  protected readonly panelClasses = computed(() => {
    const size = this.sizeMode() === 'sm' ? 'panel-sm' : 'panel-lg';
    const vis = this.expanded()
      ? 'scale-100 opacity-100 translate-y-0'
      : 'scale-95 opacity-0 translate-y-2 pointer-events-none';
    return `${size} ${vis}`;
  });

  protected readonly pickerOptions = computed<PickerOption[]>(() => {
    const opts: PickerOption[] = [{ label: 'Default (auto)', opts: null }];
    for (const p of this.inferenceService.providers()) {
      for (const m of (p.models ?? [])) {
        opts.push({ label: `${p.provider} — ${m}`, opts: { provider: p.provider, model: m } });
      }
    }
    for (const c of this.inferenceService.connections()) {
      for (const m of c.models) {
        opts.push({ label: `${c.label} — ${m}`, opts: { connectionId: c.id, model: m } });
      }
      if (!c.models.length) {
        opts.push({ label: c.label, opts: { connectionId: c.id } });
      }
    }
    return opts;
  });

  protected readonly emptyStateHint = computed(() => {
    const providers = this.inferenceService.providers();
    const connections = this.inferenceService.connections();
    if (providers.length === 0 && connections.length === 0) {
      return 'Configure an inference endpoint in Settings to get started.';
    }
    const opt = this.pickerOptions()[this.selectedIdx()];
    if (!opt?.opts) {
      const def = providers.find((p) => p.euDataResidency) ?? providers[0];
      if (def) return `Using ${def.provider}${def.euDataResidency ? ' · EU inference' : ''}`;
      const defConn = connections.find((c) => c.isDefault) ?? connections[0];
      if (defConn) return `Using ${defConn.label}`;
    }
    return '';
  });

  protected readonly endpointLabel = computed(() => {
    const opt = this.pickerOptions()[this.selectedIdx()];
    if (!opt?.opts) {
      const providers = this.inferenceService.providers();
      if (providers.length === 1 && providers[0].euDataResidency) {
        return `EU inference · ${providers[0].provider}`;
      }
      return '';
    }
    const { provider, connectionId } = opt.opts;
    if (provider) {
      const info = this.inferenceService.providers().find((p) => p.provider === provider);
      return info?.euDataResidency ? `EU inference · ${provider}` : provider;
    }
    if (connectionId) {
      return this.inferenceService.connections().find((c) => c.id === connectionId)?.label ?? 'custom endpoint';
    }
    return '';
  });

  private scrollToBottom(): void {
    const el = this.scrollEl()?.nativeElement;
    if (el && !this.showHistory()) el.scrollTop = el.scrollHeight;
  }

  ngOnInit(): void {
    this.inferenceService.loadProviders();
    this.inferenceService.loadConnections();
  }

  ngAfterViewInit(): void {
    const el = this.scrollEl()?.nativeElement;
    if (!el) return;
    this.copyObserver = new MutationObserver(() => {
      this.wireCopyButtons(el);
      this.scrollToBottom();
    });
    this.copyObserver.observe(el, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.copyObserver?.disconnect();
  }

  protected onMarkdownReady(): void {
    const el = this.scrollEl()?.nativeElement;
    if (el) this.wireCopyButtons(el);
  }

  private wireCopyButtons(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('.md-copy-btn:not([data-wired])').forEach(btn => {
      btn.dataset['wired'] = '';
      btn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        if (btn.classList.contains('copied')) return;
        const code = btn.closest('.md-code-block')?.querySelector('code')?.textContent ?? '';
        if (!navigator.clipboard) { this.flashError(btn); return; }
        navigator.clipboard.writeText(code).then(() => this.flashSuccess(btn), () => this.flashError(btn));
      });
    });
  }

  private flashSuccess(btn: HTMLElement): void {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  }

  private flashError(btn: HTMLElement): void {
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  }

  toggle(): void {
    this.expanded.update((v) => !v);
    if (this.expanded()) this.scrollToBottom();
  }

  toggleSize(): void {
    this.sizeMode.update((m) => (m === 'sm' ? 'lg' : 'sm'));
  }

  protected openHistory(): void {
    this.showHistory.set(true);
  }

  protected newConv(): void {
    this.chatService.newConversation();
    this.showHistory.set(false);
  }

  protected selectConv(id: string): void {
    this.chatService.switchTo(id);
    this.showHistory.set(false);
  }

  protected deleteConv(id: string): void {
    this.chatService.deleteConversation(id);
    if (this.chatService.conversations().length === 0) {
      this.showHistory.set(false);
    }
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
