import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideCheckCircle, lucideLoader, lucideAlertCircle, lucideInfo, lucideExternalLink } from '@ng-icons/lucide';
import { DnsSetupWizardService } from './dns-setup-wizard.service';
import { DashboardDnsService } from '../../service/dashboard-dns.service';

@Component({
  selector: 'app-dns-wizard-issuer-step',
  standalone: true,
  imports: [NgIconComponent, FormsModule],
  providers: [provideIcons({ lucideCheckCircle, lucideLoader, lucideAlertCircle, lucideInfo, lucideExternalLink })],
  template: `
    @if (wiz.certMode() === 'direct') {
      <!-- Direct / HTTP-01 mode -->
      <h3 class="text-sm font-semibold text-foreground mb-1">Configure certificate issuer</h3>
      <p class="text-xs text-muted-foreground mb-4">
        Certificates will be issued via <strong>Let's Encrypt HTTP-01</strong>.
      </p>

      @if (wiz.loadingHttpIssuer()) {
        <!-- Skeleton loader -->
        <div class="rounded-lg border border-border px-4 py-3 space-y-2 animate-pulse">
          <div class="h-3 w-40 rounded bg-muted"></div>
          <div class="h-3 w-56 rounded bg-muted"></div>
        </div>
      } @else if (wiz.existingHttpIssuerEmail()) {
        <!-- Already configured -->
        <div class="rounded-lg border border-border px-4 py-3 space-y-1">
          <p class="text-xs font-medium text-foreground">HTTP-01 issuer already configured</p>
          <p class="text-xs text-muted-foreground">ACME email: <span class="font-mono text-foreground">{{ wiz.existingHttpIssuerEmail() }}</span></p>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          To change the email go to
          <a [href]="issuerSettingsUrl()" target="_blank" rel="noopener" class="inline-flex items-center gap-0.5 text-primary hover:underline">
            Cluster certificates <ng-icon name="lucideExternalLink" class="h-3 w-3" />
          </a>.
        </p>
      } @else if (wiz.issuerPhase() === 'idle' || wiz.issuerPhase() === 'error') {
        <!-- Email input form -->
        <div class="space-y-3 p-2">
          <div>
            <label class="block text-xs font-medium text-foreground mb-1">ACME email</label>
            <input
              type="email"
              [(ngModel)]="acmeEmailInput"
              (ngModelChange)="wiz.directAcmeEmail.set($event)"
              placeholder="you@example.com"
              class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              [class.border-destructive]="wiz.setupError()"
            />
            <p class="mt-1 text-xs text-muted-foreground">Used by Let's Encrypt for expiry notifications.</p>
          </div>

          @if (wiz.setupError()) {
            <div class="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p class="text-xs text-destructive">{{ wiz.setupError() }}</p>
            </div>
          }

          <div class="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 flex items-start gap-2">
            <ng-icon name="lucideInfo" class="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p class="text-xs text-blue-700 dark:text-blue-300">
              Click Next to save the issuer configuration. You will then set up the app endpoints.
            </p>
          </div>
        </div>
      } @else {
        <!-- Configuring in progress -->
        <div class="flex items-center gap-3 px-4 py-3 rounded-lg border border-border">
          @if (wiz.issuerPhase() === 'done') {
            <ng-icon name="lucideCheckCircle" class="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p class="text-xs font-medium text-foreground">HTTP-01 issuer configured</p>
              <p class="text-xs text-muted-foreground">ACME email: <span class="font-mono">{{ wiz.directAcmeEmail() }}</span></p>
            </div>
          } @else {
            <ng-icon name="lucideLoader" class="h-5 w-5 text-primary animate-spin flex-shrink-0" />
            <p class="text-xs text-foreground">Configuring issuer…</p>
          }
        </div>

        @if (wiz.setupError()) {
          <div class="mt-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p class="text-xs text-destructive">{{ wiz.setupError() }}</p>
          </div>
        }
      }

    } @else {
      <!-- Wildcard / DNS-01 mode — automatic, no input needed -->
      <h3 class="text-sm font-semibold text-foreground mb-1">
        @if (wiz.issuerPhase() === 'done') { Configuration complete } @else { Applying configuration… }
      </h3>
      <p class="text-xs text-muted-foreground mb-4">
        @if (wiz.issuerPhase() === 'done') {
          Issuers are active. You can now proceed.
        } @else {
          Sit back — we're setting everything up automatically. This takes a few seconds.
        }
      </p>

      <div class="flex flex-col gap-2 flex-1">
        <div class="flex flex-col gap-0 rounded-lg border border-border overflow-hidden">
          @for (phase of wiz.setupPhases(); track phase.key) {
            <div class="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0" [class.bg-muted]="phase.active">
              @if (phase.status === 'done') {
                <ng-icon name="lucideCheckCircle" class="h-4 w-4 text-emerald-500 flex-shrink-0" />
              } @else if (phase.status === 'running') {
                <ng-icon name="lucideLoader" class="h-4 w-4 text-primary animate-spin flex-shrink-0" />
              } @else if (phase.status === 'skipped') {
                <ng-icon name="lucideCheckCircle" class="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
              } @else if (phase.status === 'error') {
                <ng-icon name="lucideAlertCircle" class="h-4 w-4 text-destructive flex-shrink-0" />
              } @else {
                <div class="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0"></div>
              }
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium" [class.text-foreground]="phase.status !== 'pending'" [class.text-muted-foreground]="phase.status === 'pending'">{{ phase.label }}</p>
                @if (phase.issuerMessage) {
                  <p class="text-xs text-muted-foreground mt-0.5 truncate">{{ phase.issuerMessage }}</p>
                }
              </div>
            </div>
          }
        </div>

        @if (wiz.setupError()) {
          <div class="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p class="text-xs text-destructive">{{ wiz.setupError() }}</p>
          </div>
        }

        @if (wiz.issuerPhase() === 'done') {
          <div class="rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2 flex items-center gap-2">
            <ng-icon name="lucideCheckCircle" class="h-4 w-4 text-emerald-500 flex-shrink-0" />
            <p class="text-xs text-emerald-700 dark:text-emerald-300">Both issuers are ready. Certificates will be issued automatically.</p>
          </div>
        }
      </div>
    }
  `,
})
export class DnsWizardIssuerStepComponent {
  protected wiz = inject(DnsSetupWizardService);
  protected dashboardDns = inject(DashboardDnsService);
  protected acmeEmailInput = '';

  protected issuerSettingsUrl(): string {
    const id = this.dashboardDns.targetClusterId();
    return `/cluster/${id}/dns#standard-certificate-issuers`;
  }
}
