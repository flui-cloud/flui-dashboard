import { Component, computed, input } from '@angular/core';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { RecordVerdict, proofTone } from '../../model/mail-console.models';

const TONE: Record<ReturnType<typeof proofTone>, StatusTone> = {
  ok: 'success',
  warn: 'warning',
  bad: 'error',
  none: 'neutral',
};

@Component({
  selector: 'app-mail-proof-pill',
  imports: [FlStatus],
  host: { '[attr.title]': 'hint()' },
  template: `<fl-status [tone]="tone()" [label]="text()" />`,
})
export class MailProofPillComponent {
  readonly purpose = input.required<'spf' | 'dkim' | 'dmarc'>();
  readonly verdict = input<RecordVerdict | undefined>(undefined);

  protected readonly label = computed(() => this.purpose().toUpperCase());

  protected readonly tone = computed<StatusTone>(() => {
    if (this.verdict() === 'pending') return 'progress';
    return TONE[proofTone(this.purpose(), this.verdict())];
  });

  protected readonly text = computed(() => {
    switch (this.verdict()) {
      case 'ok':
        return 'Valid';
      case 'pending':
        return 'Pending';
      case 'mismatch':
        return 'Mismatch';
      case 'missing':
        return 'Missing';
      default:
        return 'Not needed';
    }
  });

  protected readonly hint = computed(() => {
    const verdict = this.verdict();
    if (verdict === undefined) {
      return `This provider asks for no ${this.label()} record, so there is nothing to prove`;
    }
    if (verdict === 'ok') return `${this.label()} checks out`;
    if (verdict === 'pending') {
      return `${this.label()} is published — the provider has not accepted it yet`;
    }
    if (verdict === 'mismatch') {
      return `${this.label()} is published but does not match what the provider asked for`;
    }
    return this.purpose() === 'dmarc'
      ? 'No DMARC record. It does not block sending, but without it you get no reports and no policy.'
      : `No ${this.label()} record — mail from this domain is unauthenticated`;
  });
}
