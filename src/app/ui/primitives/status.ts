import { Component, computed, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleMinus,
  lucideCircleX,
  lucideLoaderCircle,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { FlIcon } from './icon';

export type StatusTone = 'success' | 'warning' | 'error' | 'neutral' | 'progress';

const ICONS: Record<StatusTone, string> = {
  success: 'lucideCircleCheck',
  warning: 'lucideTriangleAlert',
  error: 'lucideCircleX',
  neutral: 'lucideCircleMinus',
  progress: 'lucideLoaderCircle',
};

@Component({
  selector: 'fl-status',
  imports: [FlIcon],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideTriangleAlert,
      lucideCircleX,
      lucideCircleMinus,
      lucideLoaderCircle,
    }),
  ],
  host: { '[class]': '"fl-status fl-status--" + tone()' },
  template: `<fl-icon [name]="icon()" [size]="14" /><span>{{ label() }}</span>`,
})
export class FlStatus {
  readonly tone = input.required<StatusTone>();
  readonly label = input.required<string>();
  protected readonly icon = computed(() => ICONS[this.tone()]);
}
