import { Component, inject, signal, OnInit, computed, ViewChild, Injector, afterNextRender } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideGlobe, lucideLoader, lucidePlusCircle, lucideRefreshCw, lucideAlertCircle } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { ApplicationService } from '../../service/application.service';
import { DnsZonesService } from '../../service/dns-zones.service';
import { DnsEndpointsListComponent } from '../dns/dns-endpoints-list.component';
import { ClusterDnsZoneSectionComponent } from './cluster-dns-zone-section.component';
import { ClusterEndpointFormComponent, AppOption } from './cluster-endpoint-form.component';
import { ClusterCertificateIssuersComponent } from './cluster-certificate-issuers.component';
import { ClusterSystemIngressFormComponent } from './cluster-system-ingress-form.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { AssignDnsZoneDto } from '../../../core/api/model/assignDnsZoneDto';
import { AppEndpointResponseDto } from '../../../core/api/model/appEndpointResponseDto';
import { CreateAppEndpointDto } from '../../../core/api/model/createAppEndpointDto';
import { UpdateAppEndpointDto } from '../../../core/api/model/updateAppEndpointDto';
import { hasPublicEndpoint } from '../../model/app-exposure';

@Component({
  selector: 'app-cluster-dns-tab',
  standalone: true,
  imports: [
    NgIconComponent,
    DnsEndpointsListComponent,
    ClusterDnsZoneSectionComponent,
    ClusterEndpointFormComponent,
    ClusterCertificateIssuersComponent,
    ClusterSystemIngressFormComponent,
    ConfirmationDialogComponent,
  ],
  providers: [
    provideIcons({ lucideGlobe, lucideLoader, lucidePlusCircle, lucideRefreshCw, lucideAlertCircle }),
  ],
  template: `
    <div class="card-surface p-6 space-y-6">

      @if (isLoading()) {
        <div class="animate-pulse space-y-6">
          <!-- Zone section skeleton -->
          <div class="space-y-3">
            <div class="skeleton h-4 w-28"></div>
            <div class="border border-border rounded-lg p-4 space-y-3">
              <div class="skeleton h-9 w-full"></div>
              <div class="skeleton h-9 w-28"></div>
            </div>
          </div>
          <!-- Issuers section skeleton -->
          <div class="border-t border-border pt-6 space-y-3">
            <div class="skeleton h-4 w-36"></div>
            <div class="flex gap-2">
              @for (i of [1,2]; track i) {
                <div class="skeleton h-16 flex-1"></div>
              }
            </div>
          </div>
          <!-- Endpoints section skeleton -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="skeleton h-4 w-28"></div>
              <div class="skeleton h-6 w-24"></div>
            </div>
            @for (i of [1,2,3]; track i) {
              <div class="skeleton h-12 rounded-lg"></div>
            }
          </div>
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

        <!-- Section 1: DNS Zone + Issuer setup (STEP 1-4) -->
        <app-cluster-dns-zone-section
          [assignment]="clusterDnsZoneService.assignment()"
          [availableZones]="dnsZonesService.zones()"
          [clusterId]="clusterId()"
          (assignZone)="onAssignZone($event)"
          (removeZone)="onRemoveZone()"
          (reconcile)="onReconcileZone()"
          (issuersReadyChange)="onIssuersReadyChange($event)"
        />

        <!-- Section 2: Certificate Issuers -->
        <div class="border-t border-border pt-6">
          <app-cluster-certificate-issuers #issuersSection [clusterId]="clusterId()" />
        </div>

        <!-- Section 2.5: System Ingress (visible once issuers are ready) -->
        @if (clusterDnsZoneService.issuersReady() && clusterDnsZoneService.hasAssignment()) {
          <div class="border-t border-border pt-6">
            <app-cluster-system-ingress-form
              [clusterId]="clusterId()"
              [zoneName]="clusterDnsZoneService.assignment()?.dnsZone?.zoneName ?? ''"
            />
          </div>
        }

        <!-- Section 3: App Endpoints -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-foreground">App Endpoints</h3>
            <div class="flex items-center gap-2">
              <button
                (click)="toggleAddForm()"
                class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
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

          <!-- Add/Edit form -->
          @if (showEndpointForm()) {
            <app-cluster-endpoint-form
              [clusterId]="clusterId()"
              [assignment]="clusterDnsZoneService.assignment()"
              [endpoint]="editingEndpoint()"
              [applications]="clusterApps()"
              [masterIp]="masterIp()"
              [issuersReady]="clusterDnsZoneService.issuersReady()"
              (save)="onSaveEndpoint($event)"
              (cancelled)="closeEndpointForm()"
              (configureIssuers)="onConfigureIssuers()"
            />
          }

          <!-- Endpoints list with inline actions -->
          <app-dns-endpoints-list
            [endpoints]="appEndpointsService.endpoints()"
            [reconcilingId]="reconcilingId()"
            (editAction)="editEndpoint($event)"
            (reconcileAction)="reconcileEndpoint($event)"
            (deleteAction)="deleteEndpoint($event)"
          />
        </div>
      }
    </div>

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
export class ClusterDnsTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly applicationService = inject(ApplicationService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  protected clusterDnsZoneService = inject(ClusterDnsZoneService);
  protected appEndpointsService = inject(AppEndpointsService);
  protected dnsZonesService = inject(DnsZonesService);

  protected isLoading = signal(false);
  protected showEndpointForm = signal(false);
  protected editingEndpoint = signal<AppEndpointResponseDto | undefined>(undefined);
  protected refreshingEndpoints = signal(false);
  protected reconcilingId = signal<string | null>(null);
  protected endpointToDelete = signal<AppEndpointResponseDto | null>(null);

  @ViewChild('deleteEndpointDialog') deleteEndpointDialog!: ConfirmationDialogComponent;
  @ViewChild('issuersSection') issuersSection!: ClusterCertificateIssuersComponent;

  protected clusterId = computed(() => this.clusterService.cluster()?.id ?? '');
  protected masterIp = computed(() => this.clusterService.cluster()?.masterIpAddress ?? '');

  protected clusterApps = computed<AppOption[]>(() => {
    const id = this.clusterId();
    return this.applicationService.applications()
      .filter(a => a.clusterId === id)
      .map(a => ({ id: a.id, name: a.name, slug: a.slug, isInternal: !hasPublicEndpoint(a) }));
  });

  ngOnInit(): void {
    void (async () => {
      const cluster = this.clusterService.cluster();
      if (!cluster?.id) return;
  
      this.isLoading.set(true);
      await Promise.all([
        this.clusterDnsZoneService.loadAssignment(cluster.id),
        this.clusterDnsZoneService.loadIssuers(cluster.id),
        this.appEndpointsService.loadEndpoints(cluster.id),
        this.dnsZonesService.loadZones(),
        this.applicationService.loadApplications(),
      ]);
      this.isLoading.set(false);
  
      const fragment = this.route.snapshot.fragment;
      if (fragment === 'standard-certificate-issuers') {
        afterNextRender(() => {
          document.getElementById('standard-certificate-issuers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, { injector: this.injector });
      }
    })();
  }

  protected async onAssignZone(dto: AssignDnsZoneDto): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    await this.clusterDnsZoneService.assignZone(id, dto);
  }

  protected onIssuersReadyChange(ready: boolean): void {
    // Keep service signal in sync so other parts of the tab (endpoint form, system ingress) react
    if (ready) this.clusterDnsZoneService.loadIssuers(this.clusterId());
  }

  protected async onRemoveZone(): Promise<void> {
    const id = this.clusterId();
    if (id) await this.clusterDnsZoneService.removeAssignment(id);
  }

  protected async onReconcileZone(): Promise<void> {
    const id = this.clusterId();
    if (id) await this.clusterDnsZoneService.updateCertConfig(id);
  }

  protected async refreshEndpoints(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    this.refreshingEndpoints.set(true);
    await this.appEndpointsService.loadEndpoints(id);
    this.refreshingEndpoints.set(false);
  }

  protected toggleAddForm(): void {
    this.editingEndpoint.set(undefined);
    this.showEndpointForm.update(v => !v);
  }

  protected editEndpoint(ep: AppEndpointResponseDto): void {
    this.editingEndpoint.set(ep);
    this.showEndpointForm.set(true);
  }

  protected onConfigureIssuers(): void {
    this.closeEndpointForm();
    this.issuersSection.openForm();
  }

  protected closeEndpointForm(): void {
    this.showEndpointForm.set(false);
    this.editingEndpoint.set(undefined);
  }

  protected async onSaveEndpoint(
    event: { clusterId: string; dto: CreateAppEndpointDto } | { id: string; dto: UpdateAppEndpointDto }
  ): Promise<void> {
    let endpointId: string | null = null;
    if ('clusterId' in event) {
      const ep = await this.appEndpointsService.createEndpoint(event.clusterId, event.dto);
      endpointId = ep?.id ?? null;
    } else {
      await this.appEndpointsService.updateEndpoint(event.id, event.dto);
      endpointId = event.id;
    }
    this.closeEndpointForm();
    if (endpointId) {
      const result = await this.appEndpointsService.reconcileEndpoint(endpointId);
      if (result) {
        this.appEndpointsService.pollEndpointReconciliation(endpointId, 60000);
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
