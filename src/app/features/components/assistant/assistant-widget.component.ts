import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideBot, lucideChevronLeft, lucideX } from '@ng-icons/lucide';
import { Router } from '@angular/router';
import { AssistantChatService } from '../../service/assistant.service';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import { AssistantModelSelectionService } from '../../service/assistant-model-selection.service';
import { AuthService } from '../../../core/services/auth.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { AssistantConfirmCardComponent } from './assistant-confirm-card.component';
import { AssistantMessageComponent } from './assistant-message.component';
import { AssistantComposerComponent } from './assistant-composer.component';
import { AssistantEmptyStateComponent } from './assistant-empty-state.component';
import { AssistantPanelHeader } from './assistant-panel-header';
import { AssistantConversationList } from './assistant-conversation-list';
import { AssistantStreamingRow } from './assistant-streaming-row';
import { wireMarkdown } from './assistant-markdown-wiring';

type SizeMode = 'compact' | 'medium' | 'full';

const SIZE_ORDER: Record<SizeMode, number> = { compact: 0, medium: 1, full: 2 };

@Component({
  selector: 'app-assistant-widget',
  imports: [
    FlAlert,
    FlButton,
    FlIcon,
    AssistantConfirmCardComponent,
    AssistantMessageComponent,
    AssistantComposerComponent,
    AssistantEmptyStateComponent,
    AssistantPanelHeader,
    AssistantConversationList,
    AssistantStreamingRow,
  ],
  providers: [provideIcons({ lucideBot, lucideChevronLeft, lucideX })],
  host: { '(document:keydown.escape)': 'onEscape()' },
  styles: [
    `
      .panel-sm {
        width: 384px;
        max-width: calc(100vw - 48px);
        height: min(580px, calc(100vh - 100px));
      }
      .panel-lg {
        width: 680px;
        max-width: calc(100vw - 48px);
        height: min(85vh, 860px);
        min-width: min(360px, calc(100vw - 48px));
        min-height: 300px;
        resize: both;
      }
      .panel-full {
        width: 100%;
        height: 100%;
        max-width: 1024px;
        max-height: 88vh;
      }
      :host ::ng-deep .md-code-block {
        border-color: var(--fl-border);
        border-radius: var(--fl-radius-md);
        font-family: var(--fl-font-mono);
      }
      :host ::ng-deep .md-code-header {
        background: var(--fl-surface-subtle);
        border-bottom-color: var(--fl-border-subtle);
      }
      :host ::ng-deep .md-code-lang,
      :host ::ng-deep .md-copy-btn {
        color: var(--fl-ink-muted);
      }
      :host ::ng-deep .md-copy-btn:hover {
        color: var(--fl-ink);
        background: var(--fl-surface-hover);
      }
      :host ::ng-deep .md-copy-btn.copied {
        color: var(--fl-success);
      }
      :host ::ng-deep .md-code-block pre {
        background: var(--fl-surface-subtle);
      }
      :host ::ng-deep .md-code-block pre code {
        color: var(--fl-ink);
        font-size: 12.5px;
      }
    `,
  ],
  template: `
    <div [class]="containerClasses()" [class.pointer-events-none]="!expanded()">
      @if (isFull() && expanded()) {
        <div class="fl-backdrop absolute inset-0" (click)="setSize('medium')"></div>
      }

      @if (hasOpened()) {
        <section
          #panel
          class="fl-panel relative z-10 flex flex-col overflow-hidden"
          [class]="panelClasses()"
          [attr.inert]="expanded() ? null : ''"
          role="dialog"
          aria-label="Flui Assistant"
        >
          <app-assistant-panel-header
            [history]="showHistory()"
            [endpointLabel]="sel.endpointLabel()"
            [messageCount]="chatService.displayMessages().length"
            [conversationCount]="chatService.conversations().length"
            [canResize]="!isFull() && contentFloor() === 'compact'"
            [mediumActive]="effectiveSize() === 'medium'"
            [isFull]="isFull()"
            (back)="showHistory.set(false)"
            (clear)="chatService.clear()"
            (newConversation)="newConv()"
            (openHistory)="openHistory()"
            (toggleMedium)="toggleMedium()"
            (toggleFullscreen)="toggleFullscreen()"
            (closed)="close()"
            (navigated)="dismissForNav()"
          />

          <div #scrollEl (scroll)="onScroll()" class="min-h-0 flex-1 overflow-y-auto bg-fl-surface">
            @if (showHistory()) {
              <app-assistant-conversation-list
                [conversations]="chatService.conversations()"
                [activeId]="chatService.activeId()"
                (selected)="selectConv($event)"
                (removed)="deleteConv($event)"
              />
            } @else if (showCenteredComposer()) {
              <div class="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-10">
                <app-assistant-empty-state
                  [fullscreen]="true"
                  [noInference]="noInference()"
                  [hint]="sel.emptyStateHint()"
                  [recommended]="sel.recommendedHint()"
                  [isAdmin]="isAdmin()"
                  [imgOk]="imgOk()"
                  (connect)="openConnectionsSettings()"
                  (configure)="openProviderSettings()"
                  (imgError)="imgOk.set(false)"
                />
                @if (!noInference()) {
                  <div class="w-full max-w-2xl">
                    <app-assistant-composer
                      [fullscreen]="true"
                      (sent)="onComposerSent()"
                      (navigated)="dismissForNav()"
                    />
                  </div>
                }
              </div>
            } @else {
              <div
                class="flex flex-col gap-4 p-4"
                [class.mx-auto]="isFull()"
                [class.max-w-3xl]="isFull()"
                [class.w-full]="isFull()"
              >
                @if (chatService.displayMessages().length === 0) {
                  <app-assistant-empty-state
                    [noInference]="noInference()"
                    [hint]="sel.emptyStateHint()"
                    [recommended]="sel.recommendedHint()"
                    [isAdmin]="isAdmin()"
                    [imgOk]="imgOk()"
                    (connect)="openConnectionsSettings()"
                    (configure)="openProviderSettings()"
                    (imgError)="imgOk.set(false)"
                  />
                }

                @for (msg of chatService.displayMessages(); track $index) {
                  <app-assistant-message
                    [message]="msg"
                    [imgOk]="imgOk()"
                    (imgError)="imgOk.set(false)"
                    (sendMessage)="submitMessage($event)"
                    (markdownReady)="onMarkdownReady()"
                  />
                }

                @if (
                  chatService.streamingText() ||
                  chatService.streamingSteps().length ||
                  chatService.sending()
                ) {
                  <app-assistant-streaming-row
                    [text]="chatService.streamingText()"
                    [steps]="chatService.streamingSteps()"
                  />
                }

                @if (chatService.error()) {
                  <fl-alert tone="error" title="The assistant could not answer">
                    {{ chatService.error() }}
                  </fl-alert>
                }
              </div>

              @if (chatService.pendingActions().length > 0) {
                <div class="px-4 pb-4">
                  <app-assistant-confirm-card
                    [pending]="chatService.pendingActions()"
                    (decided)="onConfirmDecision($event)"
                  />
                </div>
              }
            }
          </div>

          @if (!showHistory() && !showCenteredComposer()) {
            <div class="shrink-0 border-t border-fl-border bg-fl-surface p-3">
              <app-assistant-composer
                [fullscreen]="isFull()"
                (sent)="onComposerSent()"
                (navigated)="dismissForNav()"
              />
            </div>
          }
        </section>
      }

      @if (!isFull()) {
        @if (expanded()) {
          <button
            #closeBtn
            flButton="primary"
            [iconOnly]="true"
            type="button"
            class="pointer-events-auto"
            aria-label="Close Flui Assistant"
            (click)="toggle()"
          >
            <fl-icon name="lucideX" />
          </button>
        } @else {
          <button
            #openBtn
            type="button"
            (click)="toggle()"
            aria-label="Open Flui Assistant"
            class="group pointer-events-auto fixed right-0 top-1/2 z-50 flex -translate-y-1/2 items-center rounded-l-fl-lg border border-r-0 border-fl-border bg-fl-surface py-3 pl-1.5 pr-1 opacity-40 transition-all duration-300 hover:pl-2.5 hover:pr-1.5 hover:opacity-100"
          >
            <fl-icon
              name="lucideChevronLeft"
              class="text-fl-ink-muted transition-transform duration-300 group-hover:-translate-x-0.5"
            />
            <span
              class="inline-flex w-0 items-center overflow-hidden opacity-0 transition-all duration-300 group-hover:ml-1 group-hover:w-5 group-hover:opacity-100"
            >
              <fl-icon name="lucideBot" [size]="20" class="text-fl-accent" />
            </span>
          </button>
        }
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly openBtn = viewChild<ElementRef<HTMLElement>>('openBtn');
  private readonly closeBtn = viewChild<ElementRef<HTMLElement>>('closeBtn');
  private copyObserver?: MutationObserver;

  readonly expanded = signal(false);
  private readonly ready = signal(false);
  protected readonly hasOpened = signal(false);
  protected readonly sizeMode = signal<SizeMode>('compact');
  protected readonly imgOk = signal(true);
  protected readonly showHistory = signal(false);

  protected readonly noInference = computed(
    () =>
      this.inferenceService.configuredProviders().length === 0 &&
      this.inferenceService.connections().length === 0,
  );

  protected readonly isAdmin = computed(() => this.authService.currentUser()?.isAdmin ?? false);

  protected readonly contentFloor = computed<SizeMode>(() => {
    const hasPending = this.chatService.pendingActions().length > 0;
    const hasResults = this.chatService
      .displayMessages()
      .some((m) => m.steps?.some((s) => s.result != null));
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
    const motion = this.ready() ? 'transition duration-300 ease-out' : '';
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
        wireMarkdown(el);
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
    if (el) wireMarkdown(el);
  }

  toggle(): void {
    this.expanded.update((v) => !v);
    if (this.expanded()) {
      this.hasOpened.set(true);
      this.stickToBottom = true;
      this.scrollToBottom(true);
      setTimeout(() => this.focusPanel());
    }
  }

  private focusPanel(): void {
    const panel = this.panel()?.nativeElement;
    const target =
      panel?.querySelector<HTMLElement>('textarea') ??
      this.closeBtn()?.nativeElement ??
      panel?.querySelector<HTMLElement>('button');
    target?.focus();
  }

  private focusOpener(): void {
    setTimeout(() => this.openBtn()?.nativeElement.focus());
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
    this.focusOpener();
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

  protected onEscape(): void {
    if (this.isFull()) {
      this.sizeMode.set('medium');
      return;
    }
    if (!this.expanded()) return;
    if (!this.host.nativeElement.contains(document.activeElement)) return;
    this.close();
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
