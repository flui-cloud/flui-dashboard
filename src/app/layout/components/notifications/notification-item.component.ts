import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronUp,
  lucideExternalLink,
  lucideX,
  lucideZap,
} from '@ng-icons/lucide';
import { AppNotification } from '../../../core/services/notification.service';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

@Component({
  selector: 'app-notification-item',
  imports: [RouterLink, FlButton, FlIcon, FlStatus],
  providers: [
    provideIcons({ lucideX, lucideExternalLink, lucideChevronDown, lucideChevronUp, lucideZap }),
  ],
  host: { class: 'block' },
  template: `
    <div
      class="flex cursor-pointer flex-col gap-1 py-3 pl-4 pr-2 hover:bg-fl-surface-hover"
      [class.bg-fl-accent-row]="!notification().read"
      (click)="clicked.emit()"
    >
      <div class="flex items-center justify-between gap-2">
        <fl-status [tone]="tone()" [label]="statusLabel()" />
        <div class="flex shrink-0 items-center gap-1">
          <span class="fl-num whitespace-nowrap text-fl-caption text-fl-ink-muted">{{
            timeAgo()
          }}</span>
          <button
            flButton="ghost"
            size="sm"
            [iconOnly]="true"
            type="button"
            aria-label="Remove"
            title="Remove"
            (click)="onDelete($event)"
          >
            <fl-icon name="lucideX" />
          </button>
        </div>
      </div>

      <p class="pr-2 text-fl-body-sm font-medium text-fl-ink">{{ notification().title }}</p>

      @if (notification().body) {
        <p class="pr-2 text-fl-caption text-fl-ink-secondary">
          {{ isLongBody() && !expanded() ? truncatedBody() : notification().body }}
        </p>
        @if (isLongBody()) {
          <button
            type="button"
            class="fl-link inline-flex items-center gap-1 self-start text-fl-caption"
            (click)="onToggleExpand($event)"
          >
            <fl-icon [name]="expanded() ? 'lucideChevronUp' : 'lucideChevronDown'" [size]="13" />
            {{ expanded() ? 'Show less' : 'Show more' }}
          </button>
        }
      }

      @if (notification().link || notification().action) {
        <div class="fl-row mt-1">
          @if (notification().link) {
            <a
              class="fl-link inline-flex items-center gap-1 text-fl-caption"
              [routerLink]="notification().link!.route"
              (click)="onLinkClick($event)"
            >
              <fl-icon name="lucideExternalLink" [size]="13" />
              {{ notification().link!.label }}
            </a>
          }
          @if (notification().action) {
            <button flButton size="sm" type="button" (click)="onActionClick($event)">
              <fl-icon name="lucideZap" />
              {{ notification().action!.label }}
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class NotificationItemComponent {
  notification = input.required<AppNotification>();
  expanded = input<boolean>(false);

  clicked = output<void>();
  deleted = output<void>();
  expandToggled = output<void>();
  linkClicked = output<void>();
  actionTriggered = output<void>();

  readonly tone = computed<StatusTone>(() => {
    switch (this.notification().type) {
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'neutral';
    }
  });

  readonly statusLabel = computed(() => {
    switch (this.notification().type) {
      case 'success':
        return 'Succeeded';
      case 'warning':
        return 'Warning';
      case 'error':
        return 'Failed';
      default:
        return 'Info';
    }
  });

  readonly isLongBody = computed(() => (this.notification().body?.length ?? 0) > 100);

  readonly truncatedBody = computed(() => this.notification().body?.slice(0, 100) + '…');

  readonly timeAgo = computed(() => {
    const diff = Date.now() - this.notification().createdAt.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  });

  onDelete(e: Event): void {
    e.stopPropagation();
    this.deleted.emit();
  }

  onToggleExpand(e: Event): void {
    e.stopPropagation();
    this.expandToggled.emit();
  }

  onLinkClick(e: Event): void {
    e.stopPropagation();
    this.linkClicked.emit();
  }

  onActionClick(e: Event): void {
    e.stopPropagation();
    this.actionTriggered.emit();
  }
}
