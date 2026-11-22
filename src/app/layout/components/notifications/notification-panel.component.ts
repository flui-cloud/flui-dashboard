import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBell, lucideCheck } from '@ng-icons/lucide';
import {
  AppNotification,
  NotificationService,
} from '../../../core/services/notification.service';
import { NotificationItemComponent } from './notification-item.component';

@Component({
  selector: 'app-notification-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, NotificationItemComponent],
  providers: [provideIcons({ lucideBell, lucideCheck })],
  template: `
    <div class="relative">
      <button
        type="button"
        class="fl-topbar__icon"
        [attr.aria-label]="triggerLabel()"
        [attr.aria-expanded]="isOpen()"
        (click)="togglePanel($event)"
      >
        <ng-icon name="lucideBell" size="17px" />
        @if (notifService.unreadCount() > 0) {
          <span class="fl-topbar__dot"></span>
        }
      </button>

      @if (isOpen()) {
        <div class="fl-popover" role="dialog" aria-label="Notifications" (click)="$event.stopPropagation()">
          <div class="fl-popover__header">
            <span class="fl-popover__title">Notifications</span>
            <div class="flex items-center gap-1">
              @if (notifService.unreadCount() > 0) {
                <button type="button" class="fl-btn fl-btn--ghost fl-btn--sm" (click)="notifService.markAllRead()">
                  <ng-icon name="lucideCheck" />
                  Mark all read
                </button>
              }
              @if (notifService.notifications().length > 0) {
                <button type="button" class="fl-btn fl-btn--ghost fl-btn--sm" (click)="notifService.clear()">
                  Clear all
                </button>
              }
            </div>
          </div>

          <div class="fl-popover__body">
            @if (notifService.notifications().length === 0) {
              <div class="fl-state fl-state--compact">
                <p class="fl-state__title">No notifications</p>
                <p class="fl-state__body">Events from deployments and clusters appear here.</p>
              </div>
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
              {{ notifService.notifications().length }} notification{{ notifService.notifications().length !== 1 ? 's' : '' }}
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

  protected isOpen = signal(false);
  protected expandedId = signal<string | null>(null);

  protected readonly triggerLabel = computed(() => {
    const count = this.notifService.unreadCount();
    return count > 0 ? `Notifications, ${count} unread` : 'Notifications';
  });

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
    }
  }

  togglePanel(event: Event): void {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  onItemClicked(notif: AppNotification): void {
    this.notifService.markRead(notif.id);
    this.expandedId.update(current => current === notif.id ? null : notif.id);
  }

  toggleExpanded(id: string): void {
    this.expandedId.update(current => current === id ? null : id);
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
