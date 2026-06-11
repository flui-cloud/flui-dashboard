import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  effect,
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
  lucideExpand,
  lucideHistory,
  lucideMaximize2,
  lucideMinimize2,
  lucideShrink,
  lucideSquarePen,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import { Router } from '@angular/router';
import { AssistantChatService } from '../../service/assistant.service';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import { AssistantModelSelectionService } from '../../service/assistant-model-selection.service';
import { AuthService } from '../../../core/services/auth.service';
import { AssistantConfirmCardComponent } from './assistant-confirm-card.component';
import { AssistantMessageComponent } from './assistant-message.component';
import { AssistantComposerComponent } from './assistant-composer.component';
import { AssistantEmptyStateComponent } from './assistant-empty-state.component';

type SizeMode = 'compact' | 'medium' | 'full';

const SIZE_ORDER: Record<SizeMode, number> = { compact: 0, medium: 1, full: 2 };

@Component({
  selector: 'app-assistant-widget',
  standalone: true,
  imports: [NgIcon, MarkdownComponent, AssistantConfirmCardComponent, AssistantMessageComponent, AssistantComposerComponent, AssistantEmptyStateComponent],
  providers: [
    provideIcons({
      lucideBot,
      lucideX,
      lucideAlertCircle,
      lucideTrash2,
      lucideMaximize2,
      lucideMinimize2,
      lucideSquarePen,
      lucideHistory,
      lucideChevronLeft,
      lucideExpand,
      lucideShrink,
    }),
  ],
  styles: [`
    .panel-sm { width: 384px; height: min(580px, calc(100vh - 100px)); }
    .panel-lg { width: 680px; height: min(85vh, 860px); min-width: 360px; min-height: 300px; resize: both; }
    .panel-full { width: 100%; height: 100%; max-width: 1024px; max-height: 88vh; }
  `],
  template: `
    <div [class]="containerClasses()" [class.pointer-events-none]="!expanded()">

      @if (isFull() && expanded()) {
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" (click)="setSize('medium')"></div>
      }

      <!-- Panel -->
      @if (hasOpened()) {
      <div
        class="relative z-10 flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-black/20 border border-border/50"
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
              @if (sel.endpointLabel()) {
                <p class="mt-0.5 text-[10px] text-white/60 leading-none truncate">{{ sel.endpointLabel() }}</p>
              }
            </div>
            @if (chatService.displayMessages().length > 0) {
              <button type="button" (click)="chatService.clear()"
                class="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <ng-icon name="lucideTrash2" class="h-3.5 w-3.5 text-white/80" />
              </button>
            }
            @if (chatService.displayMessages().length > 0) {
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
          @if (!isFull() && contentFloor() === 'compact') {
            <button type="button" (click)="toggleMedium()"
              class="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <ng-icon [name]="effectiveSize() === 'medium' ? 'lucideMinimize2' : 'lucideMaximize2'" class="h-3.5 w-3.5 text-white" />
            </button>
          }
          <button type="button" (click)="toggleFullscreen()"
            class="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <ng-icon [name]="isFull() ? 'lucideShrink' : 'lucideExpand'" class="h-3.5 w-3.5 text-white" />
          </button>
          <button type="button" (click)="close()"
            class="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <ng-icon name="lucideX" class="h-3.5 w-3.5 text-white" />
          </button>
        </div>

        <!-- Messages / History view -->
        <div #scrollEl (scroll)="onScroll()" class="flex-1 overflow-y-auto min-h-0 bg-background">
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
          } @else if (showCenteredComposer()) {
            <div class="flex min-h-full flex-col items-center justify-center px-6 py-10">
              <app-assistant-empty-state [fullscreen]="true" [noInference]="noInference()"
                [hint]="sel.emptyStateHint()" [recommended]="sel.recommendedHint()" [isAdmin]="isAdmin()" [imgOk]="imgOk()"
                (connect)="openConnectionsSettings()" (configure)="openProviderSettings()" (imgError)="imgOk.set(false)" />
              @if (!noInference()) {
                <div class="w-full max-w-2xl">
                  <app-assistant-composer [fullscreen]="true" (sent)="onComposerSent()" (navigated)="dismissForNav()" />
                </div>
              }
            </div>
          } @else {
            <div class="p-4 space-y-3" [class.mx-auto]="isFull()" [class.max-w-3xl]="isFull()" [class.w-full]="isFull()">
              @if (chatService.displayMessages().length === 0) {
                <app-assistant-empty-state [noInference]="noInference()"
                  [hint]="sel.emptyStateHint()" [recommended]="sel.recommendedHint()" [isAdmin]="isAdmin()" [imgOk]="imgOk()"
                  (connect)="openConnectionsSettings()" (configure)="openProviderSettings()" (imgError)="imgOk.set(false)" />
              }

              @for (msg of chatService.displayMessages(); track $index) {
                <app-assistant-message [message]="msg" [imgOk]="imgOk()"
                  (imgError)="imgOk.set(false)" (sendMessage)="submitMessage($event)" (markdownReady)="onMarkdownReady()" />
              }

              @if (chatService.streamingText() || chatService.streamingSteps().length) {
                <div class="flex gap-2">
                  <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 mt-0.5">
                    @if (imgOk()) {
                      <img src="icons/assistant.png" class="h-4 w-4 object-contain" alt="" (error)="imgOk.set(false)" />
                    } @else {
                      <ng-icon name="lucideBot" class="h-3.5 w-3.5 text-blue-500" />
                    }
                  </div>
                  <div class="flex flex-col min-w-0">
                    @if (chatService.streamingSteps().length) {
                      <div class="mb-1 rounded-lg bg-muted/50 border border-border/40 px-2.5 py-2 font-mono text-[11px] space-y-1">
                        @for (step of chatService.streamingSteps(); track step.toolCallId) {
                          <div class="flex items-start gap-2"
                            [class]="step.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'">
                            <span class="shrink-0">{{ step.ok ? '✓' : '✗' }}</span>
                            <span>{{ step.name }}</span>
                          </div>
                        }
                      </div>
                    }
                    @if (chatService.streamingText()) {
                      <div class="w-fit max-w-[82%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm shadow-sm bg-muted text-foreground border border-border/50">
                        <markdown class="md leading-relaxed break-words" [data]="chatService.streamingText()" />
                        <span class="inline-block w-[2px] h-3.5 align-middle bg-blue-500 animate-pulse"></span>
                      </div>
                    }
                  </div>
                </div>
              } @else if (chatService.sending()) {
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

            @if (chatService.pendingActions().length > 0) {
              <app-assistant-confirm-card
                [pending]="chatService.pendingActions()"
                (decided)="onConfirmDecision($event)" />
            }
          }
        </div>

        @if (!showHistory() && !showCenteredComposer()) {
          <div class="shrink-0 bg-background border-t border-border/50 p-3">
            <app-assistant-composer [fullscreen]="isFull()" (sent)="onComposerSent()" (navigated)="dismissForNav()" />
          </div>
        }
      </div>
      }

      <!-- Toggle button -->
      @if (!isFull()) {
      <button type="button" (click)="toggle()"
        class="relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 pointer-events-auto"
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
      }

    </div>
  `,
})
export class AssistantWidgetComponent implements OnInit, OnDestroy {
  protected readonly chatService = inject(AssistantChatService);
  protected readonly sel = inject(AssistantModelSelectionService);
  private readonly inferenceService = inject(InferenceSettingsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly scrollEl = viewChild<ElementRef<HTMLElement>>('scrollEl');
  private copyObserver?: MutationObserver;

  readonly expanded = signal(false);
  private readonly ready = signal(false);
  protected readonly hasOpened = signal(false);
  protected readonly sizeMode = signal<SizeMode>('compact');
  protected readonly imgOk = signal(true);
  protected readonly showHistory = signal(false);

  protected readonly noInference = computed(
    () => this.inferenceService.providers().length === 0 && this.inferenceService.connections().length === 0,
  );

  protected readonly isAdmin = computed(() => this.authService.currentUser()?.isAdmin ?? false);

  protected readonly contentFloor = computed<SizeMode>(() => {
    const hasPending = this.chatService.pendingActions().length > 0;
    const hasResults = this.chatService.displayMessages().some((m) => m.steps?.some((s) => s.result != null));
    return hasPending || hasResults ? 'medium' : 'compact';
  });

  protected readonly effectiveSize = computed<SizeMode>(() => {
    const chosen = this.sizeMode();
    const floor = this.contentFloor();
    return SIZE_ORDER[chosen] >= SIZE_ORDER[floor] ? chosen : floor;
  });

  protected readonly isFull = computed(() => this.effectiveSize() === 'full');

  protected readonly showCenteredComposer = computed(
    () => this.isFull() && !this.showHistory() && this.chatService.displayMessages().length === 0,
  );

  protected readonly containerClasses = computed(() =>
    this.isFull()
      ? 'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6'
      : 'fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3',
  );

  protected readonly panelClasses = computed(() => {
    const size = this.effectiveSize();
    const sizeClass = { compact: 'panel-sm', medium: 'panel-lg', full: 'panel-full' }[size];
    const origin = size === 'full' ? 'origin-center' : 'origin-bottom-right';
    const motion = this.ready() ? 'transition-[transform,opacity] duration-300 ease-out' : '';
    const vis = this.expanded()
      ? 'scale-100 opacity-100 translate-y-0'
      : 'scale-95 opacity-0 translate-y-2 pointer-events-none';
    return `${sizeClass} ${origin} ${motion} ${vis}`;
  });

  constructor() {
    afterNextRender(() => this.ready.set(true));
    effect(() => {
      this.chatService.streamingText();
      this.chatService.streamingSteps();
      this.scrollToBottom();
    });
    effect(() => {
      const el = this.scrollEl()?.nativeElement;
      if (!el || this.copyObserver) return;
      this.copyObserver = new MutationObserver(() => {
        this.wireCopyButtons(el);
        this.scrollToBottom();
      });
      this.copyObserver.observe(el, { childList: true, subtree: true });
    });
  }

  private stickToBottom = true;

  protected onScroll(): void {
    const el = this.scrollEl()?.nativeElement;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.stickToBottom = distance < 60;
  }

  private scrollToBottom(force = false): void {
    const el = this.scrollEl()?.nativeElement;
    if (!el || this.showHistory()) return;
    if (!force && !this.stickToBottom) return;
    el.scrollTop = el.scrollHeight;
  }

  ngOnInit(): void {
    this.inferenceService.loadProviders();
    this.inferenceService.loadConnections();
    this.inferenceService.loadRecommendations();
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
    container.querySelectorAll<HTMLAnchorElement>('a[href]:not([data-ext-wired])').forEach(a => {
      if (a.href.startsWith('http')) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.dataset['extWired'] = '';
      }
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
    if (this.expanded()) {
      this.hasOpened.set(true);
      this.stickToBottom = true;
      this.scrollToBottom(true);
    }
  }

  protected setSize(mode: SizeMode): void {
    this.sizeMode.set(mode);
  }

  protected toggleMedium(): void {
    this.sizeMode.update((m) => (m === 'compact' ? 'medium' : 'compact'));
  }

  protected toggleFullscreen(): void {
    this.sizeMode.update((m) => (m === 'full' ? 'medium' : 'full'));
  }

  protected close(): void {
    this.expanded.set(false);
    if (this.sizeMode() === 'full') this.sizeMode.set('compact');
  }

  protected openConnectionsSettings(): void {
    this.router.navigate(['/settings'], { fragment: 'inference-connections' });
    this.dismissForNav();
  }

  protected openProviderSettings(): void {
    this.router.navigate(['/management/providers']);
    this.dismissForNav();
  }

  protected dismissForNav(): void {
    this.expanded.set(false);
    if (this.sizeMode() === 'full') this.sizeMode.set('compact');
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.isFull()) this.sizeMode.set('medium');
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
    const wasActive = id === this.chatService.activeId();
    this.chatService.deleteConversation(id);
    if (wasActive) this.showHistory.set(false);
  }

  protected onConfirmDecision(approvedIds: string[]): void {
    this.stickToBottom = true;
    this.chatService.approvePending(approvedIds);
  }

  protected onComposerSent(): void {
    this.stickToBottom = true;
    this.scrollToBottom(true);
  }

  protected submitMessage(content: string): void {
    this.stickToBottom = true;
    this.chatService.send(content, this.sel.selectedOpts() ?? undefined);
  }
}
