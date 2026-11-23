import { Component, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideFileText, lucideGlobe } from '@ng-icons/lucide';
import { AppEndpointResponseDto } from '../../../core/api/model/appEndpointResponseDto';
import { CanDirective } from '../../../core/directives/can.directive';
import { buildEndpointUrl, isEndpointManaged } from '../../model/dns.models';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { EndpointErrorDialog } from './endpoint-error-dialog';
import {
  CertificatePhase,
  ParsedError,
  StateView,
  buildEndpointError,
  certificateLabel,
  dnsState,
  hasDetails,
  modeLabel,
  modeTitle,
  phaseOf,
  technicalOf,
  tlsState,
} from './endpoint-format';

const ENDPOINT_ACTIONS: MenuAction[] = [{ id: 'delete', label: 'Delete endpoint', danger: true }];

@Component({
  selector: 'app-dns-endpoints-list',
  imports: [
    CanDirective,
    FlActionsMenu,
    FlCopyId,
    FlEmptyState,
    FlTable,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
    FlTag,
    EndpointErrorDialog,
  ],
  providers: [provideIcons({ lucideFileText, lucideGlobe })],
  host: { class: 'block' },
  template: `
    @if (endpoints().length > 0) {
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Hostname</th>
              <th scope="col">Target</th>
              <th scope="col">Record</th>
              <th scope="col">DNS</th>
              <th scope="col">TLS</th>
              <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (ep of endpoints(); track ep.id) {
              @let phase = phaseOf(ep);
              @let dns = dnsOf(ep);
              @let tls = tlsOf(ep);
              <tr>
                <td class="whitespace-normal">
                  <div class="flex min-w-0 flex-col gap-1">
                    <a
                      class="fl-link fl-mono break-all"
                      [href]="getUrl(ep.fqdn, ep.tlsEnabled)"
                      target="_blank"
                      rel="noopener noreferrer"
                      >{{ ep.fqdn }}</a
                    >
                    <span class="flex flex-wrap items-center gap-1">
                      <fl-tag [attr.title]="modeTitle(ep)">{{ modeLabel(ep) }}</fl-tag>
                      @if (ep.endpointType === 'internal') {
                        <fl-tag
                          title="Reachable only from the Flui dashboard through the auth proxy"
                          >Internal</fl-tag
                        >
                      }
                      @if (
                        ep.certificateRequired && ep.certificateProvider === 'lets_encrypt_staging'
                      ) {
                        <fl-tag title="Let's Encrypt staging, not trusted by browsers"
                          >Staging</fl-tag
                        >
                      }
                    </span>
                    @if (
                      phase && phase.step !== 'issued' && phase.step !== 'none' && phase.detail
                    ) {
                      <span
                        class="text-fl-caption text-fl-ink-muted"
                        data-testid="endpoint-cert-detail"
                        >{{ phase.detail }}</span
                      >
                    }
                  </div>
                </td>
                <td>
                  <span class="flex flex-col">
                    <span class="fl-mono">{{ ep.serviceName }}</span>
                    <span class="text-fl-caption text-fl-ink-muted">{{ ep.k8sNamespace }}</span>
                  </span>
                </td>
                <td class="fl-mono">{{ ep.dnsRecordType }}</td>
                <td><fl-status [tone]="dns.tone" [label]="dns.label" /></td>
                <td>
                  <fl-status [tone]="tls.tone" [label]="tls.label" [attr.title]="tls.title" />
                </td>
                <td class="is-fit">
                  <div class="flex items-center justify-end gap-1">
                    @if (hasDetails(ep)) {
                      <button
                        flButton="ghost"
                        size="sm"
                        type="button"
                        [iconOnly]="true"
                        [attr.aria-label]="'View details for ' + ep.fqdn"
                        title="View details"
                        (click)="openError(ep)"
                      >
                        <fl-icon name="lucideFileText" />
                      </button>
                    }
                    @if (writable()) {
                      <button
                        flButton="ghost"
                        size="sm"
                        type="button"
                        title="Edit endpoint"
                        [attr.aria-label]="'Edit ' + ep.fqdn"
                        (click)="editAction.emit(ep)"
                      >
                        Edit
                      </button>
                      <button
                        flButton="ghost"
                        size="sm"
                        type="button"
                        title="Sync endpoint"
                        [attr.aria-label]="'Sync ' + ep.fqdn"
                        [disabled]="reconcilingId() === ep.id"
                        (click)="reconcileAction.emit(ep)"
                      >
                        @if (reconcilingId() === ep.id) {
                          <fl-spinner label="Syncing" />
                        }
                        Sync
                      </button>
                      <fl-actions-menu
                        *fluiCan="'app:write'"
                        [attr.data-testid]="'endpoint-delete-' + ep.id"
                        [label]="'Actions for ' + ep.fqdn"
                        [compact]="true"
                        [items]="endpointActions"
                        (action)="deleteAction.emit(ep)"
                      />
                    }
                  </div>
                </td>
              </tr>
              @if (!isManaged(ep) && ep.dnsRecordValue) {
                <tr>
                  <td colspan="6" class="whitespace-normal">
                    <div class="flex flex-wrap items-center gap-2">
                      <fl-status tone="warning" label="DNS record needed" />
                      <span>
                        Create an A record for <span class="fl-mono">{{ ep.fqdn }}</span> pointing
                        to
                      </span>
                      <fl-copy-id [value]="ep.dnsRecordValue" label="IP address" />
                      <span>in your DNS provider.</span>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    } @else {
      <fl-empty-state
        icon="lucideGlobe"
        [compact]="true"
        title="No endpoints yet"
        body="Add an endpoint to publish an application on a hostname."
      />
    }

    @if (activeError(); as error) {
      <app-endpoint-error-dialog
        [error]="error"
        [messageCopied]="certMessageCopied()"
        (closed)="closeError()"
        (download)="downloadError()"
        (copyMessage)="copyCertMessage($event)"
      />
    }
  `,
})
export class DnsEndpointsListComponent {
  endpoints = input.required<AppEndpointResponseDto[]>();
  reconcilingId = input<string | null>(null);
  certPollingId = input<string | null>(null);
  /**
   * The half of the answer this list cannot know on its own.
   *
   * `DELETE /endpoints/:id` asks two questions — `app:write` on the principal,
   * which `*fluiCan` reads from the same source that draws the sections, and
   * ownership of the endpoint's application, which only the page holding that
   * application can answer. The application's DNS tab binds this to the access
   * summary the API already ships; the cluster's tab lists endpoints belonging
   * to many applications and leaves it alone, because guessing which of them
   * would be refused is exactly what this is not for.
   */
  writable = input<boolean>(true);

  editAction = output<AppEndpointResponseDto>();
  reconcileAction = output<AppEndpointResponseDto>();
  deleteAction = output<AppEndpointResponseDto>();

  protected readonly endpointActions = ENDPOINT_ACTIONS;
  protected readonly hasDetails = hasDetails;
  protected readonly modeLabel = modeLabel;
  protected readonly modeTitle = modeTitle;
  protected activeError = signal<ParsedError | null>(null);
  private readonly activeEndpointId = signal<string | null>(null);
  protected certMessageCopied = signal(false);

  getUrl(fqdn: string, tlsEnabled: boolean): string {
    return buildEndpointUrl(fqdn, tlsEnabled);
  }

  isManaged(ep: AppEndpointResponseDto): boolean {
    return isEndpointManaged(ep.clusterDnsZoneId);
  }

  openError(ep: AppEndpointResponseDto): void {
    this.activeEndpointId.set(ep.id);
    this.activeError.set(buildEndpointError(ep));
  }

  closeError(): void {
    this.activeError.set(null);
    this.activeEndpointId.set(null);
    this.certMessageCopied.set(false);
  }

  copyCertMessage(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.certMessageCopied.set(true);
      setTimeout(() => this.certMessageCopied.set(false), 2000);
    });
  }

  downloadError(): void {
    const err = this.activeError();
    if (!err?.rawJson) return;
    const blob = new Blob([err.rawJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `endpoint-error-${this.activeEndpointId() ?? 'unknown'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  certBadgeLabel(ep: AppEndpointResponseDto): string {
    return certificateLabel(ep);
  }

  phaseOf(ep: AppEndpointResponseDto): CertificatePhase | null {
    return phaseOf(ep);
  }

  /** The raw message, kept behind the details button; Flui's own sentences are shown in the row. */
  technicalOf(ep: AppEndpointResponseDto): string | null {
    return technicalOf(ep);
  }

  protected dnsOf(ep: AppEndpointResponseDto): StateView {
    return dnsState(ep);
  }

  protected tlsOf(ep: AppEndpointResponseDto): StateView {
    return tlsState(ep, this.certPollingId() === ep.id);
  }
}
