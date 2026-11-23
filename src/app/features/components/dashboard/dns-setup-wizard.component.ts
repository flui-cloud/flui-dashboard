import { Component, inject, output, OnInit, signal, computed } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideX } from '@ng-icons/lucide';
import { DashboardDnsService } from '../../service/dashboard-dns.service';
import { DnsSetupWizardService, WizardStep as DnsStep } from './dns-setup-wizard.service';
import { DnsWizardModeStepComponent } from './dns-wizard-mode-step.component';
import { DnsWizardZoneStepComponent } from './dns-wizard-zone-step.component';
import { DnsWizardNamesStepComponent } from './dns-wizard-names-step.component';
import { DnsWizardIssuerStepComponent } from './dns-wizard-issuer-step.component';
import { DnsWizardEndpointsStepComponent } from './dns-wizard-endpoints-step.component';
import { DnsWizardEndpointsConfigStepComponent } from './dns-wizard-endpoints-config-step.component';
import { DnsWizardDoneStepComponent } from './dns-wizard-done-step.component';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlWizardSteps, WizardStep } from '../../../ui/patterns/wizard-steps';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { FlDialogFocus } from '../../../ui/overlays/dialog-focus';

const STEP_NAMES: Record<DnsStep, string> = {
  mode: 'Certificate method',
  zone: 'Domain',
  names: 'Addresses',
  issuer: 'Certificate issuer',
  'endpoints-config': 'App addresses',
  endpoints: 'Publish',
  done: 'Done',
};

@Component({
  selector: 'app-dns-setup-wizard',
  imports: [
    FlDialogFocus,
    FlPanel,
    FlTable,
    FlCopyId,
    FlWizardSteps,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
    DnsWizardModeStepComponent,
    DnsWizardZoneStepComponent,
    DnsWizardNamesStepComponent,
    DnsWizardIssuerStepComponent,
    DnsWizardEndpointsStepComponent,
    DnsWizardEndpointsConfigStepComponent,
    DnsWizardDoneStepComponent,
  ],
  providers: [DnsSetupWizardService, provideIcons({ lucideX, lucideExternalLink })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="onBackdropClick($event)"
    >
      <div
        class="fl-dialog fl-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dns-wizard-title"
        flDialogFocus
        (dismissed)="close()"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="dns-wizard-title">
            {{ showingRecap() ? 'DNS and certificates' : 'Set up public access' }}
          </h2>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="close()">
            <fl-icon name="lucideX" />
          </button>
        </header>

        @if (showingRecap()) {
          <div class="fl-dialog__body">
            <fl-status tone="success" label="Everything is live" />
            <p class="m-0 text-fl-body-sm text-fl-ink-muted">
              All apps are publicly reachable with active TLS certificates. Use Reconfigure to
              change domains, certificate providers or endpoints.
            </p>
            <div class="fl-table-wrap">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">App</th>
                    <th scope="col">Address</th>
                    <th scope="col" class="is-fit"><span class="fl-sr">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (app of recapApps(); track app.label) {
                    <tr>
                      <td>{{ app.label }}</td>
                      <td>
                        <fl-copy-id
                          [value]="'https://' + app.domain"
                          label="address"
                          [display]="app.domain"
                        />
                      </td>
                      <td class="is-fit">
                        <a
                          flButton="ghost"
                          size="sm"
                          [iconOnly]="true"
                          href="https://{{ app.domain }}"
                          target="_blank"
                          rel="noopener noreferrer"
                          [attr.aria-label]="'Open ' + app.domain"
                          (click)="$event.stopPropagation()"
                        >
                          <fl-icon name="lucideExternalLink" />
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          <footer class="fl-dialog__footer">
            <button flButton type="button" (click)="startReconfigure()">Reconfigure</button>
            <button flButton="primary" type="button" (click)="close()">Close</button>
          </footer>
        } @else {
          <div class="fl-dialog__body">
            <div class="fl-wizard">
              <nav aria-label="Steps">
                <fl-wizard-steps [steps]="wizardSteps()" [current]="wiz.stepIndex()" />
              </nav>

              <fl-panel [title]="stepName()">
                @switch (wiz.currentStep()) {
                  @case ('mode') {
                    <app-dns-wizard-mode-step />
                  }
                  @case ('zone') {
                    <app-dns-wizard-zone-step />
                  }
                  @case ('names') {
                    <app-dns-wizard-names-step />
                  }
                  @case ('issuer') {
                    <app-dns-wizard-issuer-step />
                  }
                  @case ('endpoints-config') {
                    <app-dns-wizard-endpoints-config-step />
                  }
                  @case ('endpoints') {
                    <app-dns-wizard-endpoints-step />
                  }
                  @case ('done') {
                    <app-dns-wizard-done-step [clusterId]="clusterId() ?? ''" />
                  }
                }
              </fl-panel>
            </div>
          </div>

          <footer class="fl-dialog__footer">
            @if (wiz.currentStep() !== 'done') {
              <button flButton="ghost" type="button" (click)="close()">Cancel</button>
            }
            <button
              flButton
              type="button"
              (click)="back()"
              [disabled]="wiz.stepIndex() === 0 || wiz.saving() || wiz.isAutoRunning()"
            >
              Previous
            </button>
            @if (wiz.currentStep() !== 'done') {
              <button
                flButton="primary"
                type="button"
                (click)="next()"
                [disabled]="!wiz.canProceed() || wiz.saving() || wiz.isAutoRunning()"
              >
                @if (wiz.saving()) {
                  <fl-spinner label="Configuring" />
                  Configuring…
                } @else if (wiz.registeringZone()) {
                  <fl-spinner label="Adding domain" />
                  Adding domain…
                } @else if (wiz.checkingNames() || wiz.checkingDirect()) {
                  <fl-spinner label="Checking" />
                  Checking…
                } @else {
                  Next
                }
              </button>
            } @else {
              <button flButton="primary" type="button" (click)="close()">Close</button>
            }
          </footer>
        }
      </div>
    </div>

    @if (wiz.activeAppError(); as appError) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="wiz.closeAppError()"
      >
        <div
          class="fl-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dns-wizard-error-title"
          flDialogFocus
          (dismissed)="wiz.closeAppError()"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="dns-wizard-error-title">
              {{ appError.label }} details
            </h2>
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              (click)="wiz.closeAppError()"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>
          <div class="fl-dialog__body">
            @let msg = appError.certMessage || appError.errorMessage;
            @if (msg) {
              <pre
                class="fl-mono m-0 whitespace-pre-wrap break-all rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3"
                >{{ msg }}</pre>
            } @else {
              <p class="m-0 text-fl-ink-muted">No details reported.</p>
            }
          </div>
          <footer class="fl-dialog__footer">
            @if (appError.certMessage || appError.errorMessage) {
              <button flButton type="button" (click)="wiz.copyAppErrorMessage()">
                {{ wiz.appErrorCopied() ? 'Copied' : 'Copy message' }}
              </button>
            }
            <button flButton="primary" type="button" (click)="wiz.closeAppError()">Close</button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class DnsSetupWizardComponent implements OnInit {
  readonly closed = output<void>();

  protected wiz = inject(DnsSetupWizardService);
  private readonly dashboardDnsService = inject(DashboardDnsService);

  protected clusterId = this.dashboardDnsService.targetClusterId;
  protected showingRecap = signal(false);

  protected readonly wizardSteps = computed<WizardStep[]>(() =>
    this.wiz.steps().map((step) => ({ name: STEP_NAMES[step] })),
  );

  protected readonly stepName = computed(() => STEP_NAMES[this.wiz.currentStep()] ?? '');

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
    const step = this.wiz.currentStep();
    if (step === 'mode') return this.nextFromMode();
    if (step === 'zone') return this.nextFromZone();
    if (step === 'names') return this.nextFromNames();
    if (step === 'issuer') return this.nextFromIssuer();
    if (step === 'endpoints-config') return this.nextFromEndpointsConfig();
    this.wiz.advance();
  }

  private nextFromMode(): void {
    this.wiz.advance();
    if (this.wiz.currentStep() === 'issuer' && this.wiz.certMode() === 'direct') {
      const clusterId = this.clusterId();
      if (clusterId) this.wiz.loadHttpIssuer(clusterId);
    }
  }

  private async nextFromZone(): Promise<void> {
    if (!(await this.wiz.ensureSelectedZoneRegistered())) return;
    this.wiz.advance();
    const clusterId = this.clusterId();
    if (clusterId) await this.wiz.loadSystemNames(clusterId);
  }

  private async nextFromNames(): Promise<void> {
    const clusterId = this.clusterId();
    if (!clusterId || !(await this.wiz.checkSystemNames(clusterId))) return;
    this.wiz.advance();
    this.wiz.runSetup(clusterId);
  }

  private async nextFromIssuer(): Promise<void> {
    const clusterId = this.clusterId();
    if (this.wiz.certMode() === 'direct') {
      const phase = this.wiz.issuerPhase();
      if (phase === 'idle' || phase === 'error') {
        if (clusterId) await this.wiz.runSetup(clusterId);
        if (this.wiz.issuerPhase() !== 'done') return;
      }
      this.wiz.advance();
      if (clusterId) this.wiz.loadDirectConfig(clusterId);
    } else {
      this.wiz.advance();
      if (clusterId) this.wiz.runEndpointSetup(clusterId);
    }
  }

  private async nextFromEndpointsConfig(): Promise<void> {
    const clusterId = this.clusterId();
    if (clusterId && !(await this.wiz.checkDirectEndpoints(clusterId))) return;
    this.wiz.advance();
    if (clusterId) this.wiz.runEndpointSetup(clusterId);
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
