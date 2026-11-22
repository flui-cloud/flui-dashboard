import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRefreshCw, lucideServer } from '@ng-icons/lucide';

import { ClusterService } from '../../service/cluster.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { ClusterMonitoringService } from '../../service/cluster-monitoring.service';
import { ClusterStatus, ClusterType } from '../../model/cluster.models';
import { InstanceWithLabels, getClusterNodeId } from '../../model/instance.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlEmptyState, FlErrorState, FlLoadingState } from '../../../ui/patterns/states';
import { FlActionsMenu } from '../../../ui/overlays/actions-menu';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { RemoveWorkerDialogComponent } from './remove-worker-dialog.component';
import { ResizeNodeDialogComponent } from './resize-node-dialog.component';
import { ByosConnectNodeDialogComponent } from './byos-connect-node-dialog.component';
import { NodeRow, buildNodeRows, isMasterNode } from './cluster-nodes-rows';

@Component({
  selector: 'cluster-nodes-tab',
  imports: [
    RouterLink,
    FlPanel,
    FlTable,
    FlUsageBar,
    FlCopyId,
    FlEmptyState,
    FlErrorState,
    FlLoadingState,
    FlActionsMenu,
    FlButton,
    FlIcon,
    FlStatus,
    RemoveWorkerDialogComponent,
    ResizeNodeDialogComponent,
    ByosConnectNodeDialogComponent,
  ],
  providers: [provideIcons({ lucidePlus, lucideRefreshCw, lucideServer })],
  host: { class: 'fl-stack' },
  template: `
    @if (cluster(); as clusterData) {
      <fl-panel title="Nodes" [count]="clusterNodes().length" [flush]="true">
        <div panelActions class="fl-row">
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            title="Refresh"
            [disabled]="nodesIsLoading()"
            (click)="refreshNodes()"
          >
            <fl-icon name="lucideRefreshCw" [size]="14" />
          </button>
          @if (isByos()) {
            <button
              flButton="primary"
              size="sm"
              type="button"
              [disabled]="!canAddWorker()"
              [title]="addWorkerTooltip()"
              (click)="openAddWorker()"
            >
              <fl-icon name="lucidePlus" [size]="14" />
              Connect node
            </button>
          } @else {
            <a
              flButton
              size="sm"
              routerLink="../scaling"
              data-testid="nodes-change-on-scaling"
              title="Nodes change through the cluster's scaling group: + and − on the Scaling tab."
            >
              Change nodes on the Scaling tab
            </a>
          }
        </div>

        <p class="m-0 border-b border-fl-border px-4 py-3 text-fl-body-sm text-fl-ink-muted">
          {{ clusterNodes().length }} of {{ clusterData.nodeCount || 0 }}
          {{ (clusterData.nodeCount || 0) === 1 ? 'node' : 'nodes' }}
        </p>

        @if (nodesIsLoading() && clusterNodes().length === 0) {
          <fl-loading-state [rows]="4" />
        } @else if (nodesError() && clusterNodes().length === 0) {
          <fl-error-state
            title="Could not load nodes"
            [reason]="nodesError()"
            [compact]="true"
            (retry)="refreshNodes()"
          />
        } @else if (clusterNodes().length === 0) {
          <fl-empty-state
            icon="lucideServer"
            title="No nodes yet"
            body="This cluster does not have any nodes yet."
            [compact]="true"
          />
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">State</th>
                  <th scope="col">Size</th>
                  <th scope="col">CPU</th>
                  <th scope="col">Memory</th>
                  <th scope="col">IP address</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (row of nodeRows(); track row.node.id) {
                  <tr>
                    <td>
                      <span class="fl-mono block">{{ row.name }}</span>
                      @if (row.altName) {
                        <span class="fl-mono block text-fl-caption text-fl-ink-muted">{{
                          row.altName
                        }}</span>
                      }
                    </td>
                    <td class="text-fl-ink-muted">{{ row.role }}</td>
                    <td><fl-status [tone]="row.tone" [label]="row.stateLabel" /></td>
                    <td class="fl-mono">{{ row.size }}</td>
                    <td>
                      @if (row.cpu !== null) {
                        <fl-usage-bar
                          [percent]="row.cpu"
                          [label]="'CPU in use on ' + row.name"
                          [aside]="row.cpuAside"
                          [warnAt]="70"
                        />
                      } @else {
                        <span class="fl-num text-fl-ink-muted">{{ row.cpuAside || '—' }}</span>
                      }
                    </td>
                    <td>
                      @if (row.memory !== null) {
                        <fl-usage-bar
                          [percent]="row.memory"
                          [label]="'Memory in use on ' + row.name"
                          [aside]="row.memoryAside"
                          [warnAt]="75"
                        />
                      } @else {
                        <span class="fl-num text-fl-ink-muted">{{ row.memoryAside }}</span>
                      }
                    </td>
                    <td>
                      @if (row.ip) {
                        <fl-copy-id [value]="row.ip" label="IP address" />
                      } @else {
                        <span class="text-fl-ink-muted">—</span>
                      }
                    </td>
                    <td class="is-fit">
                      @if (row.menu.length) {
                        <fl-actions-menu
                          [compact]="true"
                          [label]="'Actions for ' + row.name"
                          [items]="row.menu"
                          [attr.data-testid]="canResize() ? 'node-resize' : null"
                          [attr.title]="row.menuTitle"
                          (action)="onAction(row, $event)"
                        />
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    }

    @if (showByosDialog() && cluster()?.id; as cid) {
      <app-byos-connect-node-dialog
        [clusterId]="cid"
        [masterIp]="cluster()?.masterIpAddress ?? undefined"
        (closed)="showByosDialog.set(false); refreshNodes()"
      />
    }

    @if (resizeTarget(); as target) {
      <app-resize-node-dialog
        [clusterId]="cluster()!.id!"
        [nodeId]="resolveNodeId(target)"
        [nodeName]="target.name || target.displayName || ''"
        [provider]="cluster()?.provider"
        (closed)="resizeTarget.set(null); refreshNodes()"
      />
    }

    @if (removeTarget(); as target) {
      <app-remove-worker-dialog
        [clusterId]="cluster()!.id!"
        [nodeId]="resolveNodeId(target)"
        [workerName]="target.displayName || target.name || target.id || ''"
        [isByos]="isByos()"
        (closed)="removeTarget.set(null)"
      />
    }
  `,
})
export class ClusterNodesTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly autoscaleService = inject(ClusterAutoscaleService);
  private readonly monitoring = inject(ClusterMonitoringService);
  private readonly router = inject(Router);

  cluster = this.clusterService.cluster;
  clusterNodes = this.clusterService.nodes;
  nodesIsLoading = this.clusterService.nodesIsLoading;
  nodesError = this.clusterService.nodesErrorMessage;

  protected showByosDialog = signal<boolean>(false);
  protected removeTarget = signal<InstanceWithLabels | null>(null);
  protected resizeTarget = signal<InstanceWithLabels | null>(null);
  protected canResize = computed(
    () => !this.isByos() && this.cluster()?.clusterType === ClusterType.WORKLOAD,
  );

  protected isByos = computed(() => this.clusterService.isByosCluster());

  protected nodeRows = computed<NodeRow[]>(() =>
    buildNodeRows(this.clusterNodes(), this.monitoring.servers(), {
      canResize: this.canResize(),
      isByos: this.isByos(),
      minNodes: this.cluster()?.minNodes,
    }),
  );

  protected workerCount = computed(
    () => this.clusterNodes().filter((n) => !isMasterNode(n)).length,
  );

  protected maxNodes = computed<number | null>(() => {
    const fromStatus = this.autoscaleService.status()?.maxNodes;
    if (fromStatus != null) return fromStatus;
    return this.cluster()?.maxNodes ?? null;
  });

  protected canAddWorker = computed(() => {
    const c = this.cluster();
    if (c?.status !== ClusterStatus.ACTIVE) return false;
    if (this.isByos()) return true;
    const max = this.maxNodes();
    if (max != null && this.workerCount() >= max) return false;
    return true;
  });

  protected addWorkerTooltip = computed(() => {
    const c = this.cluster();
    if (!c) return '';
    if (c.status !== ClusterStatus.ACTIVE) return `Cluster must be active (current: ${c.status}).`;
    if (this.isByos()) return 'Connect an existing Linux host as a worker (over SSH).';
    const max = this.maxNodes();
    if (max != null && this.workerCount() >= max) {
      return `maxNodes=${max} reached: raise the ceiling from the Scaling tab first.`;
    }
    return 'Add a new worker to this cluster.';
  });

  ngOnInit(): void {
    void (async () => {
      const cluster = this.cluster();
      if (cluster?.id && cluster.status === ClusterStatus.ACTIVE) {
        await this.clusterService.loadClusterNodes(cluster.id);
        void this.autoscaleService.getStatus(cluster.id).catch(() => undefined);
      }
    })();
  }

  async refreshNodes() {
    const cluster = this.cluster();
    if (cluster?.id) {
      try {
        await this.clusterService.loadClusterNodes(cluster.id);
      } catch (error) {
        console.error('Failed to refresh nodes:', error);
      }
    }
  }

  openAddWorker(): void {
    if (this.isByos()) this.showByosDialog.set(true);
  }

  openRemoveWorker(node: InstanceWithLabels): void {
    this.removeTarget.set(node);
  }

  protected onAction(row: NodeRow, action: string): void {
    if (action === 'resize') this.resizeTarget.set(row.node);
    else if (action === 'remove' && !row.removeDisabled) this.openRemoveWorker(row.node);
    else if (action === 'details') {
      void this.router.navigate([
        '/infrastructure/compute',
        row.node.provider,
        row.node.providerId,
      ]);
    }
  }

  resolveNodeId(node: InstanceWithLabels): string {
    return getClusterNodeId(node) ?? '';
  }
}
