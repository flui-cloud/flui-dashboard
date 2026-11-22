import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleX,
  lucideInfo,
  lucideTriangleAlert,
  lucideX,
} from '@ng-icons/lucide';
import { FlIcon } from '../primitives/icon';

export type ToastTone = 'success' | 'warning' | 'error' | 'info';

const ICONS: Record<ToastTone, string> = {
  success: 'lucideCircleCheck',
  warning: 'lucideTriangleAlert',
  error: 'lucideCircleX',
  info: 'lucideInfo',
};

@Component({
  selector: 'fl-toast',
  imports: [FlIcon],
  providers: [
    provideIcons({ lucideCircleCheck, lucideTriangleAlert, lucideCircleX, lucideInfo, lucideX }),
  ],
  host: {
    '[class]': '"fl-toast fl-toast--" + tone()',
    '[attr.role]': 'tone() === "error" ? "alert" : "status"',
  },
  template: `
    <fl-icon [name]="icon()" />
    <div class="fl-toast__text">
      <span class="fl-toast__title">{{ title() }}</span>
      @if (body()) {
        <span class="fl-toast__body">{{ body() }}</span>
      }
    </div>
    <button type="button" class="fl-toast__close" aria-label="Dismiss" (click)="dismiss.emit()">
      <fl-icon name="lucideX" [size]="14" />
    </button>
  `,
})
export class FlToast {
  readonly tone = input<ToastTone>('info');
  readonly title = input.required<string>();
  readonly body = input<string>();
  readonly dismiss = output<void>();
  protected readonly icon = computed(() => ICONS[this.tone()]);
}
