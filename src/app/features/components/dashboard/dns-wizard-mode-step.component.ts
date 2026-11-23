import { Component, inject } from '@angular/core';
import { DnsSetupWizardService, CertMode } from './dns-setup-wizard.service';

interface ModeOption {
  readonly id: CertMode;
  readonly title: string;
  readonly description: string;
  readonly detail: string;
}

const OPTIONS: readonly ModeOption[] = [
  {
    id: 'wildcard',
    title: 'One certificate for everything (recommended)',
    description:
      'A single wildcard certificate covers all apps. Faster to activate and easier to manage.',
    detail:
      'Uses the DNS-01 challenge: Flui adds a TXT record to your domain through your DNS provider API, so the provider must offer one (for example Hetzner DNS or Cloudflare).',
  },
  {
    id: 'direct',
    title: 'One certificate per app',
    description:
      'Three individual certificates, one per app. No DNS provider API needed, but activation takes longer.',
    detail:
      "Uses the HTTP-01 challenge: Let's Encrypt contacts each app over HTTP to verify that you own the domain.",
  },
];

@Component({
  selector: 'app-dns-wizard-mode-step',
  host: { class: 'fl-stack' },
  template: `
    <fieldset class="fl-fieldset">
      <legend>How do you want to secure your apps?</legend>
      @for (option of options; track option.id) {
        <label class="fl-radiocard">
          <input
            type="radio"
            name="dns-cert-mode"
            [checked]="wiz.certMode() === option.id"
            (change)="wiz.certMode.set(option.id)"
          />
          <span class="fl-radiocard__text">
            <span class="fl-radiocard__title">{{ option.title }}</span>
            <span class="fl-radiocard__desc">{{ option.description }}</span>
            <span class="fl-radiocard__desc">{{ option.detail }}</span>
          </span>
        </label>
      }
    </fieldset>
    <p class="m-0 text-fl-body-sm text-fl-ink-muted">
      You can change it later in the DNS section of the cluster.
    </p>
  `,
})
export class DnsWizardModeStepComponent {
  protected wiz = inject(DnsSetupWizardService);
  protected readonly options = OPTIONS;
}
