import { Component, inject } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideInfo } from '@ng-icons/lucide';
import { DnsSetupWizardService, CertMode } from './dns-setup-wizard.service';

@Component({
  selector: 'app-dns-wizard-mode-step',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideInfo })],
  template: `
    <h3 class="text-sm font-semibold text-foreground mb-1">How do you want to secure your apps?</h3>
    <p class="text-xs text-muted-foreground mb-4">
      Choose the method that best fits your setup. You can change it later from the cluster's DNS section.
    </p>

    <div class="flex flex-col gap-3 flex-1">
      <!-- Wildcard option -->
      <button type="button" (click)="wiz.certMode.set('wildcard')" [class]="modeCardClass('wildcard')">
        <div [class]="modeRadioClass('wildcard')">
          @if (wiz.certMode() === 'wildcard') {
            <div class="h-2 w-2 rounded-full bg-primary"></div>
          }
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <p class="text-sm font-medium text-foreground">One certificate for everything</p>
            <span class="text-xs text-primary font-normal">(Recommended)</span>
            <div class="relative ml-auto flex-shrink-0" (click)="$event.stopPropagation()">
              <button
                type="button"
                (click)="$event.stopPropagation(); toggleInfo('wildcard')"
                class="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <ng-icon name="lucideInfo" class="h-3.5 w-3.5" />
              </button>
              @if (activeInfo === 'wildcard') {
                <div class="absolute right-0 top-5 z-20 w-72 rounded-lg bg-popover border border-border shadow-lg px-3 py-2.5 text-xs text-muted-foreground" (click)="$event.stopPropagation()">
                  Uses DNS-01 challenge — the platform adds a TXT record to your domain via your DNS provider's API. Requires API support from your DNS provider (e.g. Hetzner DNS, Cloudflare).
                </div>
              }
            </div>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5">
            Covers all apps with a single wildcard cert (DNS-01). Faster to activate and easier to manage.
          </p>
        </div>
      </button>

      <!-- Per-domain option -->
      <button type="button" (click)="wiz.certMode.set('direct')" [class]="modeCardClass('direct')">
        <div [class]="modeRadioClass('direct')">
          @if (wiz.certMode() === 'direct') {
            <div class="h-2 w-2 rounded-full bg-primary"></div>
          }
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <p class="text-sm font-medium text-foreground">One certificate per app</p>
            <div class="relative ml-auto flex-shrink-0" (click)="$event.stopPropagation()">
              <button
                type="button"
                (click)="$event.stopPropagation(); toggleInfo('direct')"
                class="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <ng-icon name="lucideInfo" class="h-3.5 w-3.5" />
              </button>
              @if (activeInfo === 'direct') {
                <div class="absolute right-0 top-5 z-20 w-72 rounded-lg bg-popover border border-border shadow-lg px-3 py-2.5 text-xs text-muted-foreground" (click)="$event.stopPropagation()">
                  Uses HTTP-01 challenge — Let's Encrypt contacts each app directly over HTTP to verify domain ownership. No DNS provider API access required.
                </div>
              }
            </div>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5">
            Issues 3 individual certs via HTTP-01, one per app. No DNS provider API needed, but activation takes a bit longer.
          </p>
        </div>
      </button>
    </div>
  `,
})
export class DnsWizardModeStepComponent {
  protected wiz = inject(DnsSetupWizardService);
  protected activeInfo: string | null = null;

  protected toggleInfo(key: string): void {
    this.activeInfo = this.activeInfo === key ? null : key;
  }

  protected closeInfo(): void {
    this.activeInfo = null;
  }

  protected modeCardClass(mode: CertMode): string {
    const base = 'flex items-start gap-3 p-4 rounded-lg border-2 transition-all w-full';
    return this.wiz.certMode() === mode
      ? `${base} border-primary bg-primary/5`
      : `${base} border-border hover:border-muted-foreground`;
  }

  protected modeRadioClass(mode: CertMode): string {
    const base = 'mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center';
    return this.wiz.certMode() === mode
      ? `${base} border-primary`
      : `${base} border-muted-foreground`;
  }
}
