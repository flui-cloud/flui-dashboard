import { DatePipe } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  viewChild,
  effect,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideServer } from '@ng-icons/lucide';
import { VirtualInstancesService, InfrastructureServersService } from '../../../core/api';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import {
  InstanceWithLabels,
  isManagedByFlui,
  getOwnership,
  getClusterInfo,
} from '../../model/instance.models';
import { InstanceDeleteDialogComponent } from './instance-delete-dialog.component';
import { InstanceManagedBadgeComponent } from './instance-managed-badge.component';
import { InstanceSshPanel } from './instance-ssh-panel';
import { ClusterService } from '../../service/cluster.service';
import { ClusterType, isControlClusterType } from '../../model/cluster.models';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlMetric, FlMetricStrip } from '../../../ui/patterns/metric-strip';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import {
  formatDisk,
  formatMemory,
  instanceStatusLabel,
  instanceStatusTone,
} from './instance-status';
import {
  InstanceDetailSurfaceInput,
  InstanceDetailSurfaceRevision,
  buildInstanceDetailSurface,
  presentedContent,
} from './instance-detail-surface';

@Component({
  selector: 'app-instance-detail',
  imports: [
    DatePipe,
    RouterLink,
    InstanceDeleteDialogComponent,
    InstanceManagedBadgeComponent,
    InstanceSshPanel,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlCopyId,
    FlKeyValue,
    FlKvItem,
    FlMetricStrip,
    FlMetric,
    FlEmptyState,
    FlLoadingState,
    FlActionsMenu,
    FlButton,
    FlStatus,
  ],
  providers: [provideIcons({ lucideServer })],
  template: `
    <div class="fl-page">
      @if (isLoading()) {
        <fl-page-header title="Instance" [breadcrumb]="breadcrumb()" />
        <fl-panel><fl-loading-state [rows]="6" /></fl-panel>
      } @else if (instance(); as inst) {
        <fl-page-header [title]="inst.displayName || inst.name" [breadcrumb]="breadcrumb()">
          <fl-status headerStatus [tone]="statusTone()" [label]="statusLabel()" />
          <app-instance-managed-badge headerStatus [ownership]="ownership()" />
          @if (inst.displayName && inst.displayName !== inst.name) {
            <span headerMeta class="fl-mono">{{ inst.name }}</span>
          }
          <fl-copy-id headerMeta [value]="inst.providerId" label="provider ID" />
          <span headerMeta>{{ meta() }}</span>
          <ng-container headerActions>
            @if (isManaged()) {
              <fl-actions-menu
                label="Actions"
                [items]="moreActions()"
                [attr.title]="
                  isObservabilityInstance() ? 'Control instance can only be managed via CLI' : null
                "
                (action)="openDeleteDialog()"
              />
            }
          </ng-container>
        </fl-page-header>

        @if (deleteError(); as error) {
          <fl-alert tone="error" title="Could not delete the instance">
            {{ error }}
            <button
              alertActions
              flButton="ghost"
              size="sm"
              type="button"
              (click)="deleteError.set(null)"
            >
              Dismiss
            </button>
          </fl-alert>
        }

        @if (isObservabilityInstance()) {
          <fl-alert tone="info" title="Control instance">
            This instance is part of the control cluster and can only be managed from the CLI.
          </fl-alert>
        }

        <fl-metric-strip>
          <fl-metric label="CPU cores" [value]="inst.cpuCores" />
          <fl-metric label="Memory" [value]="memory(inst.ramMb)" />
          <fl-metric label="Storage" [value]="disk(inst.diskMb)" />
        </fl-metric-strip>

        <div class="fl-grid-2">
          <fl-panel title="Details">
            <fl-key-value>
              @if (clusterInfo(); as cluster) {
                <fl-kv-item key="Cluster">
                  <a class="fl-link" [routerLink]="['/cluster', cluster.clusterId]">{{
                    cluster.clusterName || cluster.clusterId
                  }}</a>
                </fl-kv-item>
                <fl-kv-item key="Node type">{{ cluster.nodeType }}</fl-kv-item>
              }
              @if (inst.osType) {
                <fl-kv-item key="Operating system">{{ inst.osType }}</fl-kv-item>
              }
              @if (inst.productType) {
                <fl-kv-item key="Product type">{{ inst.productType }}</fl-kv-item>
              }
              @if (inst.productName) {
                <fl-kv-item key="Product name">{{ inst.productName }}</fl-kv-item>
              }
              @if (inst.defaultUser) {
                <fl-kv-item key="Default user" [mono]="true">{{ inst.defaultUser }}</fl-kv-item>
              }
              <fl-kv-item key="Created">{{ inst.createdAt | date: 'short' }}</fl-kv-item>
              <fl-kv-item key="Last updated">{{ inst.updatedAt | date: 'short' }}</fl-kv-item>
            </fl-key-value>
          </fl-panel>

          <fl-panel title="Network">
            <fl-key-value>
              <fl-kv-item key="IPv4 address">
                @if (inst.ipConfig?.v4?.ip; as ip) {
                  <fl-copy-id [value]="ip" label="IPv4 address" />
                } @else {
                  <span class="text-fl-ink-muted">—</span>
                }
              </fl-kv-item>
              @if (inst.ipConfig?.v6?.ip; as ip) {
                <fl-kv-item key="IPv6 address">
                  <fl-copy-id [value]="ip" label="IPv6 address" />
                </fl-kv-item>
              }
              @if (inst.macAddress) {
                <fl-kv-item key="MAC address" [mono]="true">{{ inst.macAddress }}</fl-kv-item>
              }
              <fl-kv-item key="Region">{{ inst.regionName || inst.region }}</fl-kv-item>
              @if (inst.dataCenter) {
                <fl-kv-item key="Data center" [mono]="true">{{ inst.dataCenter }}</fl-kv-item>
              }
            </fl-key-value>
          </fl-panel>
        </div>

        @if (isManaged()) {
          <app-instance-ssh-panel
            [canConnect]="!!canConnectSsh()"
            [unavailableReason]="
              inst.status !== 'running' ? 'Instance must be running' : 'No IP address available'
            "
            [terminalVisible]="isTerminalVisible()"
            [showBootstrapKey]="isWorkloadInstance()"
            [useBootstrapKey]="useBootstrapKey()"
            [serverId]="getServerIdForSsh()"
            [serverIp]="getServerIpForSsh()"
            [clusterId]="clusterInfo()?.clusterId"
            (toggleTerminal)="toggleTerminal()"
            (toggleBootstrapKey)="toggleBootstrapKey()"
          />
        }
      } @else {
        <fl-page-header title="Instance not found" [breadcrumb]="breadcrumb()" />
        <fl-panel>
          <fl-empty-state
            icon="lucideServer"
            title="Instance not found"
            body="It does not exist or has been deleted."
          >
            <a flButton size="sm" [routerLink]="['/infrastructure/compute']">Back to instances</a>
          </fl-empty-state>
        </fl-panel>
      }

      <app-instance-delete-dialog
        #deleteDialog
        [instance]="instance()"
        [isDeleting]="isDeleting()"
        (confirmed)="onDeleteConfirmed($event)"
      />
    </div>
  `,
})
export class InstanceDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly virtualInstancesService = inject(VirtualInstancesService);
  private readonly infrastructureServersService = inject(InfrastructureServersService);
  private readonly clusterService = inject(ClusterService);
  private readonly maskMode = inject(MaskModeService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new InstanceDetailSurfaceRevision();

  private provider: string | null = null;
  private providerId: string | null = null;

  deleteDialog = viewChild<InstanceDeleteDialogComponent>('deleteDialog');

  readonly surface = computed(() => {
    const input: InstanceDetailSurfaceInput = {
      instance: this.instance(),
      ownership: this.ownership(),
      clusterInfo: this.clusterInfo(),
    };
    const content = presentedContent(input);
    if (!content) return null;
    return buildInstanceDetailSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  /**
   * `instance` (real public IP) is fetched once on entry, so a mask-mode
   * toggle has to reload it or the page keeps rendering the value fetched
   * under the previous state. Skips its own first run.
   */
  constructor() {
    let first = true;
    effect(() => {
      this.maskMode.enabled();
      if (first) {
        first = false;
        return;
      }
      if (this.provider && this.providerId) {
        this.loadInstance(this.provider, this.providerId);
      }
    });

    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  instance = signal<InstanceWithLabels | null>(null);
  isLoading = signal(true);
  isDeleting = signal(false);
  deleteError = signal<string | null>(null);

  private readonly instanceClusterType = signal<ClusterType | null>(null);

  isManaged = computed(() => {
    const inst = this.instance();
    return inst ? isManagedByFlui(inst) : false;
  });

  ownership = computed(() => {
    const inst = this.instance();
    return inst ? getOwnership(inst) : 'unmanaged';
  });

  clusterInfo = computed(() => {
    const inst = this.instance();
    return inst ? getClusterInfo(inst) : null;
  });

  isObservabilityInstance = computed(() => {
    return isControlClusterType(this.instanceClusterType());
  });

  isWorkloadInstance = computed(() => {
    return this.instanceClusterType() === ClusterType.WORKLOAD;
  });

  isTerminalVisible = signal(false);
  useBootstrapKey = signal(false);
  canConnectSsh = computed(() => {
    const inst = this.instance();
    return inst?.status === 'running' && inst?.ipConfig?.v4?.ip && this.isManaged();
  });

  ngOnInit() {
    const provider = this.route.snapshot.paramMap.get('provider');
    const providerId = this.route.snapshot.paramMap.get('providerId');
    this.provider = provider;
    this.providerId = providerId;

    if (provider && providerId) {
      this.loadInstance(provider, providerId);
    } else {
      this.isLoading.set(false);
    }
  }

  loadInstance(provider: string, providerId: string) {
    this.isLoading.set(true);

    this.virtualInstancesService
      .instancesControllerFindAll(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      )
      .subscribe({
        next: async (response) => {
          const foundInstance = response.data?.find(
            (inst) => inst.provider === provider && inst.providerId === providerId,
          );
          this.instance.set(foundInstance || null);

          if (foundInstance) {
            const clusterInfo = getClusterInfo(foundInstance);
            if (clusterInfo?.clusterId) {
              await this.loadClusterType(clusterInfo.clusterId);
            }
          }

          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load instance:', error);
          this.instance.set(null);
          this.isLoading.set(false);
        },
      });
  }

  private async loadClusterType(clusterId: string): Promise<void> {
    try {
      await this.clusterService.selectCluster(clusterId);
      const cluster = this.clusterService.cluster();
      if (cluster) {
        this.instanceClusterType.set(cluster.clusterType || null);
      }
    } catch (error) {
      console.error('Failed to load cluster type:', error);
      this.instanceClusterType.set(null);
    }
  }

  protected readonly memory = formatMemory;
  protected readonly disk = formatDisk;

  openDeleteDialog() {
    this.deleteDialog()?.open();
  }

  onDeleteConfirmed(event: { instance: InstanceWithLabels; force: boolean }) {
    const { instance, force } = event;

    this.isDeleting.set(true);
    this.deleteError.set(null);

    this.infrastructureServersService
      .serversControllerDeleteServer(
        instance.providerId,
        instance.provider as 'contabo' | 'hetzner',
        force,
      )
      .subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.router.navigate(['/infrastructure/compute']);
        },
        error: (error) => {
          console.error('Failed to delete instance:', error);
          this.isDeleting.set(false);
          this.deleteError.set(error.message || 'Unknown error');
        },
      });
  }

  toggleTerminal(): void {
    this.isTerminalVisible.update((visible) => !visible);
  }

  toggleBootstrapKey(): void {
    this.useBootstrapKey.update((v) => !v);
    if (this.isTerminalVisible()) {
      this.isTerminalVisible.set(false);
    }
  }

  getServerIdForSsh(): string {
    return this.instance()?.providerId || this.instance()?.id || '';
  }

  getServerIpForSsh(): string {
    return this.instance()?.ipConfig?.v4?.ip || '';
  }

  readonly statusTone = computed(() => instanceStatusTone(this.instance()?.status));
  readonly statusLabel = computed(() => instanceStatusLabel(this.instance()?.status));

  protected readonly meta = computed(() => {
    const inst = this.instance();
    if (!inst) return '';
    return [inst.provider, inst.regionName || inst.region].filter(Boolean).join(' · ');
  });

  protected readonly breadcrumb = computed<Crumb[]>(() => {
    const inst = this.instance();
    return [
      { label: 'Compute', link: '/infrastructure/compute' },
      { label: inst ? inst.displayName || inst.name : 'Instance' },
    ];
  });

  protected readonly moreActions = computed<MenuAction[]>(() => [
    {
      id: 'delete',
      label: this.isDeleting() ? 'Deleting…' : 'Delete instance',
      danger: true,
      disabled: this.isDeleting() || this.isObservabilityInstance(),
    },
  ]);
}
