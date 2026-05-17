import { Component, input, computed } from '@angular/core';
import {
  DnsReconciliationStatus,
  CertificateStatus,
  getReconciliationBadgeColor,
  getReconciliationBadgeLabel,
  getReconciliationIcon,
  getCertificateBadgeColor,
  getCertificateBadgeLabel,
  getCertificateIcon,
} from '../../model/dns.models';

@Component({
  selector: 'app-dns-status-badge',
  standalone: true,
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
    :host { display: inline-block; }
    .badge-gray   { @apply bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300; }
    .badge-green  { @apply bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300; }
    .badge-yellow { @apply bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300; }
    .badge-blue   { @apply bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300; }
    .badge-red    { @apply bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300; }
  `]
})
export class DnsStatusBadgeComponent {
  status = input.required<DnsReconciliationStatus | CertificateStatus | string | null>();
  type = input<'reconciliation' | 'certificate'>('reconciliation');

  color = computed(() => {
    const s = this.status();
    return this.type() === 'certificate'
      ? getCertificateBadgeColor(s as CertificateStatus)
      : getReconciliationBadgeColor(s as DnsReconciliationStatus);
  });

  label = computed(() => {
    const s = this.status();
    return this.type() === 'certificate'
      ? getCertificateBadgeLabel(s as CertificateStatus)
      : getReconciliationBadgeLabel(s as DnsReconciliationStatus);
  });

  icon = computed(() => {
    const s = this.status();
    return this.type() === 'certificate'
      ? getCertificateIcon(s as CertificateStatus)
      : getReconciliationIcon(s as DnsReconciliationStatus);
  });

  badgeClasses = computed(() => `badge-${this.color()}`);
}
