import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReconciliationStatus, getDriftIndicator } from '../../model/firewall-v2.models';

/**
 * Component to display drift status indicator
 *
 * Shows whether the firewall's desired state matches the applied state
 * on the cloud provider.
 */
@Component({
  selector: 'app-drift-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="containerClasses()" class="flex items-center gap-2 text-sm">
      <span [class]="iconClasses()" class="text-lg">{{ icon() }}</span>
      <span>{{ message() }}</span>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .in-sync {
      @apply text-green-700 dark:text-green-400;
    }

    .drift {
      @apply text-yellow-700 dark:text-yellow-400;
    }

    .pending {
      @apply text-gray-600 dark:text-gray-400;
    }

    .error {
      @apply text-red-700 dark:text-red-400;
    }
  `]
})
export class DriftIndicatorComponent {
  // Input signals
  hasDrift = input.required<boolean>();
  status = input.required<ReconciliationStatus | string>();
  showDetails = input<boolean>(false);
  desiredHash = input<string>();
  lastAppliedHash = input<string>();

  // Computed signals
  normalizedStatus = computed(() => {
    const value = this.status();
    return typeof value === 'string' ? value as ReconciliationStatus : value;
  });

  message = computed(() => {
    return getDriftIndicator(this.hasDrift(), this.normalizedStatus());
  });

  icon = computed(() => {
    if (!this.hasDrift() && this.normalizedStatus() === ReconciliationStatus.IN_SYNC) {
      return '✓';
    }

    switch (this.normalizedStatus()) {
      case ReconciliationStatus.DRIFT:
        return '⚠';
      case ReconciliationStatus.PENDING:
        return '○';
      case ReconciliationStatus.ERROR:
        return '✗';
      case ReconciliationStatus.RECONCILING:
        return '⟳';
      default:
        return '?';
    }
  });

  containerClasses = computed(() => {
    if (!this.hasDrift() && this.normalizedStatus() === ReconciliationStatus.IN_SYNC) {
      return 'in-sync';
    }

    switch (this.normalizedStatus()) {
      case ReconciliationStatus.DRIFT:
        return 'drift';
      case ReconciliationStatus.PENDING:
        return 'pending';
      case ReconciliationStatus.ERROR:
        return 'error';
      default:
        return 'pending';
    }
  });

  iconClasses = computed(() => {
    return 'font-bold';
  });

  showHashInfo = computed(() => {
    return this.showDetails() && this.desiredHash() && this.lastAppliedHash();
  });
}
