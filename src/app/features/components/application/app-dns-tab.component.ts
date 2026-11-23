import {
  Component,
  inject,
  signal,
  OnInit,
  computed,
  effect,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRefreshCw } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { ApplicationService } from '../../service/application.service';
import { ClusterService } from '../../service/cluster.service';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { AuthzInstallService } from '../../service/authz-install.service';
import { DnsEndpointsListComponent } from '../dns/dns-endpoints-list.component';
import { ClusterEndpointFormComponent } from '../cluster/cluster-endpoint-form.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { AppEndpointResponseDto } from '../../../core/api/model/appEndpointResponseDto';
import { CreateAppEndpointDto } from '../../../core/api/model/createAppEndpointDto';
import { UpdateAppEndpointDto } from '../../../core/api/model/updateAppEndpointDto';
import { AuthzInstallResponseDto } from '../../../core/api/model/authzInstallResponseDto';
import { CatalogClusterCapabilitiesDto } from '../../../core/api/model/catalogClusterCapabilitiesDto';
import { CatalogService } from '../../../core/api/api/catalog.service';
import { hasPublicEndpoint } from '../../model/app-exposure';
import { accessOf } from '../../model/app-access';
import { ToastService } from '../../../shared/services/toast.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { FlDialogFocus } from '../../../ui/overlays/dialog-focus';

@Component({
  selector: 'app-app-dns-tab',
  standalone: true,
  imports: [
    FlDialogFocus,
    RouterModule,
    DnsEndpointsListComponent,
    ClusterEndpointFormComponent,
    ConfirmationDialogComponent,
    FlAlert,
    FlPanel,
    FlTable,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
  ],
  providers: [provideIcons({ lucidePlus, lucideRefreshCw })],
  host: { class: 'fl-stack' },
  template: `
    @if (isInternalApp()) {
      <fl-alert tone="info" title="Internal app">
        Endpoints use the <span class="fl-mono">.internal.&lt;zone&gt;</span> subdomain and are
        reachable only from the Flui dashboard, through an authenticated proxy. DNS records and
        certificates follow the standard flow.
      </fl-alert>
    }

    @if (isLoading()) {
      <fl-panel title="DNS zone">
        <fl-loading-state [rows]="3" />
      </fl-panel>
    } @else {
      <fl-panel title="DNS zone" [flush]="true">
        @if (clusterDnsZoneService.error(); as error) {
          <div class="p-4">
            <fl-alert tone="error" title="DNS zone request failed">{{ error }}</fl-alert>
          </div>
        }
        @if (clusterDnsZoneService.hasAssignment()) {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Zone</th>
                  <th scope="col">Provider</th>
                  <th scope="col" class="is-fit">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (zone of clusterDnsZoneService.assignments(); track zone.id) {
                  <tr>
                    <td class="fl-mono">{{ zone.dnsZone.zoneName }}</td>
                    <td>{{ zone.dnsZone.dnsProvider }}</td>
                    <td><fl-status tone="success" label="Assigned" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <fl-empty-state
            [compact]="true"
            title="No DNS zone assigned"
            body="Assign a zone to this cluster in its DNS settings."
          >
            <a flButton size="sm" [routerLink]="['/cluster', clusterId(), 'dns']">
              Open cluster DNS
            </a>
          </fl-empty-state>
        }
      </fl-panel>

      <fl-panel title="Endpoints" [count]="filteredEndpoints().length" [flush]="true">
        <ng-container panelActions>
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [iconOnly]="true"
            aria-label="Refresh endpoints"
            [disabled]="refreshingEndpoints()"
            (click)="refreshEndpoints()"
          >
            @if (refreshingEndpoints()) {
              <fl-spinner label="Refreshing endpoints" />
            } @else {
              <fl-icon name="lucideRefreshCw" />
            }
          </button>
          @if (!readOnly()) {
            <button flButton size="sm" type="button" (click)="openAddForm()">
              <fl-icon name="lucidePlus" />
              Add endpoint
            </button>
          }
        </ng-container>
        @if (appEndpointsService.error(); as error) {
          <div class="p-4">
            <fl-alert tone="error" title="Endpoints request failed">{{ error }}</fl-alert>
          </div>
        }
        <app-dns-endpoints-list
          [endpoints]="filteredEndpoints()"
          [reconcilingId]="reconcilingId()"
          [certPollingId]="certPollingId()"
          [writable]="!readOnly()"
          (editAction)="editEndpoint($event)"
          (reconcileAction)="reconcileEndpoint($event)"
          (deleteAction)="deleteEndpoint($event)"
        />
      </fl-panel>
    }

    @if (showEndpointForm()) {
      <div class="fl-backdrop fixed inset-0 z-50 overflow-y-auto" (click)="closeEndpointForm()">
        <div class="flex min-h-full items-center justify-center p-4 py-10">
          <div
            class="w-full max-w-2xl rounded-fl-lg bg-fl-surface"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="editingEndpoint() ? 'Edit endpoint' : 'New endpoint'"
            flDialogFocus
            (dismissed)="closeEndpointForm()"
            (click)="$event.stopPropagation()"
          >
            <app-cluster-endpoint-form
              [clusterId]="clusterId()"
              [assignments]="clusterDnsZoneService.assignments()"
              [endpoint]="editingEndpoint()"
              [fixedApplicationId]="appId()"
              [fixedAppSlug]="appSlug()"
              [masterIp]="masterIp()"
              [issuersReady]="clusterDnsZoneService.issuersReady()"
              [wildcardIssuersReady]="clusterDnsZoneService.wildcardIssuersReady()"
              [defaultEndpointType]="isInternalApp() ? 'internal' : 'public'"
              [internalHostingAvailable]="internalHostingAvailable()"
              [internalHostingMissing]="internalHostingMissing()"
              [authzReady]="authzReady()"
              [authzInstalling]="authzInstall.installing()"
              (save)="onSaveEndpoint($event)"
              (cancelled)="closeEndpointForm()"
              (configureIssuers)="onConfigureIssuers()"
              (configureWildcardIssuers)="onConfigureWildcardIssuers()"
              (configureInternalHosting)="onConfigureInternalHosting()"
              (installAuthz)="onInstallAuthz()"
            />
          </div>
        </div>
      </div>
    }

    <app-confirmation-dialog
      #deleteEndpointDialog
      title="Delete endpoint"
      [message]="
        endpointToDelete()
          ? 'Delete endpoint ' + endpointToDelete()!.fqdn + '? This cannot be undone.'
          : ''
      "
      confirmText="Delete"
      variant="danger"
      (confirmed)="executeDeleteEndpoint()"
      (cancelled)="endpointToDelete.set(null)"
    />
  `,
})
export class AppDnsTabComponent implements OnInit {
  private readonly appService = inject(ApplicationService);
  private readonly clusterService = inject(ClusterService);
  private readonly router = inject(Router);
  private readonly catalogApi = inject(CatalogService);
  protected clusterDnsZoneService = inject(ClusterDnsZoneService);
  protected appEndpointsService = inject(AppEndpointsService);
  private readonly toast = inject(ToastService);
  protected authzInstall = inject(AuthzInstallService);

  private readonly capabilities = signal<CatalogClusterCapabilitiesDto | null>(null);

  protected internalHostingAvailable = computed(
    () => this.capabilities()?.hasInternalHosting === true,
  );
  protected internalHostingMissing = computed(
    () => this.capabilities()?.internalHostingMissing ?? [],
  );
  protected authzReady = computed(
    () => this.authzInstall.install()?.status === AuthzInstallResponseDto.StatusEnum.Running,
  );

  readonly deleteEndpointDialog =
    viewChild.required<ConfirmationDialogComponent>('deleteEndpointDialog');

  protected isLoading = signal(false);
  protected showEndpointForm = signal(false);
  protected editingEndpoint = signal<AppEndpointResponseDto | undefined>(undefined);
  protected refreshingEndpoints = signal(false);
  protected reconcilingId = signal<string | null>(null);
  protected certPollingId = signal<string | null>(null);
  protected endpointToDelete = signal<AppEndpointResponseDto | null>(null);

  protected clusterId = computed(() => this.appService.selectedApplication()?.clusterId ?? '');
  protected appId = computed(() => this.appService.selectedApplication()?.id ?? '');
  protected appSlug = computed(() => this.appService.selectedApplication()?.slug ?? '');
  protected isInternalApp = computed(
    () =>
      !!this.appService.selectedApplication() &&
      !hasPublicEndpoint(this.appService.selectedApplication()),
  );

  /**
   * The application's own answer, not a guess. `application-detail` already
   * writes "read-only for you" from this same summary and then left every tab's
   * own commands switched on underneath the sentence.
   */
  protected readOnly = computed(
    () => accessOf(this.appService.selectedApplication())?.readOnly === true,
  );

  protected masterIp = computed(() => {
    const id = this.clusterId();
    return this.clusterService.clusters().find((c) => c.id === id)?.masterIpAddress ?? '';
  });

  /** Only show endpoints belonging to this specific application */
  protected filteredEndpoints = computed(() => {
    const id = this.appId();
    return this.appEndpointsService.endpoints().filter((ep) => ep.applicationId === id);
  });

  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const id = this.clusterId();
      if (id && id !== this.loadedFor) untracked(() => this.load(id));
    });
  }

  ngOnInit(): void {
    const id = this.clusterId();
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.loadedFor = id;
    void (async () => {
      this.isLoading.set(true);
      await Promise.all([
        this.clusterDnsZoneService.loadAssignment(id),
        this.clusterDnsZoneService.loadIssuers(id),
        this.appEndpointsService.loadEndpoints(id),
        this.clusterService.loadClusters(),
        this.loadCapabilities(id),
        this.authzInstall.loadForCluster(id),
      ]);
      this.isLoading.set(false);
    })();
  }

  protected async refreshEndpoints(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    this.refreshingEndpoints.set(true);
    await this.appEndpointsService.loadEndpoints(id);
    this.refreshingEndpoints.set(false);
  }

  protected openAddForm(): void {
    this.editingEndpoint.set(undefined);
    this.showEndpointForm.set(true);
  }

  protected editEndpoint(ep: AppEndpointResponseDto): void {
    this.editingEndpoint.set(ep);
    this.showEndpointForm.set(true);
  }

  protected onConfigureIssuers(): void {
    this.router.navigate(['/infrastructure/domains/issuers']);
  }

  protected onConfigureInternalHosting(): void {
    this.router.navigate(['/cluster', this.clusterId(), 'dns']);
  }

  protected onConfigureWildcardIssuers(): void {
    this.closeEndpointForm();
    this.router.navigate(['/cluster', this.clusterId(), 'dns']);
  }

  protected async onInstallAuthz(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    await this.authzInstall.installAuthz(id);
  }

  private async loadCapabilities(clusterId: string): Promise<void> {
    try {
      const caps = await firstValueFrom(
        this.catalogApi.catalogControllerGetClusterCapabilities(clusterId),
      );
      this.capabilities.set(caps);
    } catch {
      this.capabilities.set(null);
    }
  }

  protected closeEndpointForm(): void {
    this.showEndpointForm.set(false);
    this.editingEndpoint.set(undefined);
  }

  protected async onSaveEndpoint(
    event:
      { clusterId: string; dto: CreateAppEndpointDto } | { id: string; dto: UpdateAppEndpointDto },
  ): Promise<void> {
    let endpointId: string | null = null;
    let certRequired = false;
    if ('clusterId' in event) {
      const ep = await this.appEndpointsService.createEndpoint(event.clusterId, event.dto);
      endpointId = ep?.id ?? null;
      certRequired = event.dto.certificateRequired ?? false;
    } else {
      const ep = await this.appEndpointsService.updateEndpoint(event.id, event.dto);
      endpointId = event.id;
      certRequired = ep?.certificateRequired ?? false;
    }
    this.closeEndpointForm();
    if (endpointId) {
      this.reconcilingId.set(endpointId);
      const result = await this.appEndpointsService.reconcileEndpoint(endpointId);
      if (result) {
        await this.appEndpointsService.pollEndpointReconciliation(endpointId, 60000);
      }
      this.reconcilingId.set(null);
      if (certRequired) {
        this.startCertPolling(endpointId);
      }
    }
  }

  protected async reconcileEndpoint(ep: AppEndpointResponseDto): Promise<void> {
    this.reconcilingId.set(ep.id);
    const sync = await this.appEndpointsService.syncEndpoint(ep.id);
    if (sync) {
      await this.appEndpointsService.pollEndpointReconciliation(ep.id, 60000);
      const toast = { title: `${ep.fqdn} synced`, message: sync.says };
      if (sync.certificate === 'failed') this.toast.showWarning(toast);
      else if (sync.certificate === 'waiting') this.toast.showInfo(toast);
      else this.toast.showSuccess(toast);
    }
    this.reconcilingId.set(null);
    if (ep.certificateRequired) {
      this.startCertPolling(ep.id);
    }
  }

  private startCertPolling(endpointId: string): void {
    const ep = this.filteredEndpoints().find((e) => e.id === endpointId);
    const certStatus = ep?.certificateStatus ?? null;
    const terminalStates = ['valid', 'failed', 'expired'];
    if (certStatus && terminalStates.includes(certStatus)) return;

    this.certPollingId.set(endpointId);
    this.appEndpointsService.pollCertificateStatus(endpointId, 300000).then(() => {
      if (this.certPollingId() === endpointId) {
        this.certPollingId.set(null);
      }
    });
  }

  protected deleteEndpoint(ep: AppEndpointResponseDto): void {
    this.endpointToDelete.set(ep);
    this.deleteEndpointDialog().open();
  }

  protected async executeDeleteEndpoint(): Promise<void> {
    const ep = this.endpointToDelete();
    if (!ep) return;
    this.deleteEndpointDialog().setProcessing(true);
    await this.appEndpointsService.deleteEndpoint(ep.id);
    this.deleteEndpointDialog().close();
    this.endpointToDelete.set(null);
  }
}
