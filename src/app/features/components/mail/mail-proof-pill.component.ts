import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RecordVerdict, proofTone } from '../../model/mail-console.models';

@Component({
  selector: 'app-mail-proof-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
      [class]="classes()"
      [title]="hint()"
    >
      <span class="font-mono">{{ glyph() }}</span>
      {{ label() }}
    </span>
  `,
})
export class MailProofPillComponent {
  readonly purpose = input.required<'spf' | 'dkim' | 'dmarc'>();
  readonly verdict = input<RecordVerdict | undefined>(undefined);

  protected readonly label = computed(() => this.purpose().toUpperCase());
  private readonly tone = computed(() => proofTone(this.purpose(), this.verdict()));

  protected readonly glyph = computed(() => {
    switch (this.tone()) {
      case 'ok':
        return '✓';
      case 'warn':
        return this.verdict() === 'pending' ? '⏳' : '!';
      case 'none':
        return '–';
      default:
        return '✕';
    }
  });

  protected readonly classes = computed(() => {
    switch (this.tone()) {
      case 'ok':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400';
      case 'warn':
        return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400';
      case 'none':
        return 'border-border bg-muted text-muted-foreground';
      default:
        return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400';
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
