import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideGlobe } from '@ng-icons/lucide';
import { DnsSetupWizardService } from './dns-setup-wizard.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-dns-wizard-zone-step',
  imports: [
    FormsModule,
    RouterLink,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlEmptyState,
    FlButton,
    FlSpinner,
    FlStatus,
  ],
  providers: [provideIcons({ lucideGlobe })],
  host: { class: 'fl-stack' },
  template: `
    @if (wiz.loadingExisting() || wiz.loadingZoneOptions()) {
      <div
        class="flex items-center gap-2 text-fl-body-sm text-fl-ink-muted"
        data-testid="zone-loading"
      >
        <fl-spinner label="Loading domains" />
        Loading your domains…
      </div>
    } @else if (wiz.zoneOptions().length === 0 && wiz.configuredDnsProviders().length === 0) {
      <fl-empty-state
        data-testid="zone-no-provider"
        icon="lucideGlobe"
        [compact]="true"
        title="No DNS provider configured"
        body="Set up a DNS provider first to use a domain."
      >
        <a flButton size="sm" routerLink="/infrastructure/domains">Go to domains</a>
      </fl-empty-state>
    } @else {
      @if (wiz.zoneOptions().length > 0) {
        <fieldset class="fl-fieldset">
          <legend>Which domain do you want to use?</legend>
          <div class="flex max-h-72 flex-col gap-2 overflow-y-auto" data-testid="zone-options">
            @for (zone of wiz.zoneOptions(); track zone.key) {
              <label class="fl-radiocard" [attr.data-testid]="'zone-option-' + zone.zoneName">
                <input
                  type="radio"
                  name="zoneChoice"
                  [value]="zone.key"
                  [ngModel]="wiz.selectedZoneKey()"
                  (ngModelChange)="wiz.selectZone($event)"
                  [disabled]="wiz.registeringZone()"
                />
                <span class="fl-radiocard__text min-w-0 flex-1">
                  <span class="fl-radiocard__title fl-mono truncate">{{ zone.zoneName }}</span>
                  <span class="fl-radiocard__desc">{{ zone.provider }}</span>
                </span>
                @if (!zone.registeredId) {
                  <fl-status tone="neutral" label="Not added yet" data-testid="zone-not-added" />
                }
              </label>
            }
          </div>
        </fieldset>
      } @else {
        <fl-alert
          tone="warning"
          data-testid="zone-none-found"
          [title]="'No domains found in ' + wiz.configuredDnsProviders().join(', ')"
        />
      }

      @if (wiz.unreadableZoneProviders().length > 0) {
        <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="zone-unreadable">
          Could not read the domains of {{ wiz.unreadableZoneProviders().join(', ') }}.
        </p>
      }

      @if (wiz.existingZone()) {
        <div class="flex flex-col gap-2">
          <fl-key-value>
            <fl-kv-item key="Contact email">
              <span data-testid="zone-email-fixed">{{ wiz.acmeEmail() }}</span>
            </fl-kv-item>
          </fl-key-value>
          <p class="m-0 text-fl-caption text-fl-ink-muted">
            Fixed after the first setup.
            <a routerLink="/infrastructure/domains" class="fl-link">Manage DNS zones</a>
          </p>
        </div>
      } @else {
        <fl-field
          label="Contact email"
          for="zone-email"
          hint="Let's Encrypt writes here about expiring certificates."
        >
          <div class="fl-input fl-input--lg">
            <input
              id="zone-email"
              type="email"
              [ngModel]="wiz.acmeEmail()"
              (ngModelChange)="wiz.acmeEmail.set($event)"
              placeholder="you@example.com"
              data-testid="zone-email"
            />
          </div>
        </fl-field>
      }

      @if (wiz.zoneError()) {
        <fl-alert tone="error" title="Domain not added" data-testid="zone-error">
          {{ wiz.zoneError() }}
        </fl-alert>
      }

      <fl-alert tone="info" title="Don't see your domain?" data-testid="zone-hint">
        @if (wiz.configuredDnsProviders().length > 0) {
          Buy it on {{ wiz.configuredDnsProviders()[0] }}, or point its nameservers there from your
          registrar. It then shows up here.
        } @else {
          No DNS provider is configured yet.
          <a routerLink="/infrastructure/domains" class="fl-link">Set one up</a>.
        }
        @if (wiz.configuredDnsProviders().length > 0 && firstProviderDelegation; as delegation) {
          <a
            alertActions
            flButton
            size="sm"
            [href]="delegation.delegationGuideUrl"
            target="_blank"
            rel="noopener"
          >
            How to point the nameservers
          </a>
        }
      </fl-alert>
    }
  `,
})
export class DnsWizardZoneStepComponent {
  protected wiz = inject(DnsSetupWizardService);

  get firstProviderDelegation() {
    const first = this.wiz.configuredDnsProviders()[0];
    if (!first) return undefined;
    return this.wiz.dnsZonesService.dnsCapableProviders().find((p) => p.id === first)
      ?.dnsZoneDelegation;
  }
}
