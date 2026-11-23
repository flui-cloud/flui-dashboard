import { Component, computed, inject, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
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
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { AssistantModelSelectionService } from '../../service/assistant-model-selection.service';
import { AssistantModelPickerComponent } from './assistant-model-picker.component';

@Component({
  selector: 'app-assistant-panel-header',
  imports: [FlButton, FlIcon, AssistantModelPickerComponent],
  providers: [
    provideIcons({
      lucideChevronLeft,
      lucideExpand,
      lucideHistory,
      lucideMaximize2,
      lucideMinimize2,
      lucideShrink,
      lucideSquarePen,
      lucideTrash2,
      lucideX,
    }),
  ],
  host: { class: 'block shrink-0' },
  template: `
    <header class="fl-panel__header">
      @if (history()) {
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <button
            flButton="ghost"
            size="sm"
            [iconOnly]="true"
            type="button"
            aria-label="Back to the conversation"
            (click)="back.emit()"
          >
            <fl-icon name="lucideChevronLeft" />
          </button>
          <h2 class="fl-panel__title truncate">Conversations</h2>
        </div>
      } @else {
        <div class="flex min-w-0 flex-1 flex-col">
          <h2 class="fl-panel__title truncate">Flui Assistant</h2>
          @if (endpointLabel()) {
            <span class="truncate text-fl-caption text-fl-ink-muted">{{ endpointLabel() }}</span>
          }
        </div>
      }
      <div class="fl-panel__actions">
        @if (canResize()) {
          <button
            flButton="ghost"
            size="sm"
            [iconOnly]="true"
            type="button"
            [attr.aria-label]="mediumActive() ? 'Make smaller' : 'Make larger'"
            (click)="toggleMedium.emit()"
          >
            <fl-icon [name]="mediumActive() ? 'lucideMinimize2' : 'lucideMaximize2'" />
          </button>
        }
        <button
          flButton="ghost"
          size="sm"
          [iconOnly]="true"
          type="button"
          [attr.aria-label]="isFull() ? 'Exit full screen' : 'Full screen'"
          (click)="toggleFullscreen.emit()"
        >
          <fl-icon [name]="isFull() ? 'lucideShrink' : 'lucideExpand'" />
        </button>
        <button
          flButton="ghost"
          size="sm"
          [iconOnly]="true"
          type="button"
          aria-label="Close"
          (click)="closed.emit()"
        >
          <fl-icon name="lucideX" />
        </button>
      </div>
    </header>
    @if (showToolbar()) {
      <div class="fl-toolbar">
        <div class="min-w-0">
          <app-assistant-model-picker placement="below" (navigated)="navigated.emit()" />
        </div>
        <div class="fl-toolbar__group">
          @if (messageCount() > 0) {
            <button
              flButton="ghost"
              size="sm"
              [iconOnly]="true"
              type="button"
              aria-label="New conversation"
              (click)="newConversation.emit()"
            >
              <fl-icon name="lucideSquarePen" />
            </button>
          }
          @if (conversationCount() > 1) {
            <button
              flButton="ghost"
              size="sm"
              type="button"
              [attr.aria-label]="'Conversations, ' + conversationCount()"
              (click)="openHistory.emit()"
            >
              <fl-icon name="lucideHistory" />
              {{ conversationCount() }}
            </button>
          }
          @if (messageCount() > 0) {
            <button
              flButton="ghost"
              size="sm"
              [iconOnly]="true"
              type="button"
              aria-label="Clear conversation"
              (click)="clear.emit()"
            >
              <fl-icon name="lucideTrash2" />
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class AssistantPanelHeader {
  private readonly sel = inject(AssistantModelSelectionService);

  readonly history = input(false);
  readonly endpointLabel = input<string | null | undefined>('');
  readonly messageCount = input(0);
  readonly conversationCount = input(0);
  readonly canResize = input(false);
  readonly mediumActive = input(false);
  readonly isFull = input(false);

  readonly back = output<void>();
  readonly clear = output<void>();
  readonly newConversation = output<void>();
  readonly openHistory = output<void>();
  readonly toggleMedium = output<void>();
  readonly toggleFullscreen = output<void>();
  readonly closed = output<void>();
  readonly navigated = output<void>();

  protected readonly showToolbar = computed(
    () =>
      !this.history() &&
      (this.sel.pickerOptions().length > 1 ||
        this.messageCount() > 0 ||
        this.conversationCount() > 1),
  );
}
