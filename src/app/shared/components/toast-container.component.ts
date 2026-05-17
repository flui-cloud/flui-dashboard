import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleAlert,
  lucideTriangleAlert,
  lucideInfo,
  lucideX,
} from '@ng-icons/lucide';

import { Toast, ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIcon],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideCircleAlert,
      lucideTriangleAlert,
      lucideInfo,
      lucideX,
    }),
  ],
  template: `
    <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      @for (t of toastService.toasts(); track t.id) {
        <div
          class="pointer-events-auto rounded-lg border shadow-lg px-3 py-2.5 flex items-start gap-2.5 animate-in slide-in-from-right duration-200"
          [class]="containerClass(t)"
        >
          <ng-icon [name]="iconName(t)" class="h-5 w-5 flex-shrink-0 mt-0.5" [class]="iconClass(t)" />
          <div class="flex-1 min-w-0">
            @if (t.title) {
              <p class="text-sm font-semibold" [class]="titleClass(t)">{{ t.title }}</p>
            }
            <p class="text-xs" [class]="messageClass(t)">{{ t.message }}</p>
            @if (t.action) {
              <div class="mt-1.5">
                @if (t.action.routerLink) {
                  <a
                    [routerLink]="t.action.routerLink"
                    (click)="onActionClick(t)"
                    class="text-xs font-medium underline hover:no-underline"
                    [class]="titleClass(t)"
                  >
                    {{ t.action.label }}
                  </a>
                } @else {
                  <button
                    type="button"
                    (click)="onActionClick(t)"
                    class="text-xs font-medium underline hover:no-underline"
                    [class]="titleClass(t)"
                  >
                    {{ t.action.label }}
                  </button>
                }
              </div>
            }
          </div>
          <button
            type="button"
            (click)="toastService.dismiss(t.id)"
            class="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            aria-label="Dismiss"
          >
            <ng-icon name="lucideX" class="h-4 w-4" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  protected toastService = inject(ToastService);

  iconName(t: Toast): string {
    switch (t.kind) {
      case 'success': return 'lucideCircleCheck';
      case 'warning': return 'lucideTriangleAlert';
      case 'error': return 'lucideCircleAlert';
      default: return 'lucideInfo';
    }
  }

  containerClass(t: Toast): string {
    switch (t.kind) {
      case 'success':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
      case 'error':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
      default:
        return 'border-border bg-background';
    }
  }

  iconClass(t: Toast): string {
    switch (t.kind) {
      case 'success': return 'text-green-600 dark:text-green-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-muted-foreground';
    }
  }

  titleClass(t: Toast): string {
    switch (t.kind) {
      case 'success': return 'text-green-900 dark:text-green-200';
      case 'warning': return 'text-yellow-900 dark:text-yellow-200';
      case 'error': return 'text-red-900 dark:text-red-200';
      default: return 'text-foreground';
    }
  }

  messageClass(t: Toast): string {
    switch (t.kind) {
      case 'success': return 'text-green-800 dark:text-green-300';
      case 'warning': return 'text-yellow-800 dark:text-yellow-300';
      case 'error': return 'text-red-800 dark:text-red-300';
      default: return 'text-muted-foreground';
    }
  }

  onActionClick(t: Toast): void {
    t.action?.onClick?.();
    this.toastService.dismiss(t.id);
  }
}
