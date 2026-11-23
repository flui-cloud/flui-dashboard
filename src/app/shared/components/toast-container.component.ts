import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleX,
  lucideTriangleAlert,
  lucideInfo,
  lucideX,
} from '@ng-icons/lucide';
import { FlIcon } from '../../ui/primitives/icon';
import { Toast, ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  imports: [RouterModule, FlIcon],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideCircleX,
      lucideTriangleAlert,
      lucideInfo,
      lucideX,
    }),
  ],
  template: `
    <div class="fl-toasts pointer-events-none">
      @for (t of toastService.toasts(); track t.id) {
        <div
          class="pointer-events-auto"
          [class]="'fl-toast fl-toast--' + tone(t)"
          [attr.role]="t.kind === 'error' ? 'alert' : 'status'"
        >
          <fl-icon [name]="iconName(t)" />
          <div class="fl-toast__text">
            @if (t.title) {
              <span class="fl-toast__title">{{ t.title }}</span>
              <span class="fl-toast__body">{{ t.message }}</span>
            } @else {
              <span>{{ t.message }}</span>
            }
            @if (t.action) {
              <div class="mt-1">
                @if (t.action.routerLink) {
                  <a class="fl-link" [routerLink]="t.action.routerLink" (click)="onActionClick(t)">
                    {{ t.action.label }}
                  </a>
                } @else {
                  <button
                    type="button"
                    class="fl-link cursor-pointer border-0 bg-transparent p-0"
                    (click)="onActionClick(t)"
                  >
                    {{ t.action.label }}
                  </button>
                }
              </div>
            }
          </div>
          <button
            type="button"
            class="fl-toast__close"
            aria-label="Dismiss"
            (click)="toastService.dismiss(t.id)"
          >
            <fl-icon name="lucideX" [size]="14" />
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
      case 'success':
        return 'lucideCircleCheck';
      case 'warning':
        return 'lucideTriangleAlert';
      case 'error':
        return 'lucideCircleX';
      default:
        return 'lucideInfo';
    }
  }

  tone(t: Toast): string {
    switch (t.kind) {
      case 'success':
      case 'warning':
      case 'error':
        return t.kind;
      default:
        return 'info';
    }
  }

  onActionClick(t: Toast): void {
    t.action?.onClick?.();
    this.toastService.dismiss(t.id);
  }
}
