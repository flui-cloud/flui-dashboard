import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideBell, lucideCheck } from '@ng-icons/lucide';
import { AppNotification, NotificationService } from '../../../core/services/notification.service';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { NotificationItemComponent } from './notification-item.component';

@Component({
  selector: 'app-notification-panel',
  imports: [FlEmptyState, FlButton, FlIcon, NotificationItemComponent],
  providers: [provideIcons({ lucideBell, lucideCheck })],
  host: { '(document:click)': 'onDocumentClick()', '(document:keydown.escape)': 'onEscape()' },
  template: `
    <div class="relative">
      <button
        #trigger
        type="button"
        class="fl-topbar__icon"
        [attr.aria-label]="triggerLabel()"
        [attr.aria-expanded]="isOpen()"
        (click)="togglePanel($event)"
      >
        <fl-icon name="lucideBell" />
        @if (notifService.unreadCount() > 0) {
          <span class="fl-topbar__dot"></span>
        }
      </button>

      @if (isOpen()) {
        <div
          class="fl-popover max-sm:fixed max-sm:inset-x-3 max-sm:top-14 max-sm:w-auto"
          role="dialog"
          aria-label="Notifications"
          (click)="$event.stopPropagation()"
        >
          <div class="fl-popover__header">
            <span class="fl-popover__title">Notifications</span>
            <div class="fl-row gap-1">
              @if (notifService.unreadCount() > 0) {
                <button
                  flButton="ghost"
                  size="sm"
                  type="button"
                  (click)="notifService.markAllRead()"
                >
                  <fl-icon name="lucideCheck" />
                  Mark all read
                </button>
              }
              @if (notifService.notifications().length > 0) {
                <button flButton="ghost" size="sm" type="button" (click)="notifService.clear()">
                  Clear all
                </button>
              }
            </div>
          </div>

          <div class="fl-popover__body">
            @if (notifService.notifications().length === 0) {
              <fl-empty-state
                icon="lucideBell"
                title="No notifications"
                body="Events from deployments and clusters appear here."
                [compact]="true"
              />
            } @else {
              @for (notif of notifService.notifications(); track notif.id) {
                <app-notification-item
                  [notification]="notif"
                  [expanded]="expandedId() === notif.id"
                  (clicked)="onItemClicked(notif)"
                  (deleted)="notifService.remove(notif.id)"
                  (expandToggled)="toggleExpanded(notif.id)"
                  (linkClicked)="onLinkClicked(notif)"
                  (actionTriggered)="onActionTriggered(notif)"
                />
              }
            }
          </div>

          @if (notifService.notifications().length > 0) {
            <div class="fl-popover__footer">
              {{ notifService.notifications().length }} notification{{
                notifService.notifications().length !== 1 ? 's' : ''
              }}
              @if (notifService.unreadCount() > 0) {
                · {{ notifService.unreadCount() }} unread
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class NotificationPanelComponent {
  protected notifService = inject(NotificationService);
  private readonly router = inject(Router);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  protected isOpen = signal(false);
  protected expandedId = signal<string | null>(null);

  protected readonly triggerLabel = computed(() => {
    const count = this.notifService.unreadCount();
    return count > 0 ? `Notifications, ${count} unread` : 'Notifications';
  });

  onDocumentClick(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
    }
  }

  onEscape(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.trigger().nativeElement.focus();
  }

  togglePanel(event: Event): void {
    event.stopPropagation();
    this.isOpen.update((v) => !v);
  }

  onItemClicked(notif: AppNotification): void {
    this.notifService.markRead(notif.id);
    this.expandedId.update((current) => (current === notif.id ? null : notif.id));
  }

  toggleExpanded(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  onLinkClicked(notif: AppNotification): void {
    if (notif.link) {
      this.notifService.markRead(notif.id);
      this.router.navigateByUrl(notif.link.route);
      this.isOpen.set(false);
    }
  }

  onActionTriggered(notif: AppNotification): void {
    if (notif.action) {
      this.notifService.markRead(notif.id);
      this.notifService.triggerAction(notif.action.key);
      this.isOpen.set(false);
    }
  }
}
