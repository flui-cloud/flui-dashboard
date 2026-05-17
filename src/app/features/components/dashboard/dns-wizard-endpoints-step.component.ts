import { Component, inject } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCheckCircle,
  lucideLoader,
  lucideAlertCircle,
  lucideRefreshCw,
  lucideFileText,
  lucideInfo,
} from '@ng-icons/lucide';
import { DnsSetupWizardService, AppEndpointStatus, AppEndpointPhase } from './dns-setup-wizard.service';

const PHASE_LABELS: Record<AppEndpointPhase, string> = {
  'idle':               '',
  'creating-endpoint':  'Creating endpoint…',
  'checking-dns':       'Checking DNS…',
  'reconciling':        'Configuring ingress…',
  'issuing-cert':       'Issuing staging certificate…',
  'upgrading-to-prod':  'Upgrading to production certificate…',
  'issuing-prod-cert':  'Issuing production certificate…',
  'syncing-auth':       'Syncing auth domain…',
  'rollout-auth':       'Restarting auth…',
  'syncing-api':        'Syncing API config…',
  'rollout-api':        'Restarting API…',
  'syncing-web':        'Syncing web config…',
  'rollout-web':        'Restarting dashboard…',
  'done':               '',
  'error':              '',
};

@Component({
  selector: 'app-dns-wizard-endpoints-step',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideCheckCircle, lucideLoader, lucideAlertCircle, lucideRefreshCw, lucideFileText, lucideInfo })],
  template: `
    <div class="flex items-start justify-between mb-1">
      <h3 class="text-sm font-semibold text-foreground">
        @if (wiz.endpointPhase() === 'done' && wiz.hasFailedEndpoint()) { Some steps failed }
        @else if (wiz.endpointPhase() === 'done') { Endpoints configured }
        @else { Configuring app endpoints… }
      </h3>
      @if (wiz.hasFailedEndpoint()) {
        <button
          type="button"
          (click)="retryEndpoints()"
          [disabled]="wiz.endpointPhase() === 'configuring' || wiz.endpointPhase() === 'polling'"
          title="Retry failed endpoints"
          class="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="wiz.endpointPhase() === 'configuring' || wiz.endpointPhase() === 'polling'" />
        </button>
      }
    </div>
    <p class="text-xs text-muted-foreground mb-4">
      @if (wiz.endpointPhase() === 'done' && wiz.hasFailedEndpoint()) {
        Check the details below and retry.
      } @else if (wiz.endpointPhase() === 'done') {
        All apps are reachable and certificates are active.
      } @else {
        Setting up DNS, certificates, and syncing app configurations.
      }
    </p>

    <div class="flex flex-col gap-0 rounded-lg border border-border overflow-hidden flex-1">
      @for (app of wiz.appEndpoints(); track app.key) {
        <div class="flex items-center gap-2 px-4 py-3 border-b border-border last:border-0">
          <!-- Status icon -->
          @if (app.status === 'done') {
            <ng-icon name="lucideCheckCircle" class="h-4 w-4 text-emerald-500 flex-shrink-0" />
          } @else if (app.status === 'running') {
            <ng-icon name="lucideLoader" class="h-4 w-4 text-primary animate-spin flex-shrink-0" />
          } @else if (app.status === 'error') {
            <ng-icon name="lucideAlertCircle" class="h-4 w-4 text-destructive flex-shrink-0" />
          } @else {
            <div class="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0"></div>
          }

          <!-- Label + current phase text -->
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-foreground">{{ app.label }}</p>
            <p class="text-xs font-mono text-muted-foreground truncate">{{ app.fqdn }}</p>
            @if (app.status === 'running' && phaseLabel(app)) {
              <p class="text-xs text-primary mt-0.5">
                {{ phaseLabel(app) }}
                @if (isRolloutPhase(app.phase) && app.rolloutProgress !== null) {
                  <span class="text-muted-foreground">({{ app.rolloutProgress }}%)</span>
                }
              </p>
            } @else if (app.status === 'error' && app.errorMessage) {
              <p class="text-xs text-destructive mt-0.5 truncate">{{ app.errorMessage }}</p>
            }
          </div>

          <!-- Cert status badge (when settled) -->
          @if ((app.status === 'done' || app.status === 'error') && app.certStatus) {
            <span
              [class]="certBadgeClass(app.certStatus)"
              class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
            >
              {{ certBadgeLabel(app.certStatus) }}
            </span>
          }

          <!-- Detail button -->
          @if (app.certMessage || (app.status === 'error' && app.errorMessage)) {
            <button
              type="button"
              (click)="$event.stopPropagation(); wiz.openAppError(app)"
              title="View details"
              class="p-1 rounded flex-shrink-0 transition-colors"
              [class]="app.status === 'error' ? 'text-destructive hover:text-destructive/80' : 'text-muted-foreground hover:text-foreground'"
            >
              <ng-icon name="lucideFileText" class="h-3.5 w-3.5" />
            </button>
          }
        </div>
      }
    </div>

    @if (wiz.endpointPhase() !== 'done') {
      <div class="mt-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 flex items-start gap-2">
        <ng-icon name="lucideInfo" class="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p class="text-xs text-blue-700 dark:text-blue-300">
          The first run can take a few minutes — DNS propagation and certificate issuance are slowest the first time. Subsequent runs are much faster.
        </p>
      </div>
    }

    @if (wiz.endpointError()) {
      <div class="mt-2 rounded-md bg-muted border border-border px-3 py-2">
        <p class="text-xs text-muted-foreground">{{ wiz.endpointError() }}</p>
      </div>
    }

    @if (wiz.endpointPhase() === 'done' && !wiz.hasFailedEndpoint()) {
      <div class="mt-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2 flex items-center gap-2">
        <ng-icon name="lucideCheckCircle" class="h-4 w-4 text-emerald-500 flex-shrink-0" />
        <p class="text-xs text-emerald-700 dark:text-emerald-300">All endpoints configured and certificates are valid.</p>
      </div>
    }
  `,
})
export class DnsWizardEndpointsStepComponent {
  protected wiz = inject(DnsSetupWizardService);

  protected phaseLabel(app: AppEndpointStatus): string {
    return PHASE_LABELS[app.phase] ?? '';
  }

  protected isRolloutPhase(phase: AppEndpointPhase): boolean {
    return phase === 'rollout-auth' || phase === 'rollout-api' || phase === 'rollout-web';
  }

  protected async retryEndpoints(): Promise<void> {
    this.wiz.endpointError.set(null);
    const clusterId = this.wiz.clusterDnsZoneService.assignment()?.clusterId;
    if (clusterId) {
      await this.wiz.runEndpointSetup(clusterId, true);
    }
  }

  protected certBadgeClass(status: AppEndpointStatus['certStatus']): string {
    switch (status) {
      case 'valid':   return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'issuing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pending': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'expired':
      case 'failed':  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:        return 'bg-muted text-muted-foreground';
    }
  }

  protected certBadgeLabel(status: AppEndpointStatus['certStatus']): string {
    switch (status) {
      case 'valid':   return 'Valid';
      case 'issuing': return 'Issuing…';
      case 'pending': return 'Pending';
      case 'expired': return 'Expired';
      case 'failed':  return 'Failed';
      default:        return status ?? '';
    }
  }
}
