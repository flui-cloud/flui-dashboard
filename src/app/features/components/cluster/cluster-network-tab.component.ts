import { Component, inject, signal, OnInit } from '@angular/core';

import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideNetwork, lucidePlus } from '@ng-icons/lucide';

import { ClusterService } from '../../service/cluster.service';
import { VNetService } from '../../service/vnet.service';
import { VNetInfo, VNetStatus } from '../../model/vnet.models';
import { AttachVNetDialogComponent } from './attach-vnet-dialog.component';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

const VNET_STATUS: Record<VNetStatus, { tone: StatusTone; label: string }> = {
  [VNetStatus.PENDING]: { tone: 'progress', label: 'Creating' },
  [VNetStatus.ACTIVE]: { tone: 'success', label: 'Active' },
  [VNetStatus.FAILED]: { tone: 'error', label: 'Failed' },
  [VNetStatus.DELETING]: { tone: 'progress', label: 'Deleting' },
  [VNetStatus.DELETED]: { tone: 'neutral', label: 'Deleted' },
};

@Component({
  selector: 'cluster-network-tab',
  imports: [
    AttachVNetDialogComponent,
    FlPanel,
    FlTable,
    FlKeyValue,
    FlKvItem,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlStatus,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucideExternalLink, lucideNetwork, lucidePlus })],
  host: { class: 'fl-stack' },
  template: `
    @if (isByos() && clusterVNet()) {
      <fl-alert tone="info" title="Registered, self-hosted">
        Flui does not provision this network. It is the private network your nodes already share:
        Flui registers its range, opens it in the host firewall for node-to-node traffic and checks
        that each node belongs to it.
      </fl-alert>
    }

    <fl-panel title="Private network">
      <ng-container panelActions>
        @if (!isByos()) {
          <button flButton size="sm" type="button" (click)="navigateToVNetManagement()">
            Manage networks
            <fl-icon name="lucideExternalLink" [size]="14" />
          </button>
        }
      </ng-container>

      @if (isLoading()) {
        <fl-loading-state [rows]="3" />
      } @else if (clusterVNet(); as vnet) {
        <fl-key-value>
          <fl-kv-item key="Name">{{ vnet.name }}</fl-kv-item>
          <fl-kv-item key="IP range" [mono]="true">{{ vnet.ipRange }}</fl-kv-item>
          <fl-kv-item key="Status">
            <fl-status [tone]="statusOf(vnet).tone" [label]="statusOf(vnet).label" />
          </fl-kv-item>
          <fl-kv-item key="Subnets">{{ vnet.subnets?.length ?? 0 }}</fl-kv-item>
        </fl-key-value>
      } @else if (isByos()) {
        <fl-empty-state
          icon="lucideNetwork"
          title="No private network registered"
          body="Flui registers the private network your nodes share, it does not provision it. Register it to open the host firewall for node-to-node traffic and allow scaling to more nodes."
        >
          <button
            flButton="primary"
            type="button"
            [disabled]="registering()"
            (click)="registerByosNetwork()"
          >
            @if (registering()) {
              <fl-spinner label="Registering" />
            } @else {
              <fl-icon name="lucidePlus" />
            }
            Register private network
          </button>
        </fl-empty-state>
        @if (registerError()) {
          <fl-alert tone="error" title="Could not register the network">
            {{ registerError() }}
          </fl-alert>
        }
      } @else {
        <fl-empty-state
          icon="lucideNetwork"
          title="No private network"
          [body]="
            canAttach()
              ? 'Attach a network to enable private networking and autoscaling.'
              : 'This cluster has no network configuration.'
          "
        >
          @if (canAttach()) {
            <button flButton="primary" type="button" (click)="openAttachVNet()">
              <fl-icon name="lucidePlus" />
              Attach network
            </button>
          }
        </fl-empty-state>
      }
    </fl-panel>

    @if (!isLoading() && clusterVNet()?.subnets?.length) {
      <fl-panel title="Subnets" [count]="clusterVNet()!.subnets.length" [flush]="true">
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">IP range</th>
                <th scope="col">Zone</th>
                <th scope="col">Gateway</th>
                <th scope="col" class="is-num">Servers attached</th>
              </tr>
            </thead>
            <tbody>
              @for (subnet of clusterVNet()!.subnets; track subnet.id) {
                <tr>
                  <td class="fl-mono">{{ subnet.ipRange }}</td>
                  <td>{{ subnet.networkZone || '—' }}</td>
                  <td class="fl-mono">{{ subnet.gateway || '—' }}</td>
                  <td class="is-num">{{ subnet.attachedServerIds.length }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </fl-panel>
    }

    @if (showAttachDialog() && clusterId(); as cid) {
      <app-attach-vnet-dialog
        [clusterId]="cid"
        [provider]="clusterProvider()"
        (closed)="showAttachDialog.set(false)"
        (attached)="onVNetAttached()"
      />
    }
  `,
})
export class ClusterNetworkTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly vnetService = inject(VNetService);
  private readonly router = inject(Router);

  clusterVNet = signal<VNetInfo | null>(null);
  isLoading = signal<boolean>(false);
  showAttachDialog = signal<boolean>(false);
  registering = signal<boolean>(false);
  registerError = signal<string | null>(null);

  clusterId = (): string | null => this.clusterService.cluster()?.id ?? null;
  clusterProvider = (): string => this.clusterService.cluster()?.provider ?? '';
  isByos = (): boolean => this.clusterService.isByosCluster();
  canAttach = (): boolean => !this.isByos() && !!this.clusterId() && !!this.clusterProvider();

  statusOf(vnet: VNetInfo): { tone: StatusTone; label: string } {
    return VNET_STATUS[vnet.status] ?? { tone: 'neutral', label: vnet.status ?? 'Unknown' };
  }

  async registerByosNetwork(): Promise<void> {
    const clusterId = this.clusterId();
    if (!clusterId) return;
    this.registering.set(true);
    this.registerError.set(null);
    try {
      await this.clusterService.ensureByosVNet(clusterId);
      await this.loadClusterVNet('byos', clusterId);
    } catch (e: any) {
      this.registerError.set(
        e?.error?.message || e?.message || 'Failed to register the private network',
      );
    } finally {
      this.registering.set(false);
    }
  }

  openAttachVNet(): void {
    this.showAttachDialog.set(true);
  }

  async onVNetAttached(): Promise<void> {
    this.showAttachDialog.set(false);
    const cluster = this.clusterService.cluster();
    if (cluster?.provider && cluster?.id) {
      await this.loadClusterVNet(cluster.provider, cluster.id);
    }
  }

  ngOnInit(): void {
    void (async () => {
      const cluster = this.clusterService.cluster();
      if (cluster?.provider && cluster?.id) {
        await this.loadClusterVNet(cluster.provider, cluster.id);
      }
    })();
  }

  async loadClusterVNet(provider: string, clusterId: string) {
    this.isLoading.set(true);
    try {
      await this.vnetService.loadVNets(provider, clusterId);
      const vnets = this.vnetService.vnets();
      this.clusterVNet.set(vnets.length > 0 ? vnets[0] : null);
    } catch (error) {
      console.error('Failed to load cluster VNet:', error);
      this.clusterVNet.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  navigateToVNetManagement() {
    this.router.navigate(['/infrastructure/vnet']);
  }
}
