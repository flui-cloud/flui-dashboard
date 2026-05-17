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
      <!-- Bell button -->
      <button
        (click)="togglePanel($event)"
        class="relative p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        [title]="notifService.unreadCount() + ' unread notifications'"
      >
        <ng-icon name="lucideBell" class="!h-4 !w-4" />
        @if (notifService.unreadCount() > 0) {
          <span
            class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-4 text-center bg-red-500 text-white"
          >
            {{ badgeLabel() }}
          </span>
        }
      </button>

      <!-- Dropdown panel -->
      @if (isOpen()) {
        <div
          class="absolute right-0 top-full mt-1 w-80 z-50 rounded-lg border border-border bg-popover shadow-xl overflow-hidden animate-slide-in-from-top"
          (click)="$event.stopPropagation()"
        >
          <!-- Panel header -->
          <div class="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <span class="text-sm font-semibold text-foreground">Notifications</span>
            <div class="flex items-center gap-3">
              @if (notifService.unreadCount() > 0) {
                <button
                  (click)="notifService.markAllRead()"
                  class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ng-icon name="lucideCheck" class="!h-3 !w-3" />
                  Mark all read
                </button>
              }
              @if (notifService.notifications().length > 0) {
                <button
                  (click)="notifService.clear()"
                  class="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear all
                </button>
              }
            </div>
          </div>

          <!-- Notification list -->
          <div class="max-h-[420px] overflow-y-auto divide-y divide-border/50">
            @if (notifService.notifications().length === 0) {
              <div class="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
                <ng-icon name="lucideBell" class="!h-8 !w-8 text-muted-foreground opacity-30" />
                <p class="text-sm font-medium text-muted-foreground">No notifications</p>
                <p class="text-xs text-muted-foreground">
                  Events from deployments and clusters will appear here.
                </p>
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

          <!-- Footer count -->
          @if (notifService.notifications().length > 0) {
            <div class="px-3 py-2 border-t border-border/50 text-center">
              <span class="text-[11px] text-muted-foreground">
                {{ notifService.notifications().length }} notification{{ notifService.notifications().length !== 1 ? 's' : '' }}
                @if (notifService.unreadCount() > 0) {
                  · {{ notifService.unreadCount() }} unread
                }
              </span>
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

  protected readonly badgeLabel = computed(() => {
    const count = this.notifService.unreadCount();
    return count > 99 ? '99+' : String(count);
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
