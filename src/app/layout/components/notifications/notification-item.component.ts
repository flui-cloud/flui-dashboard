import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronUp,
  lucideExternalLink,
  lucideX,
  lucideZap,
} from '@ng-icons/lucide';
import { AppNotification } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, RouterLink],
  providers: [
    provideIcons({ lucideX, lucideExternalLink, lucideChevronDown, lucideChevronUp, lucideZap }),
  ],
  template: `
    <div
      class="group relative flex gap-2.5 p-3 cursor-pointer transition-colors"
      [class]="notification().read
        ? 'hover:bg-muted/50'
        : 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/60 dark:hover:bg-blue-950/30'"
      (click)="clicked.emit()"
    >
      <!-- Left type bar -->
      <div class="w-0.5 flex-shrink-0 rounded-full self-stretch" [class]="typeBarClass()"></div>

      <!-- Content -->
      <div class="flex-1 min-w-0 space-y-1">
        <!-- Title + time + delete -->
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-foreground leading-tight">
            {{ notification().title }}
          </p>
          <div class="flex items-center gap-1 flex-shrink-0">
            <span class="text-[11px] text-muted-foreground whitespace-nowrap">{{ timeAgo() }}</span>
            <button
              (click)="onDelete($event)"
              class="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
              title="Remove"
            >
              <ng-icon name="lucideX" class="!h-3 !w-3" />
            </button>
          </div>
        </div>

        <!-- Body -->
        @if (notification().body) {
          <p class="text-xs text-muted-foreground leading-relaxed">
            {{ isLongBody() && !expanded() ? truncatedBody() : notification().body }}
          </p>
          @if (isLongBody()) {
            <button
              (click)="onToggleExpand($event)"
              class="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
            >
              <ng-icon [name]="expanded() ? 'lucideChevronUp' : 'lucideChevronDown'" class="!h-3 !w-3" />
              {{ expanded() ? 'Show less' : 'Show more' }}
            </button>
          }
        }

        <!-- Link and/or Action row -->
        @if (notification().link || notification().action) {
          <div class="flex items-center gap-2 mt-0.5 flex-wrap">
            @if (notification().link) {
              <a
                [routerLink]="notification().link!.route"
                (click)="onLinkClick($event)"
                class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ng-icon name="lucideExternalLink" class="!h-3 !w-3" />
                {{ notification().link!.label }}
              </a>
            }
            @if (notification().action) {
              <button
                (click)="onActionClick($event)"
                class="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded px-2 py-0.5 transition-colors"
              >
                <ng-icon name="lucideZap" class="!h-3 !w-3" />
                {{ notification().action!.label }}
              </button>
            }
          </div>
        }
      </div>
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

  readonly typeBarClass = computed(() => {
    switch (this.notification().type) {
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error':   return 'bg-red-500';
      default:        return 'bg-blue-500';
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
