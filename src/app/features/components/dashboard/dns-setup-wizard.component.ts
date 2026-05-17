import { Component, inject, output, OnInit, signal, computed } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideX,
  lucideArrowRight,
  lucideArrowLeft,
  lucideShieldCheck,
  lucideLoader,
  lucideFileText,
  lucideCopy,
  lucideCheck,
  lucideExternalLink,
  lucideSettings,
} from '@ng-icons/lucide';
import { DashboardDnsService } from '../../service/dashboard-dns.service';
import { DnsSetupWizardService } from './dns-setup-wizard.service';
import { DnsWizardModeStepComponent } from './dns-wizard-mode-step.component';
import { DnsWizardZoneStepComponent } from './dns-wizard-zone-step.component';
import { DnsWizardIssuerStepComponent } from './dns-wizard-issuer-step.component';
import { DnsWizardEndpointsStepComponent } from './dns-wizard-endpoints-step.component';
import { DnsWizardEndpointsConfigStepComponent } from './dns-wizard-endpoints-config-step.component';
import { DnsWizardDoneStepComponent } from './dns-wizard-done-step.component';

@Component({
  selector: 'app-dns-setup-wizard',
  standalone: true,
  imports: [
    NgIconComponent,
    DnsWizardModeStepComponent,
    DnsWizardZoneStepComponent,
    DnsWizardIssuerStepComponent,
    DnsWizardEndpointsStepComponent,
    DnsWizardEndpointsConfigStepComponent,
    DnsWizardDoneStepComponent,
  ],
  providers: [
    DnsSetupWizardService,
    provideIcons({
      lucideX, lucideArrowRight, lucideArrowLeft,
      lucideShieldCheck, lucideLoader, lucideFileText,
      lucideCopy, lucideCheck, lucideExternalLink, lucideSettings,
    }),
  ],
  template: `
    <!-- Modal backdrop -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="onBackdropClick($event)"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

      <!-- Dialog -->
      <div
        class="relative z-10 bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl"
        (click)="$event.stopPropagation()"
      >
        @if (showingRecap()) {
          <!-- ── RECAP MODE ── -->
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-border">
            <div class="flex items-center gap-2.5">
              <div class="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <ng-icon name="lucideShieldCheck" class="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <h2 class="font-semibold text-foreground text-sm">DNS & Certificates</h2>
                <p class="text-xs text-muted-foreground">All services configured</p>
              </div>
            </div>
            <button
              type="button"
              (click)="close()"
              class="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ng-icon name="lucideX" class="h-4 w-4" />
            </button>
          </div>

          <!-- Full green progress bar -->
          <div class="h-1 bg-emerald-500"></div>

          <!-- Recap content -->
          <div class="px-6 py-5 min-h-[180px] max-h-[420px] flex flex-col overflow-y-auto gap-4">
            <!-- Success header -->
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <ng-icon name="lucideShieldCheck" class="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p class="text-sm font-semibold text-foreground">Everything is live</p>
                <p class="text-xs text-muted-foreground mt-0.5">All apps are publicly accessible with active TLS certificates.</p>
              </div>
            </div>

            <!-- App list -->
            <div class="flex flex-col gap-0 rounded-lg border border-border overflow-hidden">
              @for (app of recapApps(); track app.label) {
                <div class="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                  <ng-icon name="lucideShieldCheck" class="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-foreground">{{ app.label }}</p>
                    <p class="text-xs text-muted-foreground font-mono truncate">https://{{ app.domain }}</p>
                  </div>
                  <a
                    href="https://{{ app.domain }}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    title="Open {{ app.domain }}"
                    (click)="$event.stopPropagation()"
                  >
                    <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
                  </a>
                </div>
              }
            </div>

            <div class="rounded-md bg-muted/60 px-4 py-2.5">
              <p class="text-xs text-muted-foreground">
                Use <span class="font-medium text-foreground">Reconfigure</span> to change domains, certificate providers, or add new endpoints.
              </p>
            </div>
          </div>

          <!-- Recap footer -->
          <div class="flex items-center justify-between px-6 py-4 border-t border-border">
            <button
              type="button"
              (click)="startReconfigure()"
              class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ng-icon name="lucideSettings" class="h-3.5 w-3.5" />
              Reconfigure
            </button>
            <button
              type="button"
              (click)="close()"
              class="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>

        } @else {
          <!-- ── WIZARD MODE ── -->
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-border">
            <div class="flex items-center gap-2.5">
              <div class="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <ng-icon name="lucideShieldCheck" class="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 class="font-semibold text-foreground text-sm">Set up public access</h2>
                <p class="text-xs text-muted-foreground">Step {{ wiz.stepIndex() + 1 }} of {{ wiz.totalSteps() }}</p>
              </div>
            </div>
            <button
              type="button"
              (click)="close()"
              class="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ng-icon name="lucideX" class="h-4 w-4" />
            </button>
          </div>

          <!-- Progress bar -->
          <div class="h-1 bg-muted">
            <div
              class="h-full bg-primary transition-all duration-300"
              [style.width.%]="((wiz.stepIndex() + 1) / wiz.totalSteps()) * 100"
            ></div>
          </div>

          <!-- Content area -->
          <div class="px-6 py-5 min-h-[180px] max-h-[420px] flex flex-col">
            <div class="flex flex-col flex-1 overflow-y-auto">
              @switch (wiz.currentStep()) {
                @case ('mode')      { <app-dns-wizard-mode-step /> }
                @case ('zone')      { <app-dns-wizard-zone-step /> }
                @case ('issuer')    { <app-dns-wizard-issuer-step /> }
                @case ('endpoints-config') { <app-dns-wizard-endpoints-config-step /> }
                @case ('endpoints') { <app-dns-wizard-endpoints-step /> }
                @case ('done')      { <app-dns-wizard-done-step [clusterId]="clusterId() ?? ''" /> }
              }
            </div>
          </div>

          <!-- Error detail popup (Step 4) -->
          @if (wiz.activeAppError()) {
            <div
              class="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 rounded-xl"
              (click)="wiz.closeAppError()"
            >
              <div
                class="bg-card border border-border rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-80"
                (click)="$event.stopPropagation()"
              >
                <!-- Popup header -->
                <div class="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                  <div class="flex items-center gap-2">
                    <ng-icon name="lucideFileText" class="h-4 w-4 text-destructive" />
                    <span class="text-sm font-semibold text-foreground">{{ wiz.activeAppError()!.label }} — Details</span>
                  </div>
                  <div class="flex items-center gap-1">
                    @if (wiz.activeAppError()!.certMessage || wiz.activeAppError()!.errorMessage) {
                      <button
                        type="button"
                        (click)="wiz.copyAppErrorMessage()"
                        title="Copy message"
                        class="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ng-icon [name]="wiz.appErrorCopied() ? 'lucideCheck' : 'lucideCopy'" class="h-3.5 w-3.5" />
                      </button>
                    }
                    <button
                      type="button"
                      (click)="wiz.closeAppError()"
                      class="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ng-icon name="lucideX" class="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <!-- Popup body -->
                <div class="overflow-y-auto p-4 flex-1">
                  @let msg = wiz.activeAppError()!.certMessage || wiz.activeAppError()!.errorMessage;
                  @if (msg) {
                    <div class="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/15 px-3 py-2">
                      <p class="text-xs text-red-700 dark:text-red-300 font-mono leading-relaxed break-all">{{ msg }}</p>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Footer -->
          <div class="flex items-center justify-between px-6 py-4 border-t border-border">
            <button
              type="button"
              (click)="back()"
              [disabled]="wiz.stepIndex() === 0 || wiz.saving() || wiz.isAutoRunning()"
              class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ng-icon name="lucideArrowLeft" class="h-3.5 w-3.5" />
              Back
            </button>

            <div class="flex items-center gap-2">
              @if (wiz.currentStep() !== 'done') {
                <button
                  type="button"
                  (click)="next()"
                  [disabled]="!wiz.canProceed() || wiz.saving() || wiz.isAutoRunning()"
                  class="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  @if (wiz.saving()) {
                    <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                    Configuring…
                  } @else if (wiz.zoneRegPhase() === 'registering') {
                    <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                    Registering…
                  } @else {
                    Next
                    <ng-icon name="lucideArrowRight" class="h-3.5 w-3.5" />
                  }
                </button>
              } @else {
                <button
                  type="button"
                  (click)="close()"
                  class="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Close
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class DnsSetupWizardComponent implements OnInit {
  readonly closed = output<void>();

  protected wiz = inject(DnsSetupWizardService);
  private readonly dashboardDnsService = inject(DashboardDnsService);

  protected clusterId = this.dashboardDnsService.targetClusterId;
  protected showingRecap = signal(false);

  protected recapApps = computed(() => {
    const status = this.dashboardDnsService.status();
    if (!status) return [];
    const rows: { label: string; domain: string }[] = [];
    if (status.fluiApi.domain) rows.push({ label: 'Flui API', domain: status.fluiApi.domain });
    if (status.fluiWeb.domain) rows.push({ label: 'Flui Web', domain: status.fluiWeb.domain });
    if (status.zitadel?.domain) rows.push({ label: 'Zitadel', domain: status.zitadel.domain });
    return rows;
  });

  ngOnInit(): void {
    void (async () => {
      if (this.dashboardDnsService.isFullyConfigured()) {
        this.showingRecap.set(true);
        return;
      }
      await this.wiz.init(this.clusterId());
    })();
  }

  protected async startReconfigure(): Promise<void> {
    this.showingRecap.set(false);
    await this.wiz.init(this.clusterId());
  }

  protected async next(): Promise<void> {
    if (this.wiz.currentStep() === 'mode') {
      this.wiz.advance();
      // In direct mode: entering issuer step — load existing HTTP-01 issuer if any
      if (this.wiz.currentStep() === 'issuer' && this.wiz.certMode() === 'direct') {
        const clusterId = this.clusterId();
        if (clusterId) this.wiz.loadHttpIssuer(clusterId);
      }
      return;
    }
    if (this.wiz.currentStep() === 'zone') {
      if (this.wiz.dnsZonesService.zones().length === 0 && this.wiz.zoneRegPhase() !== 'done') {
        await this.wiz.registerZoneInline();
        if (this.wiz.zoneRegPhase() !== 'done') return;
      }
      this.wiz.advance();
      const clusterId = this.clusterId();
      if (clusterId) this.wiz.runSetup(clusterId);
      return;
    }
    if (this.wiz.currentStep() === 'issuer') {
      const clusterId = this.clusterId();
      if (this.wiz.certMode() === 'direct') {
        const phase = this.wiz.issuerPhase();
        if (phase === 'idle' || phase === 'error') {
          // Run HTTP-01 issuer setup first, then advance when done
          if (clusterId) await this.wiz.runSetup(clusterId);
          if (this.wiz.issuerPhase() !== 'done') return; // error — stay on step
        }
        this.wiz.advance(); // → endpoints-config
        if (clusterId) this.wiz.loadDirectConfig(clusterId);
      } else {
        this.wiz.advance(); // → endpoints (wildcard)
        if (clusterId) this.wiz.runEndpointSetup(clusterId);
      }
      return;
    }
    if (this.wiz.currentStep() === 'endpoints-config') {
      this.wiz.advance();
      const clusterId = this.clusterId();
      if (clusterId) this.wiz.runEndpointSetup(clusterId);
      return;
    }
    this.wiz.advance();
  }

  protected back(): void {
    this.wiz.back();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) {
      this.close();
    }
  }

  protected close(): void {
    this.dashboardDnsService.refresh();
    this.closed.emit();
  }
}
