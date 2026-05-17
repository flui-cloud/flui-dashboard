import { Component, inject } from '@angular/core';
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
  template: `
    <h3 class="text-sm font-semibold text-foreground mb-1">Which domain do you want to use?</h3>

    @if (wiz.loadingExisting()) {
      <div class="flex-1 flex items-center justify-center">
        <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    } @else if (wiz.dnsZonesService.zones().length === 0) {
      <!-- Inline zone registration flow -->
      <div class="flex flex-col gap-3 flex-1 p-2">

        @if (wiz.zoneRegPhase() === 'loading') {
          <div class="flex-1 flex flex-col items-center justify-center gap-2">
            <ng-icon name="lucideLoader" class="h-6 w-6 animate-spin text-muted-foreground" />
            <p class="text-xs text-muted-foreground">Loading DNS providers…</p>
          </div>

        } @else if (wiz.zoneRegPhase() === 'error' && wiz.zoneRegProviders().length === 0) {
          <!-- No provider configured at all -->
          <div class="flex-1 flex flex-col items-center justify-center gap-3 py-4">
            <ng-icon name="lucideGlobe" class="h-8 w-8 text-muted-foreground/40" />
            <div class="text-center">
              <p class="text-sm font-medium text-foreground">No DNS provider configured</p>
              <p class="text-xs text-muted-foreground mt-0.5">Set up a DNS provider first to register a domain.</p>
            </div>
            <a routerLink="/infrastructure/domains" class="text-xs text-primary hover:underline flex items-center gap-1">
              Go to DNS section
              <ng-icon name="lucideExternalLink" class="h-3 w-3" />
            </a>
          </div>

        } @else if (wiz.zoneRegPhase() === 'select' || wiz.zoneRegPhase() === 'registering' || wiz.zoneRegPhase() === 'error') {
          <!-- Provider selector (if more than one) -->
          @if (wiz.zoneRegProviders().length > 1) {
            <div>
              <label class="text-xs font-medium text-foreground block mb-1.5">DNS Provider</label>
              <select
                [ngModel]="wiz.zoneRegSelectedProvider()"
                (ngModelChange)="wiz.onZoneRegProviderChange($event)"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                @for (p of wiz.zoneRegProviders(); track p) {
                  <option [value]="p">{{ p }}</option>
                }
              </select>
            </div>
          }

          <!-- Zone list or empty state -->
          @if (wiz.zoneRegLoadingZones()) {
            <div class="flex items-center gap-2 py-3">
              <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin text-muted-foreground" />
              <p class="text-xs text-muted-foreground">Loading zones from {{ wiz.zoneRegSelectedProvider() }}…</p>
            </div>
          } @else if (wiz.zoneRegProviderZones().length === 0) {
            <!-- No zones on this provider -->
            <div class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2">
              <p class="text-xs font-semibold text-amber-800 dark:text-amber-300">No DNS zones found in your {{ wiz.zoneRegSelectedProvider() }} account</p>
              <p class="text-xs text-amber-700 dark:text-amber-400">
                Zones are read directly from <span class="font-semibold">{{ wiz.zoneRegSelectedProvider() }}</span> via API. To add a domain:
              </p>
              <ul class="text-xs text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
                <li>Purchase a domain on <span class="font-semibold">{{ wiz.zoneRegSelectedProvider() }}</span> — it will appear here automatically.</li>
                <li>Transfer an existing domain by updating its nameservers at your current registrar.</li>
              </ul>
            </div>
          } @else {
            <!-- Zone picker -->
            <div>
              <label class="text-xs font-medium text-foreground block mb-1.5">
                Select a domain from <span class="font-semibold">{{ wiz.zoneRegSelectedProvider() }}</span>
              </label>
              <div class="space-y-1 max-h-36 overflow-y-auto rounded-md border border-input p-1.5">
                @for (zone of wiz.zoneRegProviderZones(); track zone.zoneId) {
                  <label class="flex items-center gap-2.5 px-2.5 py-1.5 rounded cursor-pointer hover:bg-muted/60 transition-colors">
                    <input
                      type="radio"
                      name="zoneReg"
                      [value]="zone.zoneId"
                      [ngModel]="wiz.zoneRegSelectedZoneId()"
                      (ngModelChange)="wiz.zoneRegSelectedZoneId.set($event)"
                      class="text-primary"
                    />
                    <span class="text-sm font-mono text-foreground">{{ zone.name }}</span>
                  </label>
                }
              </div>
            </div>

            <!-- Email field -->
            <div>
              <label class="text-xs font-medium text-foreground block mb-1.5">Contact email</label>
              <input
                type="email"
                [ngModel]="wiz.zoneRegEmail()"
                (ngModelChange)="wiz.zoneRegEmail.set($event)"
                placeholder="your@email.com"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p class="text-xs text-muted-foreground mt-1">Used by Let's Encrypt for certificate expiry notifications.</p>
            </div>

            <!-- Error -->
            @if (wiz.zoneRegError()) {
              <p class="text-xs text-destructive">{{ wiz.zoneRegError() }}</p>
            }
          }
        }
      </div>

    } @else {
      <div class="flex flex-col gap-3 flex-1 p-2">
        <!-- Domain — always editable -->
        <div>
          <label class="text-xs font-medium text-foreground block mb-1.5">Domain</label>
          <select
            [(ngModel)]="wiz.selectedZoneId"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select a domain…</option>
            @for (zone of wiz.dnsZonesService.zones(); track zone.id) {
              <option [value]="zone.id">{{ zone.zoneName }} ({{ zone.dnsProvider }})</option>
            }
          </select>
        </div>

        <!-- Email — read-only when existing, editable otherwise -->
        <div>
          <label class="text-xs font-medium text-foreground block mb-1.5">Contact email</label>
          @if (wiz.existingZone()) {
            <div class="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground flex items-center gap-2">
              <ng-icon name="lucideMail" class="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              {{ wiz.acmeEmail }}
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              Email cannot be changed after initial setup. To start fresh,
              <a routerLink="/infrastructure/domains" class="text-primary hover:underline">manage DNS zones</a>.
            </p>
          } @else {
            <input
              type="email"
              [(ngModel)]="wiz.acmeEmail"
              placeholder="your@email.com"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p class="text-xs text-muted-foreground mt-1">Used by Let's Encrypt for certificate expiry notifications.</p>
          }
        </div>

        <!-- Info: how to add a new domain -->
        <div class="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 space-y-1.5">
          <p class="text-xs font-medium text-amber-800 dark:text-amber-300">Don't see your domain?</p>
          @if (wiz.dnsZonesService.providers().length > 0) {
            <p class="text-xs text-amber-700 dark:text-amber-400">
              Your configured DNS
              {{ wiz.dnsZonesService.providers().length === 1 ? 'provider is' : 'providers are' }}
              <span class="font-semibold">{{ wiz.dnsZonesService.providers().join(', ') }}</span>.
              To add a domain, either:
            </p>
            <ul class="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 list-disc list-inside">
              <li>Purchase a domain directly on <span class="font-semibold">{{ wiz.dnsZonesService.providers()[0] }}</span> — it will appear here automatically.</li>
              <li>Transfer an existing domain to <span class="font-semibold">{{ wiz.dnsZonesService.providers()[0] }}</span> by updating its nameservers at your current registrar.</li>
            </ul>
          } @else {
            <p class="text-xs text-amber-700 dark:text-amber-400">
              No DNS provider is configured yet. Go to DNS zones to set one up first.
            </p>
          }
        </div>
      </div>
    }
  `,
})
export class DnsWizardZoneStepComponent {
  protected wiz = inject(DnsSetupWizardService);
}
