import { Component, inject } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideFileText, lucideRefreshCw } from '@ng-icons/lucide';
import {
  DnsSetupWizardService,
  AppEndpointStatus,
  AppEndpointPhase,
} from './dns-setup-wizard.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

const PHASE_LABELS: Record<AppEndpointPhase, string> = {
  idle: '',
  'creating-endpoint': 'Creating endpoint…',
  'checking-dns': 'Checking DNS…',
  reconciling: 'Configuring ingress…',
  'issuing-cert': 'Issuing staging certificate…',
  'upgrading-to-prod': 'Upgrading to production certificate…',
  'issuing-prod-cert': 'Issuing production certificate…',
  'syncing-auth': 'Syncing auth domain…',
  'rollout-auth': 'Restarting auth…',
  'syncing-api': 'Syncing API config…',
  'rollout-api': 'Restarting API…',
  'syncing-web': 'Syncing web config…',
  'rollout-web': 'Restarting dashboard…',
  done: '',
  error: '',
};

const STATUS_TONES: Record<AppEndpointStatus['status'], StatusTone> = {
  pending: 'neutral',
  running: 'progress',
  done: 'success',
  error: 'error',
};

@Component({
  selector: 'app-dns-wizard-endpoints-step',
  imports: [FlAlert, FlCopyId, FlTable, FlButton, FlIcon, FlStatus],
  providers: [provideIcons({ lucideFileText, lucideRefreshCw })],
  host: { class: 'fl-stack' },
  template: `
    <div class="flex flex-wrap items-center justify-between gap-2">
      @if (wiz.endpointPhase() === 'done' && wiz.hasFailedEndpoint()) {
        <fl-status tone="error" label="Some steps failed. Check the details and retry." />
      } @else if (wiz.endpointPhase() === 'done') {
        <fl-status tone="success" label="All apps are reachable and certificates are active" />
      } @else {
        <fl-status tone="progress" label="Setting up DNS, certificates and app configuration…" />
      }
      @if (wiz.hasFailedEndpoint()) {
        <button flButton size="sm" type="button" (click)="retryEndpoints()" [disabled]="running()">
          <fl-icon name="lucideRefreshCw" />
          Retry failed
        </button>
      }
    </div>

    <div class="fl-table-wrap">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">App</th>
            <th scope="col">Address</th>
            <th scope="col">Progress</th>
            <th scope="col">Certificate</th>
            <th scope="col" class="is-fit"><span class="fl-sr">Details</span></th>
          </tr>
        </thead>
        <tbody>
          @for (app of wiz.appEndpoints(); track app.key) {
            <tr>
              <td>{{ app.label }}</td>
              <td>
                @if (app.fqdn) {
                  <fl-copy-id [value]="app.fqdn" label="address" />
                } @else {
                  <span class="text-fl-ink-muted">—</span>
                }
              </td>
              <td class="whitespace-normal">
                <fl-status [tone]="statusTone(app)" [label]="progressLabel(app)" />
                @if (app.status === 'error' && app.errorMessage) {
                  <span class="block truncate text-fl-caption text-fl-ink-muted">{{
                    app.errorMessage
                  }}</span>
                }
              </td>
              <td>
                @if ((app.status === 'done' || app.status === 'error') && app.certStatus) {
                  <fl-status
                    [tone]="certTone(app.certStatus)"
                    [label]="certLabel(app.certStatus)"
                  />
                } @else {
                  <span class="text-fl-ink-muted">—</span>
                }
              </td>
              <td class="is-fit">
                @if (app.certMessage || (app.status === 'error' && app.errorMessage)) {
                  <button
                    flButton="ghost"
                    size="sm"
                    [iconOnly]="true"
                    type="button"
                    aria-label="View details"
                    title="View details"
                    (click)="$event.stopPropagation(); wiz.openAppError(app)"
                  >
                    <fl-icon name="lucideFileText" />
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (wiz.endpointPhase() !== 'done') {
      <fl-alert tone="info" title="The first run takes a few minutes">
        DNS propagation and certificate issuance are slowest the first time. Later runs are much
        faster.
      </fl-alert>
    }

    @if (wiz.endpointError()) {
      <fl-alert tone="warning" title="Endpoint setup reported a problem">
        {{ wiz.endpointError() }}
      </fl-alert>
    }
  `,
})
export class DnsWizardEndpointsStepComponent {
  protected wiz = inject(DnsSetupWizardService);

  protected running(): boolean {
    const phase = this.wiz.endpointPhase();
    return phase === 'configuring' || phase === 'polling';
  }

  protected statusTone(app: AppEndpointStatus): StatusTone {
    return STATUS_TONES[app.status] ?? 'neutral';
  }

  protected progressLabel(app: AppEndpointStatus): string {
    if (app.status === 'done') return 'Done';
    if (app.status === 'error') return 'Failed';
    if (app.status === 'pending') return 'Waiting';
    const label = this.phaseLabel(app) || 'Working…';
    if (this.isRolloutPhase(app.phase) && app.rolloutProgress !== null) {
      return `${label} (${app.rolloutProgress}%)`;
    }
    return label;
  }

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

  protected certTone(status: AppEndpointStatus['certStatus']): StatusTone {
    switch (status) {
      case 'valid':
        return 'success';
      case 'issuing':
        return 'progress';
      case 'pending':
        return 'warning';
      case 'expired':
      case 'failed':
        return 'error';
      default:
        return 'neutral';
    }
  }

  protected certLabel(status: AppEndpointStatus['certStatus']): string {
    switch (status) {
      case 'valid':
        return 'Valid';
      case 'issuing':
        return 'Issuing…';
      case 'pending':
        return 'Pending';
      case 'expired':
        return 'Expired';
      case 'failed':
        return 'Failed';
      default:
        return status ?? '';
    }
  }
}
