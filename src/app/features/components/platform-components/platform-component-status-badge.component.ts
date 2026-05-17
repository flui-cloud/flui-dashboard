import { Component, input } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleAlert,
  lucideCircleMinus,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-platform-component-status-badge',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideCircleCheck, lucideCircleAlert, lucideCircleMinus })],
  template: `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" [class]="badgeClass()">
      <ng-icon [name]="icon()" class="h-3 w-3" />
      {{ label() }}
    </span>
  `,
})
export class PlatformComponentStatusBadgeComponent {
  status = input.required<string>();

  label() {
    switch (this.status()) {
      case 'healthy': return 'Healthy';
      case 'degraded': return 'Degraded';
      case 'missing': return 'Missing';
      default: return this.status();
    }
  }

  icon() {
    switch (this.status()) {
      case 'healthy': return 'lucideCircleCheck';
      case 'degraded': return 'lucideCircleAlert';
      default: return 'lucideCircleMinus';
    }
  }

  badgeClass() {
    switch (this.status()) {
      case 'healthy':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'missing':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  }
}
