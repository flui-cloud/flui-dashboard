import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideServer,
  lucideRefreshCw,
  lucideLoader,
  lucideCircleAlert,
  lucidePlus,
  lucideTrash,
} from '@ng-icons/lucide';

import { ClusterService } from '../../service/cluster.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { ClusterStatus } from '../../model/cluster.models';
import { InstanceWithLabels, getClusterInfo, getClusterNodeId } from '../../model/instance.models';
import { InstanceRowComponent } from '../compute/instance-row.component';
import { AddWorkerDialogComponent } from './add-worker-dialog.component';
import { RemoveWorkerDialogComponent } from './remove-worker-dialog.component';
import { ByosConnectNodeDialogComponent } from './byos-connect-node-dialog.component';

interface NodeRowMeta {
  node: InstanceWithLabels;
  isMaster: boolean;
  isBusy: boolean;
  removeDisabled: boolean;
  removeReason: string | null;
}

@Component({
  selector: 'cluster-nodes-tab',
  standalone: true,
  imports: [
    CommonModule,
    NgIconComponent,
    InstanceRowComponent,
    AddWorkerDialogComponent,
    RemoveWorkerDialogComponent,
    ByosConnectNodeDialogComponent,
  ],
  providers: [
    provideIcons({
      lucideServer,
      lucideRefreshCw,
      lucideLoader,
      lucideCircleAlert,
      lucidePlus,
      lucideTrash,
    }),
  ],
  template: `
    @if (cluster(); as clusterData) {
      <div class="card-surface p-6">
        <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div class="flex items-center gap-3">
            <span class="text-sm text-sub">
              {{ clusterNodes().length }} of {{ clusterData.nodeCount || 0 }} node(s)
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              (click)="refreshNodes()"
              [disabled]="nodesIsLoading()"
              title="Refresh"
              class="inline-flex items-center p-1.5 border border-border rounded-md text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="nodesIsLoading()" />
            </button>
            <button
              type="button"
              (click)="openAddWorker()"
              [disabled]="!canAddWorker()"
              [title]="addWorkerTooltip()"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
              {{ isByos() ? 'Connect node' : 'Add worker' }}
            </button>
          </div>
        </div>

        @if (nodesIsLoading() && clusterNodes().length === 0) {
          <div class="animate-pulse flex flex-col gap-2">
            @for (i of [1,2,3,4]; track i) {
              <div class="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div class="h-8 w-8 rounded-full skeleton flex-shrink-0"></div>
                <div class="flex-1 space-y-1.5">
                  <div class="skeleton h-4 w-48"></div>
                  <div class="skeleton h-3 w-32"></div>
                </div>
                <div class="skeleton h-5 w-16"></div>
              </div>
            }
          </div>
        }

        @if (nodesError() && !nodesIsLoading() && clusterNodes().length === 0) {
          <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div class="flex items-center gap-3">
              <ng-icon name="lucideCircleAlert" class="h-5 w-5 status-error" />
              <div class="flex-1">
                <p class="text-sm font-medium text-red-900 dark:text-red-200">Failed to load nodes</p>
                <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ nodesError() }}</p>
              </div>
            </div>
          </div>
        }

        @if (!nodesIsLoading() && clusterNodes().length === 0 && !nodesError()) {
          <div class="text-center py-12">
            <ng-icon name="lucideServer" class="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p class="text-sm font-semibold text-foreground">No nodes found</p>
            <p class="text-sm text-sub mt-1">
              This cluster doesn't have any nodes yet.
            </p>
          </div>
        }

        @if (clusterNodes().length > 0) {
          <div class="flex flex-col gap-2">
            @for (row of nodeRows(); track row.node.id) {
              <div class="space-y-1">
                <app-instance-row [instance]="row.node" />
                @if (!row.isMaster) {
                  <div class="flex justify-end px-2">
                    <button
                      type="button"
                      (click)="openRemoveWorker(row.node)"
                      [disabled]="row.removeDisabled"
                      [title]="row.removeReason ?? 'Remove this worker from the cluster'"
                      class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:hover:border-border text-muted-foreground"
                    >
                      <ng-icon name="lucideTrash" class="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    }

    @if (showAddDialog() && cluster()?.id; as cid) {
      <app-add-worker-dialog
        [clusterId]="cid"
        [currentNodes]="currentNodesForDialog()"
        [maxNodes]="maxNodes()"
        (closed)="showAddDialog.set(false)"
      />
    }

    @if (showByosDialog() && cluster()?.id; as cid) {
      <app-byos-connect-node-dialog
        [clusterId]="cid"
        [masterIp]="cluster()?.masterIpAddress"
        (closed)="showByosDialog.set(false); refreshNodes()"
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

  cluster = this.clusterService.cluster;
  clusterNodes = this.clusterService.nodes;
  nodesIsLoading = this.clusterService.nodesIsLoading;
  nodesError = this.clusterService.nodesErrorMessage;

  protected showAddDialog = signal<boolean>(false);
  protected showByosDialog = signal<boolean>(false);
  protected removeTarget = signal<InstanceWithLabels | null>(null);

  protected isByos = computed(() => this.clusterService.isByosCluster());

  protected nodeRows = computed<NodeRowMeta[]>(() => {
    const nodes = this.clusterNodes();
    const workerNodes = nodes.filter(n => !this.isMasterNode(n));
    const minNodes = this.cluster()?.minNodes;
    const atMin = minNodes != null && workerNodes.length <= minNodes;

    return nodes.map(node => {
      const isMaster = this.isMasterNode(node);
      const status = (node.status || '').toString().toLowerCase();
      const isBusy = status === 'deleting' || status === 'error';
      let removeDisabled = isMaster || isBusy;
      let removeReason: string | null = null;
      if (isMaster) removeReason = 'The master node cannot be removed from this view.';
      else if (isBusy) removeReason = `Worker is in '${status}' state.`;
      else if (atMin) {
        removeDisabled = true;
        removeReason = `Removing this worker would violate minNodes=${minNodes}.`;
      }
      return { node, isMaster, isBusy, removeDisabled, removeReason };
    });
  });

  protected workerCount = computed(() =>
    this.clusterNodes().filter(n => !this.isMasterNode(n)).length
  );

  protected currentNodesForDialog = computed(() => {
    const fromStatus = this.autoscaleService.status()?.currentNodes;
    if (fromStatus != null) return fromStatus;
    return this.cluster()?.nodeCount ?? this.clusterNodes().length;
  });

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
      return `maxNodes=${max} reached: raise the limit from the Autoscaling tab first.`;
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
    if (this.isByos()) {
      this.showByosDialog.set(true);
      return;
    }
    if (this.canAddWorker()) this.showAddDialog.set(true);
  }

  openRemoveWorker(node: InstanceWithLabels): void {
    this.removeTarget.set(node);
  }

  resolveNodeId(node: InstanceWithLabels): string {
    return getClusterNodeId(node) ?? '';
  }

  private isMasterNode(node: InstanceWithLabels): boolean {
    const info = getClusterInfo(node);
    return info?.nodeType === 'master';
  }
}
