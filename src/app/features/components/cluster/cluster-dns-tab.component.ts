import {
  Component,
  inject,
  signal,
  OnInit,
  computed,
  Injector,
  afterNextRender,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRefreshCw } from '@ng-icons/lucide';
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
import { ClusterDnsZoneResponseDto } from '../../../core/api/model/clusterDnsZoneResponseDto';
import { AppEndpointResponseDto } from '../../../core/api/model/appEndpointResponseDto';
import { CreateAppEndpointDto } from '../../../core/api/model/createAppEndpointDto';
import { UpdateAppEndpointDto } from '../../../core/api/model/updateAppEndpointDto';
import { hasPublicEndpoint } from '../../model/app-exposure';
import { ToastService } from '../../../shared/services/toast.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-cluster-dns-tab',
  imports: [
    DnsEndpointsListComponent,
    ClusterDnsZoneSectionComponent,
    ClusterEndpointFormComponent,
    ClusterCertificateIssuersComponent,
    ClusterSystemIngressFormComponent,
    ConfirmationDialogComponent,
    FlAlert,
    FlPanel,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucidePlus, lucideRefreshCw })],
  host: { class: 'fl-stack' },
  template: `
    @if (isLoading()) {
      <fl-panel title="DNS zones">
        <fl-loading-state [rows]="3" />
      </fl-panel>
      <fl-panel title="Endpoints">
        <fl-loading-state [rows]="3" />
      </fl-panel>
    } @else {
      @if (clusterDnsZoneService.error(); as error) {
        <fl-alert tone="error" title="DNS zone request failed">{{ error }}</fl-alert>
      }
      @if (appEndpointsService.error(); as error) {
        <fl-alert tone="error" title="Endpoints request failed">{{ error }}</fl-alert>
      }

      <app-cluster-dns-zone-section
        #zoneSection
        [assignments]="clusterDnsZoneService.assignments()"
        [availableZones]="dnsZonesService.zones()"
        [clusterId]="clusterId()"
        [wildcardIssuersReady]="clusterDnsZoneService.wildcardIssuersReady()"
        [assigning]="assigningZone()"
        [reconcilingId]="reconcilingZoneId()"
        (assignZone)="onAssignZone($event)"
        (removeZone)="onRemoveZone($event)"
        (reconcile)="onReconcileZone($event)"
        (issuersReadyChange)="onIssuersReadyChange($event)"
      />

      <app-cluster-certificate-issuers #issuersSection [clusterId]="clusterId()" />

      @if (clusterDnsZoneService.issuersReady() && clusterDnsZoneService.hasAssignment()) {
        <app-cluster-system-ingress-form
          [clusterId]="clusterId()"
          [zoneName]="clusterDnsZoneService.assignment()?.dnsZone?.zoneName ?? ''"
        />
      }

      <fl-panel title="Endpoints" [count]="appEndpointsService.endpoints().length" [flush]="true">
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
          <button flButton size="sm" type="button" (click)="toggleAddForm()">
            <fl-icon name="lucidePlus" />
            Add endpoint
          </button>
        </ng-container>
        <app-dns-endpoints-list
          [endpoints]="appEndpointsService.endpoints()"
          [reconcilingId]="reconcilingId()"
          (editAction)="editEndpoint($event)"
          (reconcileAction)="reconcileEndpoint($event)"
          (deleteAction)="deleteEndpoint($event)"
        />
      </fl-panel>
    }

    @if (showEndpointForm()) {
      <div
        class="fl-backdrop fixed inset-0 z-50 overflow-y-auto"
        (click)="closeEndpointForm()"
        (keydown.escape)="closeEndpointForm()"
      >
        <div class="flex min-h-full items-center justify-center p-4 py-10">
          <div
            class="w-full max-w-2xl rounded-fl-lg border border-fl-border bg-fl-surface"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="editingEndpoint() ? 'Edit endpoint' : 'New endpoint'"
            (click)="$event.stopPropagation()"
          >
            <app-cluster-endpoint-form
              [clusterId]="clusterId()"
              [assignments]="clusterDnsZoneService.assignments()"
              [endpoint]="editingEndpoint()"
              [applications]="clusterApps()"
              [masterIp]="masterIp()"
              [issuersReady]="clusterDnsZoneService.issuersReady()"
              [wildcardIssuersReady]="clusterDnsZoneService.wildcardIssuersReady()"
              (save)="onSaveEndpoint($event)"
              (cancelled)="closeEndpointForm()"
              (configureIssuers)="onConfigureIssuers()"
              (configureWildcardIssuers)="onConfigureWildcardIssuers()"
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
export class ClusterDnsTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly applicationService = inject(ApplicationService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  protected clusterDnsZoneService = inject(ClusterDnsZoneService);
  protected appEndpointsService = inject(AppEndpointsService);
  private readonly toast = inject(ToastService);
  protected dnsZonesService = inject(DnsZonesService);

  protected isLoading = signal(false);
  protected showEndpointForm = signal(false);
  protected editingEndpoint = signal<AppEndpointResponseDto | undefined>(undefined);
  protected refreshingEndpoints = signal(false);
  protected reconcilingId = signal<string | null>(null);
  protected assigningZone = signal(false);
  protected reconcilingZoneId = signal<string | null>(null);
  protected endpointToDelete = signal<AppEndpointResponseDto | null>(null);

  readonly deleteEndpointDialog =
    viewChild.required<ConfirmationDialogComponent>('deleteEndpointDialog');
  readonly issuersSection =
    viewChild.required<ClusterCertificateIssuersComponent>('issuersSection');
  readonly zoneSection = viewChild.required<ClusterDnsZoneSectionComponent>('zoneSection');

  protected clusterId = computed(() => this.clusterService.cluster()?.id ?? '');
  protected masterIp = computed(() => this.clusterService.cluster()?.masterIpAddress ?? '');

  protected clusterApps = computed<AppOption[]>(() => {
    const id = this.clusterId();
    return this.applicationService
      .applications()
      .filter((a) => a.clusterId === id)
      .map((a) => ({ id: a.id, name: a.name, slug: a.slug, isInternal: !hasPublicEndpoint(a) }));
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
        afterNextRender(
          () => {
            document
              .getElementById('standard-certificate-issuers')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          },
          { injector: this.injector },
        );
      }
    })();
  }

  protected async onAssignZone(dto: AssignDnsZoneDto): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    this.assigningZone.set(true);
    let assignment: ClusterDnsZoneResponseDto | null = null;
    try {
      assignment = await this.clusterDnsZoneService.assignZone(id, dto);
    } finally {
      this.assigningZone.set(false);
    }
    if (!assignment) return;
    this.reconcilingZoneId.set(assignment.id);
    try {
      await this.clusterDnsZoneService.pollAssignmentReconciliation(id, assignment.id);
      await this.clusterDnsZoneService.loadIssuers(id);
    } finally {
      this.reconcilingZoneId.set(null);
    }
  }

  protected onIssuersReadyChange(ready: boolean): void {
    if (ready) {
      this.clusterDnsZoneService.loadIssuers(this.clusterId());
      this.clusterDnsZoneService.loadAssignment(this.clusterId());
    }
  }

  protected async onRemoveZone(assignmentId: string): Promise<void> {
    const id = this.clusterId();
    if (id) await this.clusterDnsZoneService.removeAssignment(id, assignmentId);
  }

  protected async onReconcileZone(assignmentId: string): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    this.reconcilingZoneId.set(assignmentId);
    try {
      const started = await this.clusterDnsZoneService.reconcileAssignment(id, assignmentId);
      if (started) {
        await this.clusterDnsZoneService.pollAssignmentReconciliation(id, assignmentId);
      }
      await this.clusterDnsZoneService.loadIssuers(id);
    } finally {
      this.reconcilingZoneId.set(null);
    }
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
    this.showEndpointForm.update((v) => !v);
  }

  protected editEndpoint(ep: AppEndpointResponseDto): void {
    this.editingEndpoint.set(ep);
    this.showEndpointForm.set(true);
  }

  protected onConfigureIssuers(): void {
    this.closeEndpointForm();
    this.issuersSection().openForm();
  }

  protected onConfigureWildcardIssuers(): void {
    this.closeEndpointForm();
    this.zoneSection().openDnsIssuerSetupForm();
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
    const sync = await this.appEndpointsService.syncEndpoint(ep.id);
    if (sync) {
      await this.appEndpointsService.pollEndpointReconciliation(ep.id, 60000);
      const toast = { title: `${ep.fqdn} synced`, message: sync.says };
      if (sync.certificate === 'failed') this.toast.showWarning(toast);
      else if (sync.certificate === 'waiting') this.toast.showInfo(toast);
      else this.toast.showSuccess(toast);
    }
    this.reconcilingId.set(null);
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
