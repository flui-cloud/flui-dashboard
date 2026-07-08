import { Component, inject, signal, OnInit, computed, ViewChild } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideGlobe, lucideLoader, lucidePlusCircle, lucideRefreshCw,
  lucideAlertCircle, lucideCheckCircle,
} from '@ng-icons/lucide';
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

@Component({
  selector: 'app-app-dns-tab',
  standalone: true,
  imports: [RouterModule, NgIconComponent, DnsEndpointsListComponent, ClusterEndpointFormComponent, ConfirmationDialogComponent],
  providers: [
    provideIcons({
      lucideGlobe, lucideLoader, lucidePlusCircle, lucideRefreshCw,
      lucideAlertCircle, lucideCheckCircle,
    }),
  ],
  template: `
    <div class="space-y-6">

      @if (isInternalApp()) {
        <div class="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <ng-icon name="lucideGlobe" class="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p class="text-sm text-blue-700 dark:text-blue-300">
            <span class="font-medium text-blue-900 dark:text-blue-100">Internal app.</span>
            Endpoints use the <span class="font-mono text-xs">.internal.&lt;zone&gt;</span> subdomain convention and are reachable only from the Flui dashboard via an authenticated proxy. DNS records and certificates are managed here through the standard flow.
          </p>
        </div>
      }

      @if (isLoading()) {
        <div class="flex items-center justify-center py-8">
          <ng-icon name="lucideLoader" class="h-6 w-6 animate-spin text-blue-600" />
          <p class="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading DNS configuration...</p>
        </div>
      } @else {

        <!-- Error banners -->
        @if (clusterDnsZoneService.error()) {
          <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            <ng-icon name="lucideAlertCircle" class="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{{ clusterDnsZoneService.error() }}</span>
          </div>
        }
        @if (appEndpointsService.error()) {
          <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            <ng-icon name="lucideAlertCircle" class="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{{ appEndpointsService.error() }}</span>
          </div>
        }

        <!-- DNS Zone info (read-only) -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ng-icon name="lucideGlobe" class="h-4 w-4 text-blue-600" />
            DNS Zone
          </h3>
          @if (clusterDnsZoneService.hasAssignment()) {
            @for (zone of clusterDnsZoneService.assignments(); track zone.id) {
              <div class="flex items-center gap-2">
                <ng-icon name="lucideCheckCircle" class="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span class="text-sm text-gray-700 dark:text-gray-300 font-mono">{{ zone.dnsZone.zoneName }}</span>
                <span class="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  {{ zone.dnsZone.dnsProvider }}
                </span>
              </div>
            }
          } @else {
            <p class="text-sm text-gray-500 dark:text-gray-400">
              No DNS zone assigned to this cluster.
              <a
                [routerLink]="['/cluster', clusterId(), 'dns']"
                class="ml-1 text-blue-600 dark:text-blue-400 hover:underline"
              >Configure in cluster DNS settings →</a>
            </p>
          }
        </div>

        <!-- App Endpoints -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">App Endpoints</h3>
            <div class="flex items-center gap-3">
              <button
                (click)="openAddForm()"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
              >
                <ng-icon name="lucidePlusCircle" class="h-3.5 w-3.5" />
                Add Endpoint
              </button>
              <button
                (click)="refreshEndpoints()"
                [disabled]="refreshingEndpoints()"
                class="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
                title="Refresh endpoints"
              >
                <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="refreshingEndpoints()" />
              </button>
            </div>
          </div>

          <!-- Endpoints list with inline actions (filtered to this app only) -->
          <app-dns-endpoints-list
            [endpoints]="filteredEndpoints()"
            [reconcilingId]="reconcilingId()"
            [certPollingId]="certPollingId()"
            (editAction)="editEndpoint($event)"
            (reconcileAction)="reconcileEndpoint($event)"
            (deleteAction)="deleteEndpoint($event)"
          />
        </div>
      }
    </div>

    <!-- Add/Edit endpoint modal — keeps the form out of the page flow so the
         "Add Endpoint" action doesn't push the list down and disorient users. -->
    @if (showEndpointForm()) {
      <div
        class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto"
        (click)="closeEndpointForm()"
      >
        <div class="min-h-full flex items-center justify-center p-4 py-10">
          <div
            class="w-full max-w-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl pb-4"
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
              [defaultEndpointType]="isInternalApp() ? 'internal' : 'public'"
              [internalHostingAvailable]="internalHostingAvailable()"
              [internalHostingMissing]="internalHostingMissing()"
              [authzReady]="authzReady()"
              [authzInstalling]="authzInstall.installing()"
              (save)="onSaveEndpoint($event)"
              (cancelled)="closeEndpointForm()"
              (configureIssuers)="onConfigureIssuers()"
              (configureInternalHosting)="onConfigureInternalHosting()"
              (installAuthz)="onInstallAuthz()"
            />
          </div>
        </div>
      </div>
    }

    <app-confirmation-dialog
      #deleteEndpointDialog
      title="Delete Endpoint"
      [message]="endpointToDelete() ? 'Delete endpoint ' + endpointToDelete()!.fqdn + '? This cannot be undone.' : ''"
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

  @ViewChild('deleteEndpointDialog') deleteEndpointDialog!: ConfirmationDialogComponent;

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
    () => !!this.appService.selectedApplication() && !hasPublicEndpoint(this.appService.selectedApplication()),
  );

  protected masterIp = computed(() => {
    const id = this.clusterId();
    return this.clusterService.clusters().find(c => c.id === id)?.masterIpAddress ?? '';
  });

  /** Only show endpoints belonging to this specific application */
  protected filteredEndpoints = computed(() => {
    const id = this.appId();
    return this.appEndpointsService.endpoints().filter(ep => ep.applicationId === id);
  });

  ngOnInit(): void {
    void (async () => {
      const id = this.clusterId();
      if (!id) return;
  
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
      // Capabilities are best-effort — the form falls back to disabling internal options.
      this.capabilities.set(null);
    }
  }

  protected closeEndpointForm(): void {
    this.showEndpointForm.set(false);
    this.editingEndpoint.set(undefined);
  }

  protected async onSaveEndpoint(
    event: { clusterId: string; dto: CreateAppEndpointDto } | { id: string; dto: UpdateAppEndpointDto }
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
    const result = await this.appEndpointsService.reconcileEndpoint(ep.id);
    if (result) {
      await this.appEndpointsService.pollEndpointReconciliation(ep.id, 60000);
    }
    this.reconcilingId.set(null);
    if (ep.certificateRequired) {
      this.startCertPolling(ep.id);
    }
  }

  private startCertPolling(endpointId: string): void {
    const ep = this.filteredEndpoints().find(e => e.id === endpointId);
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
    this.deleteEndpointDialog.open();
  }

  protected async executeDeleteEndpoint(): Promise<void> {
    const ep = this.endpointToDelete();
    if (!ep) return;
    this.deleteEndpointDialog.setProcessing(true);
    await this.appEndpointsService.deleteEndpoint(ep.id);
    this.deleteEndpointDialog.close();
    this.endpointToDelete.set(null);
  }
}
