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
import { NgTemplateOutlet } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { MarkdownComponent } from 'ngx-markdown';
import {
  lucideAlertCircle,
  lucideBot,
  lucideCheck,
  lucideChevronDown,
  lucideChevronLeft,
  lucideChevronUp,
  lucideExpand,
  lucideSearch,
  lucideHistory,
  lucideMaximize2,
  lucideMinimize2,
  lucideSend,
  lucideShrink,
  lucideSquarePen,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import { Router } from '@angular/router';
import { AgentToolStep, AssistantChatService, LogSourcesResult, UiAction } from '../../service/assistant.service';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { AssistantConfirmCardComponent } from './assistant-confirm-card.component';
import { AssistantOperationProgressComponent } from './assistant-operation-progress.component';
import { AssistantToolResultComponent } from './assistant-tool-result.component';

type SizeMode = 'compact' | 'medium' | 'full';

const SIZE_ORDER: Record<SizeMode, number> = { compact: 0, medium: 1, full: 2 };

interface PickerOption {
  label: string;
  opts: { model?: string; provider?: string; connectionId?: string } | null;
}

interface EnrichedOption {
  idx: number;
  label: string;
  modelId?: string;
  provider?: string;
  description?: string;
  note?: string;
  opts: PickerOption['opts'];
}

type StoredSelection = { kind: 'auto' } | { provider?: string; connectionId?: string; model?: string };

const SELECTION_KEY = 'flui.assistant.modelSelection';

@Component({
  selector: 'app-assistant-widget',
  standalone: true,
  imports: [NgIcon, NgTemplateOutlet, MarkdownComponent, AssistantConfirmCardComponent, AssistantOperationProgressComponent, AssistantToolResultComponent],
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
      lucideChevronDown,
      lucideChevronUp,
      lucideCheck,
      lucideExpand,
      lucideShrink,
      lucideSearch,
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
              @if (endpointLabel()) {
                <p class="mt-0.5 text-[10px] text-white/60 leading-none truncate">{{ endpointLabel() }}</p>
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
              <div class="mb-8 flex flex-col items-center gap-4 text-center">
                <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  @if (imgOk()) {
                    <img src="icons/assistant.png" class="h-10 w-10 object-contain" alt="" (error)="imgOk.set(false)" />
                  } @else {
                    <ng-icon name="lucideBot" class="h-8 w-8 text-blue-500" />
                  }
                </div>
                <div class="space-y-1">
                  <h2 class="text-2xl font-semibold text-foreground">{{ noInference() ? 'Connect a model to get started' : 'How can I help you?' }}</h2>
                  @if (emptyStateHint()) {
                    <p class="text-sm text-muted-foreground">{{ emptyStateHint() }}</p>
                  }
                </div>
              </div>
              @if (noInference()) {
                <ng-container [ngTemplateOutlet]="setupCtas"></ng-container>
              } @else {
                <div class="w-full max-w-2xl">
                  <ng-container [ngTemplateOutlet]="composerTpl"></ng-container>
                </div>
              }
            </div>
          } @else {
            <div class="p-4 space-y-3" [class.mx-auto]="isFull()" [class.max-w-3xl]="isFull()" [class.w-full]="isFull()">
              @if (chatService.displayMessages().length === 0) {
                <div class="flex flex-col items-center justify-center h-full py-10 gap-4 text-center">
                  <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20">
                    @if (imgOk()) {
                      <img src="icons/assistant.png" class="h-9 w-9 object-contain" alt="" (error)="imgOk.set(false)" />
                    } @else {
                      <ng-icon name="lucideBot" class="h-7 w-7 text-blue-500" />
                    }
                  </div>
                  <div class="space-y-3">
                    <div>
                      <p class="text-sm font-medium text-foreground">{{ noInference() ? 'Connect a model to get started' : 'Ask anything' }}</p>
                      <p class="text-xs text-muted-foreground mt-0.5">{{ emptyStateHint() }}</p>
                    </div>
                    @if (noInference()) {
                      <div class="flex justify-center">
                        <ng-container [ngTemplateOutlet]="setupCtas"></ng-container>
                      </div>
                    } @else {
                      @if (recommendedHint(); as rec) {
                        <button type="button" (click)="openConnectionsSettings()"
                          class="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                          Add {{ rec.label }} — {{ rec.reason }}
                        </button>
                      }
                    }
                  </div>
                </div>
              }

              @for (msg of chatService.displayMessages(); track $index) {
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
                  <div class="flex flex-col min-w-0 flex-1" [class.items-end]="msg.role === 'user'">
                    @if (msg.role === 'user') {
                      <div class="md-user-bubble w-fit max-w-[78%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm shadow-sm bg-gradient-to-br from-blue-500 to-blue-700 text-white">
                        <p class="whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
                      </div>
                    } @else {
                      <div class="w-fit max-w-[82%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm shadow-sm bg-muted text-foreground border border-border/50">
                        <markdown class="md leading-relaxed break-words" [data]="msg.content" (ready)="onMarkdownReady()" />
                      </div>
                      @if (msg.docLinks?.length) {
                        <div class="mt-2 flex flex-wrap gap-1.5">
                          @for (link of msg.docLinks; track link.url) {
                            <a [href]="link.url" target="_blank" rel="noopener noreferrer"
                              class="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted transition-colors">
                              📖 {{ link.title }}
                            </a>
                          }
                        </div>
                      }
                      @let logSrcs = logSourcesForSteps(msg.steps);
                      @for (step of stepsWithResult(msg.steps); track step.toolCallId) {
                        <app-assistant-tool-result [step]="step" [logSources]="logSrcs" (sendMessage)="submitMessage($event)" />
                      }
                      @if (msg.steps && msg.steps.length > 0) {
                        <div class="mt-1 ml-0.5">
                          <button type="button" (click)="toggleSteps($index)"
                            class="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                            {{ expandedSteps().has($index) ? '▾' : '▸' }} {{ msg.steps.length }} tool{{ msg.steps.length === 1 ? '' : 's' }} used
                          </button>
                          @if (expandedSteps().has($index)) {
                            <div class="mt-1 rounded-lg bg-muted/50 border border-border/40 px-2.5 py-2 font-mono text-[11px] space-y-1">
                              @for (step of msg.steps; track step.toolCallId) {
                                <div class="flex items-start gap-2"
                                  [class]="step.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'">
                                  <span class="shrink-0">{{ step.ok ? '✓' : '✗' }}</span>
                                  <span>{{ step.name }}</span>
                                  @if (!step.ok && step.error) {
                                    <span class="text-muted-foreground">— {{ step.error }}</span>
                                  }
                                </div>
                              }
                            </div>
                          }
                        </div>
                      }
                      @if (msg.uiActions?.length) {
                        <div class="mt-2 flex flex-wrap gap-2">
                          @for (action of msg.uiActions; track action.label) {
                            @if (action.kind !== 'open_url' || action.url) {
                              <button type="button" (click)="executeUiAction(action)"
                                class="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors">
                                {{ action.label }}
                              </button>
                            }
                          }
                        </div>
                      }
                      @if (msg.operationPending?.length) {
                        <div class="w-full max-w-[82%]">
                          @for (op of msg.operationPending; track op.operationId) {
                            <app-assistant-operation-progress
                              [operationId]="op.operationId" [label]="op.label" />
                          }
                        </div>
                      }
                    }
                  </div>
                </div>
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

        <!-- Composer -->
        <ng-template #composerTpl>
          <div class="space-y-2" [class.mx-auto]="isFull()" [class.max-w-3xl]="isFull()" [class.w-full]="isFull()">
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
            <div class="rounded-2xl border border-input bg-muted/50 transition-shadow focus-within:ring-1 focus-within:ring-ring">
              <textarea
                [value]="draft()"
                (input)="onDraftInput($event)"
                (keydown)="onKeydown($event)"
                [disabled]="chatService.sending()"
                rows="1"
                placeholder="Ask Flui Assistant…"
                class="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 min-h-[44px] max-h-[180px]"
              ></textarea>
              <div class="flex items-center justify-between gap-2 px-2 pb-2">
                @if (pickerOptions().length > 1) {
                  <div class="relative min-w-0" (click)="$event.stopPropagation()">
                    <button type="button" (click)="pickerOpen.set(!pickerOpen())"
                      class="flex max-w-[220px] items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none">
                      <span class="truncate">{{ pickerOptions()[selectedIdx()].label }}</span>
                      <ng-icon name="lucideChevronDown" class="h-3 w-3 shrink-0 transition-transform"
                        [class.rotate-180]="pickerOpen()" />
                    </button>
                    @if (pickerOpen()) {
                      <div class="absolute bottom-full left-0 mb-2 w-80 max-h-[360px] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-popover shadow-xl z-50 text-xs">
                        <button type="button" (click)="selectPickerOpt(0)"
                          class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
                          [class.bg-accent]="selectedIdx() === 0">
                          <div class="flex-1 min-w-0">
                            <div class="font-medium text-foreground">Default (auto)</div>
                            @if (defaultModelLabel()) {
                              <div class="text-muted-foreground truncate">{{ defaultModelLabel() }}</div>
                            }
                          </div>
                          @if (selectedIdx() === 0) {
                            <ng-icon name="lucideCheck" class="h-3 w-3 text-blue-500 shrink-0" />
                          }
                        </button>
                        @if (featuredOptions().length) {
                          <div class="h-px bg-border/60 mx-2"></div>
                          @for (opt of featuredOptions(); track opt.idx) {
                            <button type="button" (click)="selectPickerOpt(opt.idx)"
                              class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
                              [class.bg-accent]="selectedIdx() === opt.idx">
                              <div class="flex-1 min-w-0">
                                <div class="font-medium text-foreground truncate">
                                  @if (opt.provider) {
                                    <span class="font-normal text-muted-foreground">{{ opt.provider }} — </span>
                                  }{{ opt.modelId }}
                                </div>
                                @if (opt.description) {
                                  <div class="text-muted-foreground truncate">{{ opt.description }}</div>
                                }
                                @if (opt.note) {
                                  <div class="mt-1">
                                    <span class="inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">{{ opt.note }}</span>
                                  </div>
                                }
                              </div>
                              @if (selectedIdx() === opt.idx) {
                                <ng-icon name="lucideCheck" class="h-3 w-3 text-blue-500 shrink-0" />
                              }
                            </button>
                          }
                        }
                        @if (otherOptions().length) {
                          <div class="h-px bg-border/60 mx-2"></div>
                          <button type="button" (click)="pickerExpanded.set(!pickerExpanded())"
                            class="w-full flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                            <ng-icon [name]="pickerExpanded() ? 'lucideChevronUp' : 'lucideChevronDown'" class="h-3 w-3 shrink-0" />
                            {{ pickerExpanded() ? 'Show fewer' : otherOptions().length + ' more' }}
                          </button>
                          @if (pickerExpanded()) {
                            <div class="sticky top-0 z-10 bg-popover px-2 py-1.5">
                              <div class="relative">
                                <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                <input type="text" [value]="pickerSearch()" (input)="onPickerSearch($event)"
                                  placeholder="Search models…"
                                  class="w-full rounded-md border border-input bg-muted/50 pl-7 pr-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                              </div>
                            </div>
                            @if (pickerSearch().trim()) {
                              @for (opt of filteredOtherOptions(); track opt.idx) {
                                <button type="button" (click)="selectPickerOpt(opt.idx)"
                                  class="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent transition-colors"
                                  [class.bg-accent]="selectedIdx() === opt.idx">
                                  <div class="flex-1 min-w-0 truncate text-foreground">{{ opt.label }}</div>
                                  @if (selectedIdx() === opt.idx) {
                                    <ng-icon name="lucideCheck" class="h-3 w-3 text-blue-500 shrink-0" />
                                  }
                                </button>
                              } @empty {
                                <div class="px-3 py-2 text-xs text-muted-foreground">No models match.</div>
                              }
                            } @else {
                              @for (group of otherGroups(); track group.key) {
                                <button type="button" (click)="toggleGroup(group.key)"
                                  class="w-full flex items-center gap-1.5 px-3 py-1.5 text-left text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                                  <ng-icon [name]="expandedGroups().has(group.key) ? 'lucideChevronUp' : 'lucideChevronDown'" class="h-3 w-3 shrink-0" />
                                  <span class="flex-1 truncate font-medium text-foreground">{{ group.label }}</span>
                                  <span class="shrink-0 text-[10px] text-muted-foreground">{{ group.options.length }}</span>
                                </button>
                                @if (expandedGroups().has(group.key)) {
                                  @for (opt of group.options; track opt.idx) {
                                    <button type="button" (click)="selectPickerOpt(opt.idx)"
                                      class="w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left hover:bg-accent transition-colors"
                                      [class.bg-accent]="selectedIdx() === opt.idx">
                                      <div class="flex-1 min-w-0 truncate text-foreground">{{ opt.modelId }}</div>
                                      @if (selectedIdx() === opt.idx) {
                                        <ng-icon name="lucideCheck" class="h-3 w-3 text-blue-500 shrink-0" />
                                      }
                                    </button>
                                  }
                                }
                              }
                            }
                          }
                        }
                        <div class="h-px bg-border/60 mx-2"></div>
                        <button type="button" (click)="openConnectionsSettings()"
                          class="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                          <span>Manage models</span>
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    }
                  </div>
                } @else {
                  <span></span>
                }
                <button type="button" (click)="submit()"
                  [disabled]="chatService.sending() || !draft().trim()"
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-500/30 transition-all hover:shadow-blue-500/40 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100">
                  <ng-icon name="lucideSend" class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </ng-template>

        <ng-template #setupCtas>
          <div class="flex w-full max-w-[280px] flex-col gap-2">
            @if (recommendedHint(); as rec) {
              <p class="text-xs text-muted-foreground">
                Recommended: <span class="font-medium text-foreground">{{ rec.label }}</span> — {{ rec.reason }}
              </p>
            }
            <button type="button" (click)="openConnectionsSettings()"
              class="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-500/30 hover:shadow-blue-500/40 transition-all">
              Connect a model
            </button>
            @if (isAdmin()) {
              <button type="button" (click)="openProviderSettings()"
                class="rounded-xl border border-input bg-muted/50 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                Configure a provider
              </button>
            }
          </div>
        </ng-template>

        @if (!showHistory() && !showCenteredComposer()) {
          <div class="shrink-0 bg-background border-t border-border/50 p-3">
            <ng-container [ngTemplateOutlet]="composerTpl"></ng-container>
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
  private readonly inferenceService = inject(InferenceSettingsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly scrollEl = viewChild<ElementRef<HTMLElement>>('scrollEl');
  private copyObserver?: MutationObserver;

  readonly expanded = signal(false);
  private readonly ready = signal(false);
  protected readonly hasOpened = signal(false);
  protected readonly sizeMode = signal<SizeMode>('compact');
  protected readonly draft = signal('');
  protected readonly selectedIdx = signal(0);
  protected readonly imgOk = signal(true);
  protected readonly showHistory = signal(false);
  protected readonly expandedSteps = signal(new Set<number>());
  protected readonly pickerOpen = signal(false);
  protected readonly pickerExpanded = signal(false);
  protected readonly pickerSearch = signal('');
  protected readonly expandedGroups = signal(new Set<string>());
  private historyIdx = -1;

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

  protected readonly defaultModelLabel = computed(() => {
    const provider = this.inferenceService.providers().find((p) => p.euDataResidency) ?? this.inferenceService.providers()[0];
    return provider?.defaultModel ?? this.inferenceService.recommendations()?.recommendedProvider.defaultModel ?? '';
  });

  protected readonly featuredOptions = computed<EnrichedOption[]>(() => {
    const result: EnrichedOption[] = [];
    this.pickerOptions().forEach((opt, idx) => {
      if (idx === 0) return;
      const rec = this.inferenceService.recommendedModelFor(opt.opts);
      if (!rec) return;
      const provider =
        opt.opts?.provider ??
        this.inferenceService.connections().find((c) => c.id === opt.opts?.connectionId)?.label ??
        '';
      result.push({ idx, label: opt.label, modelId: rec.model, provider, description: rec.description, note: rec.note, opts: opt.opts });
    });
    return result;
  });

  protected readonly otherOptions = computed<EnrichedOption[]>(() => {
    const result: EnrichedOption[] = [];
    this.pickerOptions().forEach((opt, idx) => {
      if (idx === 0) return;
      if (this.inferenceService.recommendedModelFor(opt.opts)) return;
      result.push({ idx, label: opt.label, modelId: opt.opts?.model, opts: opt.opts });
    });
    return result;
  });

  protected readonly otherGroups = computed(() => {
    const groups = new Map<string, { key: string; label: string; options: EnrichedOption[] }>();
    for (const opt of this.otherOptions()) {
      const isProvider = !!opt.opts?.provider;
      const key = isProvider ? `p:${opt.opts?.provider}` : `c:${opt.opts?.connectionId}`;
      const label =
        opt.opts?.provider ??
        this.inferenceService.connections().find((c) => c.id === opt.opts?.connectionId)?.label ??
        'Other';
      let g = groups.get(key);
      if (!g) {
        g = { key, label, options: [] };
        groups.set(key, g);
      }
      g.options.push(opt);
    }
    return Array.from(groups.values());
  });

  protected readonly filteredOtherOptions = computed<EnrichedOption[]>(() => {
    const q = this.pickerSearch().trim().toLowerCase();
    if (!q) return [];
    return this.otherOptions().filter((o) => (o.opts?.model ?? o.label).toLowerCase().includes(q));
  });

  protected readonly recommendedHint = computed(() => {
    const rec = this.inferenceService.recommendations()?.recommendedProvider;
    if (!rec) return null;
    const configured = this.pickerOptions().some(
      (o, i) => i > 0 && this.inferenceService.groupFor(o.opts)?.key === rec.key,
    );
    return configured ? null : rec;
  });

  protected readonly emptyStateHint = computed(() => {
    const providers = this.inferenceService.providers();
    const connections = this.inferenceService.connections();
    if (providers.length === 0 && connections.length === 0) {
      return 'No inference endpoint is configured yet.';
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
    effect(() => {
      const opts = this.pickerOptions();
      this.inferenceService.recommendations();
      this.inferenceService.connections();
      this.selectedIdx.set(this.resolveSelectionIdx(opts));
    });
  }

  private resolveSelectionIdx(opts: PickerOption[]): number {
    const stored = this.readStored();
    if (stored) {
      const idx = this.findStoredIdx(opts, stored);
      if (idx >= 0) return idx;
    }
    return this.preselectIdx(opts);
  }

  private findStoredIdx(opts: PickerOption[], stored: StoredSelection): number {
    if ('kind' in stored) return 0;
    return opts.findIndex(
      (o, i) =>
        i > 0 &&
        o.opts?.provider === stored.provider &&
        o.opts?.connectionId === stored.connectionId &&
        o.opts?.model === stored.model,
    );
  }

  private preselectIdx(opts: PickerOption[]): number {
    const rec = this.inferenceService.recommendations();
    if (!rec) return 0;
    const want = rec.recommendedProvider;
    const wantIdx = opts.findIndex(
      (o, i) => i > 0 && this.inferenceService.groupFor(o.opts)?.key === want.key && o.opts?.model === want.defaultModel,
    );
    if (wantIdx >= 0) return wantIdx;
    const defIdx = opts.findIndex((o, i) => i > 0 && !!this.inferenceService.recommendedModelFor(o.opts)?.isDefault);
    return Math.max(defIdx, 0);
  }

  private readStored(): StoredSelection | null {
    try {
      const raw = localStorage.getItem(SELECTION_KEY);
      return raw ? (JSON.parse(raw) as StoredSelection) : null;
    } catch {
      return null;
    }
  }

  private writeStored(opts: PickerOption['opts']): void {
    const sel: StoredSelection = opts
      ? { provider: opts.provider, connectionId: opts.connectionId, model: opts.model }
      : { kind: 'auto' };
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(sel));
    } catch {
      /* storage unavailable */
    }
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

  private dismissForNav(): void {
    this.pickerOpen.set(false);
    this.expanded.set(false);
    if (this.sizeMode() === 'full') this.sizeMode.set('compact');
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.isFull()) this.sizeMode.set('medium');
  }

  protected toggleSteps(idx: number): void {
    this.expandedSteps.update((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
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

  protected onDraftInput(e: Event): void {
    this.draft.set((e.target as HTMLTextAreaElement).value);
  }

  @HostListener('document:click')
  protected closePicker(): void {
    this.pickerOpen.set(false);
    this.pickerSearch.set('');
  }

  protected selectPickerOpt(idx: number): void {
    this.selectedIdx.set(idx);
    this.pickerOpen.set(false);
    this.pickerSearch.set('');
    this.writeStored(this.pickerOptions()[idx]?.opts ?? null);
  }

  protected onPickerSearch(e: Event): void {
    this.pickerSearch.set((e.target as HTMLInputElement).value);
  }

  protected toggleGroup(key: string): void {
    this.expandedGroups.update((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  protected onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.submit();
    } else if (e.key === 'ArrowUp') {
      this.historyOlder(e);
    } else if (e.key === 'ArrowDown') {
      this.historyNewer(e);
    }
  }

  private userHistory(): string[] {
    return this.chatService
      .messages()
      .filter((m) => m.role === 'user' && m.content)
      .map((m) => m.content ?? '');
  }

  private historyOlder(e: KeyboardEvent): void {
    if (this.historyIdx === -1 && this.draft().trim()) return;
    const msgs = this.userHistory();
    const idx = this.historyIdx + 1;
    if (idx >= msgs.length) return;
    e.preventDefault();
    this.historyIdx = idx;
    this.draft.set(msgs[msgs.length - 1 - idx]);
    this.moveCaretToEnd(e.target as HTMLTextAreaElement);
  }

  private historyNewer(e: KeyboardEvent): void {
    if (this.historyIdx < 0) return;
    e.preventDefault();
    const idx = this.historyIdx - 1;
    if (idx < 0) {
      this.historyIdx = -1;
      this.draft.set('');
      return;
    }
    const msgs = this.userHistory();
    this.historyIdx = idx;
    this.draft.set(msgs[msgs.length - 1 - idx]);
  }

  private moveCaretToEnd(ta: HTMLTextAreaElement): void {
    setTimeout(() => {
      if (ta.isConnected) ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  }

  private appLogsKey(step: AgentToolStep): string {
    const res = step.result as { app?: string; namespace?: string; cluster_id?: string };
    return `${res.app ?? ''}\x00${res.namespace ?? ''}\x00${res.cluster_id ?? ''}`;
  }

  protected stepsWithResult(steps: AgentToolStep[] | undefined): AgentToolStep[] {
    if (!steps) return [];
    const withResult = steps.filter((s) => s.result != null);

    const lastIdxByKey = new Map<string, number>();
    withResult.forEach((s, i) => {
      if (s.name === 'app_logs') lastIdxByKey.set(this.appLogsKey(s), i);
    });

    return withResult.filter((s, i) => s.name !== 'app_logs' || lastIdxByKey.get(this.appLogsKey(s)) === i);
  }

  protected logSourcesForSteps(steps: AgentToolStep[] | undefined): LogSourcesResult | null {
    const src = steps?.find((s) => s.name === 'log_sources' && s.result != null);
    return src ? (src.result as LogSourcesResult) : null;
  }

  protected executeUiAction(action: UiAction): void {
    if (action.kind === 'open_url') {
      if (!action.url) return;
      window.open(action.url, '_blank', 'noopener,noreferrer');
      return;
    }
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action.url;
    form.target = '_blank';
    form.style.display = 'none';
    for (const [name, value] of Object.entries(action.fields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  protected submitMessage(content: string): void {
    const opts = this.pickerOptions()[this.selectedIdx()]?.opts;
    this.historyIdx = -1;
    this.stickToBottom = true;
    this.chatService.send(content, opts ?? undefined);
  }

  protected submit(): void {
    const content = this.draft().trim();
    if (!content || this.chatService.sending()) return;
    const selectedOpts = this.pickerOptions()[this.selectedIdx()]?.opts ?? undefined;
    this.draft.set('');
    this.historyIdx = -1;
    this.stickToBottom = true;
    this.chatService.send(content, selectedOpts ?? undefined);
  }
}
