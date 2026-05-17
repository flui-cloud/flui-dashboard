import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck, lucideExternalLink, lucideArrowRight } from '@ng-icons/lucide';
import { DnsSetupWizardService } from './dns-setup-wizard.service';

@Component({
  selector: 'app-dns-wizard-done-step',
  standalone: true,
  imports: [RouterLink, NgIconComponent],
  providers: [provideIcons({ lucideShieldCheck, lucideExternalLink, lucideArrowRight })],
  template: `
    <div class="flex-1 flex flex-col gap-4 py-2">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
          <ng-icon name="lucideShieldCheck" class="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <p class="text-sm font-semibold text-foreground">You're all set!</p>
          <p class="text-xs text-muted-foreground mt-0.5">All apps are live with active certificates.</p>
        </div>
      </div>

      <!-- App links -->
      <div class="flex flex-col gap-0 rounded-lg border border-border overflow-hidden">
        @for (app of wiz.appEndpoints(); track app.key) {
          <div class="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
            <ng-icon name="lucideShieldCheck" class="h-4 w-4 text-emerald-500 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-foreground">{{ app.label }}</p>
              <p class="text-xs text-muted-foreground font-mono truncate">https://{{ app.fqdn }}</p>
            </div>
            <a
              href="https://{{ app.fqdn }}"
              target="_blank"
              rel="noopener noreferrer"
              class="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
              title="Open {{ app.fqdn }}"
            >
              <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
            </a>
          </div>
        }
      </div>

      @if (wiz.requiresRelogin()) {
        <div class="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
          <p class="text-xs font-semibold text-amber-800 dark:text-amber-200">Session moved to new domain</p>
          <p class="text-xs text-amber-700 dark:text-amber-300 mt-1">
            The dashboard is now served from the custom domain. Continue there to log in.
          </p>
          @if (webUrl(); as url) {
            <button
              (click)="onRelogin()"
              class="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 transition-colors"
            >
              Continue on new domain
              <ng-icon name="lucideArrowRight" class="h-3.5 w-3.5" />
            </button>
            <p class="text-xs text-amber-700/80 dark:text-amber-300/80 mt-2 font-mono truncate">{{ url }}</p>
          }
        </div>
      } @else {
        <div class="rounded-md bg-muted/60 px-4 py-2.5">
          <p class="text-xs text-muted-foreground">
            Monitor and configure advanced options in the
            <a
              [routerLink]="['/cluster', clusterId(), 'dns']"
              class="text-primary hover:underline"
            >cluster DNS section</a>.
          </p>
        </div>
      }
    </div>
  `,
})
export class DnsWizardDoneStepComponent {
  protected wiz = inject(DnsSetupWizardService);
  readonly clusterId = input.required<string>();

  protected webUrl(): string | null {
    const fqdn = this.wiz.appEndpoints().find(a => a.key === 'flui-web')?.fqdn;
    return fqdn ? `https://${fqdn}` : null;
  }

  onRelogin(): void {
    const url = this.webUrl();
    if (url) {
      globalThis.window.location.href = url;
    }
  }
}
