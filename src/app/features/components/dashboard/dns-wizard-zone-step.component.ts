import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideGlobe, lucideExternalLink, lucideMail } from '@ng-icons/lucide';
import { DnsSetupWizardService } from './dns-setup-wizard.service';

@Component({
  selector: 'app-dns-wizard-zone-step',
  standalone: true,
  imports: [FormsModule, RouterLink, NgIconComponent],
  providers: [provideIcons({ lucideLoader, lucideGlobe, lucideExternalLink, lucideMail })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <h3 class="text-sm font-semibold text-foreground mb-1">Which domain do you want to use?</h3>

    @if (wiz.loadingExisting() || wiz.loadingZoneOptions()) {
      <div class="flex-1 flex flex-col items-center justify-center gap-2 py-6" data-testid="zone-loading">
        <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin text-muted-foreground" />
        <p class="text-xs text-muted-foreground">Loading your domains…</p>
      </div>
    } @else if (wiz.zoneOptions().length === 0 && wiz.configuredDnsProviders().length === 0) {
      <div class="flex-1 flex flex-col items-center justify-center gap-3 py-4" data-testid="zone-no-provider">
        <ng-icon name="lucideGlobe" class="h-8 w-8 text-muted-foreground/40" />
        <div class="text-center">
          <p class="text-sm font-medium text-foreground">No DNS provider configured</p>
          <p class="text-xs text-muted-foreground mt-0.5">Set up a DNS provider first to use a domain.</p>
        </div>
        <a routerLink="/infrastructure/domains" class="text-xs text-primary hover:underline flex items-center gap-1">
          Go to DNS section
          <ng-icon name="lucideExternalLink" class="h-3 w-3" />
        </a>
      </div>
    } @else {
      <div class="flex flex-col gap-3 flex-1 p-2">
        @if (wiz.zoneOptions().length > 0) {
          <div>
            <label class="text-xs font-medium text-foreground block mb-1.5">Domain</label>
            <div class="space-y-1 max-h-36 overflow-y-auto rounded-md border border-input p-1.5" data-testid="zone-options">
              @for (zone of wiz.zoneOptions(); track zone.key) {
                <label
                  class="flex items-center gap-2.5 px-2.5 py-1.5 rounded cursor-pointer hover:bg-muted/60 transition-colors"
                  [attr.data-testid]="'zone-option-' + zone.zoneName"
                >
                  <input
                    type="radio"
                    name="zoneChoice"
                    [value]="zone.key"
                    [ngModel]="wiz.selectedZoneKey()"
                    (ngModelChange)="wiz.selectZone($event)"
                    [disabled]="wiz.registeringZone()"
                    class="text-primary"
                  />
                  <span class="text-sm font-mono text-foreground flex-1 truncate">{{ zone.zoneName }}</span>
                  @if (!zone.registeredId) {
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground" data-testid="zone-not-added">Not added yet</span>
                  }
                  <span class="text-[11px] text-muted-foreground">{{ zone.provider }}</span>
                </label>
              }
            </div>
          </div>
        } @else {
          <div class="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5" data-testid="zone-none-found">
            <p class="text-xs font-medium text-amber-800 dark:text-amber-300">
              No domains found in {{ wiz.configuredDnsProviders().join(', ') }}
            </p>
          </div>
        }

        @if (wiz.unreadableZoneProviders().length > 0) {
          <p class="text-xs text-muted-foreground" data-testid="zone-unreadable">
            Could not read the domains of {{ wiz.unreadableZoneProviders().join(', ') }}.
          </p>
        }

        <div>
          <label class="text-xs font-medium text-foreground block mb-1.5">Contact email</label>
          @if (wiz.existingZone()) {
            <div class="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground flex items-center gap-2" data-testid="zone-email-fixed">
              <ng-icon name="lucideMail" class="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              {{ wiz.acmeEmail() }}
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              Fixed after the first setup.
              <a routerLink="/infrastructure/domains" class="text-primary hover:underline">Manage DNS zones</a>
            </p>
          } @else {
            <input
              type="email"
              [ngModel]="wiz.acmeEmail()"
              (ngModelChange)="wiz.acmeEmail.set($event)"
              placeholder="your@email.com"
              data-testid="zone-email"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p class="text-xs text-muted-foreground mt-1">Let's Encrypt writes here about expiring certificates.</p>
          }
        </div>

        @if (wiz.zoneError()) {
          <p class="text-xs text-destructive" data-testid="zone-error">{{ wiz.zoneError() }}</p>
        }

        <div class="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 space-y-1" data-testid="zone-hint">
          <p class="text-xs font-medium text-amber-800 dark:text-amber-300">Don't see your domain?</p>
          @if (wiz.configuredDnsProviders().length > 0) {
            <p class="text-xs text-amber-700 dark:text-amber-400">
              Buy it on <span class="font-semibold">{{ wiz.configuredDnsProviders()[0] }}</span>, or point its nameservers there from your registrar. It then shows up here.
            </p>
            @if (firstProviderDelegation; as delegation) {
              <a
                [href]="delegation.delegationGuideUrl"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 underline"
              >
                How to point the nameservers
                <ng-icon name="lucideExternalLink" class="h-3 w-3" />
              </a>
            }
          } @else {
            <p class="text-xs text-amber-700 dark:text-amber-400">
              No DNS provider is configured yet.
              <a routerLink="/infrastructure/domains" class="underline">Set one up</a>.
            </p>
          }
        </div>
      </div>
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
