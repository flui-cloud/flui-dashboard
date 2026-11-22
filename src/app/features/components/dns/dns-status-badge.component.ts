import { Component, computed, input } from '@angular/core';
import {
  CertificateStatus,
  DnsReconciliationStatus,
  getCertificateBadgeColor,
  getCertificateBadgeLabel,
  getReconciliationBadgeColor,
  getReconciliationBadgeLabel,
} from '../../model/dns.models';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

const TONE_BY_COLOR: Record<string, StatusTone> = {
  green: 'success',
  yellow: 'warning',
  red: 'error',
  blue: 'progress',
  gray: 'neutral',
};

@Component({
  selector: 'app-dns-status-badge',
  imports: [FlStatus],
  host: { class: 'inline-flex' },
  template: `<fl-status [tone]="tone()" [label]="label()" />`,
})
export class DnsStatusBadgeComponent {
  readonly status = input.required<DnsReconciliationStatus | CertificateStatus | string | null>();
  readonly type = input<'reconciliation' | 'certificate'>('reconciliation');

  readonly color = computed(() => {
    const s = this.status();
    return this.type() === 'certificate'
      ? getCertificateBadgeColor(s as CertificateStatus)
      : getReconciliationBadgeColor(s as DnsReconciliationStatus);
  });

  readonly label = computed(() => {
    const s = this.status();
    return this.type() === 'certificate'
      ? getCertificateBadgeLabel(s as CertificateStatus)
      : getReconciliationBadgeLabel(s as DnsReconciliationStatus);
  });

  readonly tone = computed<StatusTone>(() => TONE_BY_COLOR[this.color()] ?? 'neutral');
}
