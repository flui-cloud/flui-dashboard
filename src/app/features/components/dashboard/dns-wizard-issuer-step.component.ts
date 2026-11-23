import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DnsSetupWizardService } from './dns-setup-wizard.service';
import { DashboardDnsService } from '../../service/dashboard-dns.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

type PhaseStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

const PHASE_TONES: Record<PhaseStatus, StatusTone> = {
  pending: 'neutral',
  running: 'progress',
  done: 'success',
  error: 'error',
  skipped: 'neutral',
};

@Component({
  selector: 'app-dns-wizard-issuer-step',
  imports: [FormsModule, FlAlert, FlField, FlKeyValue, FlKvItem, FlLoadingState, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    @if (wiz.certMode() === 'direct') {
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        Certificates are issued by Let's Encrypt with the HTTP-01 challenge.
      </p>

      @if (wiz.loadingHttpIssuer()) {
        <fl-loading-state [rows]="2" />
      } @else if (wiz.existingHttpIssuerEmail()) {
        <fl-status tone="success" label="HTTP-01 issuer already configured" />
        <fl-key-value>
          <fl-kv-item key="ACME email" [mono]="true">{{
            wiz.existingHttpIssuerEmail()
          }}</fl-kv-item>
        </fl-key-value>
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          To change the email, open
          <a [href]="issuerSettingsUrl()" target="_blank" rel="noopener" class="fl-link"
            >cluster certificates</a
          >.
        </p>
      } @else if (wiz.issuerPhase() === 'idle' || wiz.issuerPhase() === 'error') {
        <fl-field
          label="ACME email"
          for="dns-acme-email"
          hint="Let's Encrypt writes here about expiring certificates."
        >
          <div class="fl-input fl-input--lg">
            <input
              id="dns-acme-email"
              type="email"
              [ngModel]="acmeEmailInput()"
              (ngModelChange)="onEmailChange($event)"
              placeholder="you@example.com"
              [attr.aria-invalid]="!!wiz.setupError()"
            />
          </div>
        </fl-field>

        @if (wiz.setupError()) {
          <fl-alert tone="error" title="Issuer not configured">{{ wiz.setupError() }}</fl-alert>
        }

        <fl-alert tone="info" title="Next saves the issuer">
          You then set up the app endpoints.
        </fl-alert>
      } @else {
        @if (wiz.issuerPhase() === 'done') {
          <fl-status tone="success" label="HTTP-01 issuer configured" />
          <fl-key-value>
            <fl-kv-item key="ACME email" [mono]="true">{{ wiz.directAcmeEmail() }}</fl-kv-item>
          </fl-key-value>
        } @else {
          <fl-status tone="progress" label="Configuring the issuer…" />
        }

        @if (wiz.setupError()) {
          <fl-alert tone="error" title="Issuer not configured">{{ wiz.setupError() }}</fl-alert>
        }
      }
    } @else {
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        @if (wiz.issuerPhase() === 'done') {
          Configuration complete. The issuers are active.
        } @else {
          Flui sets everything up by itself. This takes a few seconds.
        }
      </p>

      <ol class="m-0 flex list-none flex-col gap-2 p-0">
        @for (phase of wiz.setupPhases(); track phase.key) {
          <li class="flex flex-col gap-0.5">
            <fl-status
              [tone]="tone(phase.status)"
              [label]="phase.status === 'skipped' ? phase.label + ' (skipped)' : phase.label"
            />
            @if (phase.issuerMessage) {
              <span class="truncate pl-5 text-fl-caption text-fl-ink-muted">{{
                phase.issuerMessage
              }}</span>
            }
          </li>
        }
      </ol>

      @if (wiz.setupError()) {
        <fl-alert tone="error" title="Setup failed">{{ wiz.setupError() }}</fl-alert>
      }

      @if (wiz.issuerPhase() === 'done') {
        <fl-status
          tone="success"
          label="Both issuers are ready. Certificates are issued automatically."
        />
      }
    }
  `,
})
export class DnsWizardIssuerStepComponent {
  protected wiz = inject(DnsSetupWizardService);
  protected dashboardDns = inject(DashboardDnsService);
  protected readonly acmeEmailInput = signal('');

  protected tone(status: PhaseStatus): StatusTone {
    return PHASE_TONES[status];
  }

  protected onEmailChange(value: string): void {
    this.acmeEmailInput.set(value);
    this.wiz.directAcmeEmail.set(value);
  }

  protected issuerSettingsUrl(): string {
    const id = this.dashboardDns.targetClusterId();
    return `/cluster/${id}/dns#standard-certificate-issuers`;
  }
}
