import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

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
  imports: [RouterModule, NgIcon],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideCircleAlert,
      lucideTriangleAlert,
      lucideInfo,
      lucideX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="fixed top-16 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      @for (t of toastService.toasts(); track t.id) {
        <div
          class="pointer-events-auto rounded-lg border shadow-lg px-3 py-2.5 flex items-start gap-2.5 animate-in slide-in-from-right duration-200"
          [class]="containerClass(t)"
        >
          <ng-icon [name]="iconName(t)" class="h-4 w-4 flex-shrink-0 mt-0.5" [class]="iconClass(t)" />
          <div class="flex-1 min-w-0">
            @if (t.title) {
              <p class="text-sm font-medium text-foreground">{{ t.title }}</p>
            }
            <p class="text-xs text-muted-foreground">{{ t.message }}</p>
            @if (t.action) {
              <div class="mt-1.5">
                @if (t.action.routerLink) {
                  <a
                    [routerLink]="t.action.routerLink"
                    (click)="onActionClick(t)"
                    class="text-xs font-medium text-foreground underline hover:no-underline"
                  >
                    {{ t.action.label }}
                  </a>
                } @else {
                  <button
                    type="button"
                    (click)="onActionClick(t)"
                    class="text-xs font-medium text-foreground underline hover:no-underline"
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
    return t.kind === 'error' ? 'border-destructive/40 bg-card' : 'border-border bg-card';
  }

  iconClass(t: Toast): string {
    switch (t.kind) {
      case 'success': return 'text-[hsl(var(--ok))]';
      case 'warning': return 'text-[hsl(var(--warn))]';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  }

  onActionClick(t: Toast): void {
    t.action?.onClick?.();
    this.toastService.dismiss(t.id);
  }
}
