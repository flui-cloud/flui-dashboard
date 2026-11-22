import { Component, computed, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCircleX, lucideInfo, lucideTriangleAlert } from '@ng-icons/lucide';
import { FlIcon } from '../primitives/icon';

export type AlertTone = 'warning' | 'error' | 'info';

const ICONS: Record<AlertTone, string> = {
  warning: 'lucideTriangleAlert',
  error: 'lucideCircleX',
  info: 'lucideInfo',
};

@Component({
  selector: 'fl-alert',
  imports: [FlIcon],
  providers: [provideIcons({ lucideTriangleAlert, lucideCircleX, lucideInfo })],
  host: {
    '[class]': '"fl-alert fl-alert--" + tone()',
    '[attr.role]': 'tone() === "info" ? "status" : "alert"',
  },
  template: `
    <fl-icon [name]="icon()" [size]="18" />
    <div class="fl-alert__text">
      <span class="fl-alert__title">{{ title() }}</span>
      <span class="fl-alert__body"><ng-content /></span>
      <div class="fl-alert__actions"><ng-content select="[alertActions]" /></div>
    </div>
  `,
})
export class FlAlert {
  readonly tone = input<AlertTone>('info');
  readonly title = input.required<string>();
  protected readonly icon = computed(() => ICONS[this.tone()]);
}
