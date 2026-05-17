import { Component, Input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleX,
  lucideCirclePause,
  lucideLoader,
  lucideCircleAlert,
  lucideCircleHelp,
  lucideTrash,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-instance-status-badge',
  standalone: true,
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideCircleX,
      lucideCirclePause,
      lucideLoader,
      lucideCircleAlert,
      lucideCircleHelp,
      lucideTrash,
    }),
  ],
  template: `
    <div class="relative group inline-flex items-center">
      <ng-icon
        [name]="getStatusIcon()"
        [class]="getStatusIconClass()"
        class="h-5 w-5 cursor-help"
      />
      <!-- Tooltip -->
      <div
        class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-md shadow-md border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50"
      >
        {{ getStatusLabel() }}
        <div
          class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover"
        ></div>
      </div>
    </div>
  `,
})
export class InstanceStatusBadgeComponent {
  @Input({ required: true }) status!: string;

  getStatusIcon(): string {
    switch (this.status) {
      case 'running':
        return 'lucideCircleCheck';
      case 'stopped':
        return 'lucideCirclePause';
      case 'starting':
      case 'stopping':
      case 'provisioning':
      case 'rebuilding':
      case 'migrating':
        return 'lucideLoader';
      case 'error':
        return 'lucideCircleAlert';
      case 'deleting':
        return 'lucideTrash';
      case 'unknown':
      default:
        return 'lucideCircleHelp';
    }
  }

  getStatusIconClass(): string {
    switch (this.status) {
      case 'running':
        return 'text-green-600 dark:text-green-400';
      case 'stopped':
        return 'text-gray-500 dark:text-gray-400';
      case 'starting':
      case 'stopping':
      case 'provisioning':
      case 'rebuilding':
      case 'migrating':
        return 'text-blue-600 dark:text-blue-400 animate-spin';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'deleting':
        return 'text-orange-600 dark:text-orange-400';
      case 'unknown':
      default:
        return 'text-muted-foreground';
    }
  }

  getStatusLabel(): string {
    switch (this.status) {
      case 'running':
        return 'Running';
      case 'stopped':
        return 'Stopped';
      case 'starting':
        return 'Starting...';
      case 'stopping':
        return 'Stopping...';
      case 'provisioning':
        return 'Provisioning...';
      case 'error':
        return 'Error';
      case 'unknown':
        return 'Unknown';
      case 'rebuilding':
        return 'Rebuilding...';
      case 'migrating':
        return 'Migrating...';
      case 'deleting':
        return 'Deleting...';
      default:
        return this.status;
    }
  }
}
