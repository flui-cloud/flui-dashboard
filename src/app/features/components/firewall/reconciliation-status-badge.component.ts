import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReconciliationStatus, getStatusBadgeColor, getStatusBadgeLabel } from '../../model/firewall-v2.models';

/**
 * Badge component to display firewall reconciliation status
 *
 * Visual indicators:
 * - PENDING: Gray badge
 * - IN_SYNC: Green badge
 * - DRIFT: Yellow/Orange badge
 * - RECONCILING: Blue badge
 * - ERROR: Red badge
 */
@Component({
  selector: 'app-reconciliation-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      [class]="badgeClasses()"
      class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
    >
      <span [innerHTML]="icon()"></span>
      {{ label() }}
    </span>
  `,
  styles: [`
    :host {
      display: inline-block;
    }

    .badge-gray {
      @apply bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300;
    }

    .badge-green {
      @apply bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300;
    }

    .badge-yellow {
      @apply bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300;
    }

    .badge-blue {
      @apply bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300;
    }

    .badge-red {
      @apply bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300;
    }
  `]
})
export class ReconciliationStatusBadgeComponent {
  // Input signal
  status = input.required<ReconciliationStatus | string>();

  // Computed signals
  normalizedStatus = computed(() => {
    const value = this.status();
    return typeof value === 'string' ? value as ReconciliationStatus : value;
  });

  badgeColor = computed(() => getStatusBadgeColor(this.normalizedStatus()));

  label = computed(() => getStatusBadgeLabel(this.normalizedStatus()));

  badgeClasses = computed(() => {
    const color = this.badgeColor();
    return `badge-${color}`;
  });

  icon = computed(() => {
    const status = this.normalizedStatus();
    switch (status) {
      case ReconciliationStatus.PENDING:
        return '○'; // Circle outline
      case ReconciliationStatus.IN_SYNC:
        return '✓'; // Checkmark
      case ReconciliationStatus.DRIFT:
        return '⚠'; // Warning sign
      case ReconciliationStatus.RECONCILING:
        return '⟳'; // Circular arrows
      case ReconciliationStatus.ERROR:
        return '✗'; // X mark
      default:
        return '?';
    }
  });
}
