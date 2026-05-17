import { Component, computed, input } from '@angular/core';
import { AppBuildResponseDto } from '../../../../core/api/model/appBuildResponseDto';

const BASE = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';

function statusClass(status: AppBuildResponseDto['status']): string {
  switch (status) {
    case 'COMPLETED': return `${BASE} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`;
    case 'FAILED':    return `${BASE} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`;
    case 'BUILDING':
    case 'PUSHING':
    case 'CLONING':
    case 'ANALYZING': return `${BASE} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`;
    case 'CANCELLED': return `${BASE} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400`;
    default:          return `${BASE} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300`;
  }
}

@Component({
  selector: 'app-build-status-badge',
  standalone: true,
  template: `<span [class]="cssClass()">{{ status() }}</span>`,
})
export class AppBuildStatusBadgeComponent {
  status = input.required<AppBuildResponseDto['status']>();
  cssClass = computed(() => statusClass(this.status()));
}
