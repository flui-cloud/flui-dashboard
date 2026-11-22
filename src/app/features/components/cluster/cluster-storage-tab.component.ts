import { Component, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideHardDrive, lucideRefreshCw } from '@ng-icons/lucide';

import { ClusterService } from '../../service/cluster.service';
import { ClusterStorageService } from '../../service/cluster-storage.service';
import { ApplicationSnapshotsService } from '../../service/application-snapshots.service';
import { ClusterOrphanedVolumesComponent } from './cluster-orphaned-volumes.component';
import { ClusterReplicatedVolumesCardComponent } from './cluster-replicated-volumes-card.component';
import { ClusterNodeDisksCardComponent } from './cluster-node-disks-card.component';
import { StorageSnapshotsPanel } from './storage-snapshots-panel';
import { StorageClassesPanel } from './storage-classes-panel';
import { STORAGE_STATUS, StorageStatusView } from './storage-format';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'cluster-storage-tab',
  imports: [
    ClusterOrphanedVolumesComponent,
    ClusterReplicatedVolumesCardComponent,
    ClusterNodeDisksCardComponent,
    StorageSnapshotsPanel,
    StorageClassesPanel,
    FlPanel,
    FlTable,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlUsageBar,
    FlCopyId,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlStatus,
  ],
  providers: [provideIcons({ lucideHardDrive, lucideRefreshCw })],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Cluster storage">
      <button
        panelActions
        flButton
        size="sm"
        type="button"
        [disabled]="isLoading()"
        (click)="refresh()"
      >
        <fl-icon name="lucideRefreshCw" [size]="14" />
        Refresh
      </button>
      <div class="flex flex-col gap-4">
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          One disk on the master node, shared with every other node. This is where most of your
          apps' data lives.
        </p>

        @if (errorMessage() && !isLoading()) {
          <fl-alert tone="error" title="Could not load storage status">{{
            errorMessage()
          }}</fl-alert>
        }

        @if (isLoading() && !storage()) {
          <fl-loading-state [rows]="4" />
        }

        @if (storage(); as s) {
          <div class="fl-row">
            <fl-status [tone]="badge().tone" [label]="badge().label" />
            <span class="text-fl-body-sm">{{ summaryLine() }}</span>
          </div>
          @if (
            s.message && (s.status === 'DEGRADED' || s.status === 'ERROR' || s.status === 'UNKNOWN')
          ) {
            <p class="m-0 whitespace-pre-wrap fl-mono text-fl-ink-muted">{{ s.message }}</p>
          }

          @if (s.enabled) {
            <fl-key-value>
              @if (s.volume; as vol) {
                <fl-kv-item key="Provider">{{ vol.provider }}</fl-kv-item>
                <fl-kv-item key="Volume ID">
                  <fl-copy-id [value]="vol.volumeId" label="volume ID" />
                </fl-kv-item>
                <fl-kv-item key="Size">
                  {{ vol.sizeGb && vol.sizeGb > 0 ? vol.sizeGb + ' GB' : 'Unknown' }}
                </fl-kv-item>
                <fl-kv-item key="Mount path" [mono]="true">
                  {{ vol.mountPath || '/var/lib/flui/storage' }}
                </fl-kv-item>
                <fl-kv-item key="Filesystem label" [mono]="true">
                  {{ vol.fsLabel || 'flui-data' }}
                </fl-kv-item>
              }
              @if (s.status === 'READY' && s.pvcs; as pvcs) {
                <fl-kv-item key="Bound PVCs"
                  ><span class="fl-num">{{ pvcs.bound }}</span></fl-kv-item
                >
                <fl-kv-item key="Requested capacity">
                  <fl-usage-bar
                    [percent]="requestedPercent()"
                    label="Requested capacity"
                    [aside]="
                      pvcs.requestedGb +
                      ' GB' +
                      (s.volume?.sizeGb ? ' of ' + s.volume!.sizeGb + ' GB' : '')
                    "
                  />
                  <span class="mt-1 block text-fl-caption text-fl-ink-muted">
                    Requested capacity, not actual on-disk usage.
                  </span>
                </fl-kv-item>
              } @else if (s.status === 'PROVISIONING') {
                <fl-kv-item key="PVC usage">
                  <fl-status tone="progress" label="Preparing storage" />
                </fl-kv-item>
              } @else {
                <fl-kv-item key="PVC usage">
                  <span class="text-fl-ink-muted">Not available</span>
                </fl-kv-item>
              }
            </fl-key-value>
          } @else {
            <fl-empty-state
              icon="lucideHardDrive"
              [compact]="true"
              title="Shared storage is disabled"
              body="This cluster is using flui-local as the fallback. PVCs land on each node's bundled disk and are not portable across nodes."
            />
          }
        }
      </div>
    </fl-panel>

    @if (storage(); as s) {
      @if (s.enabled) {
        @if (s.status === 'READY' && namespaceBreakdown().length > 0) {
          <fl-panel
            title="Per-namespace breakdown"
            [count]="namespaceBreakdown().length"
            [flush]="true"
          >
            <div class="fl-table-wrap">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">Namespace</th>
                    <th scope="col" class="is-num">PVCs</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of namespaceBreakdown(); track row.namespace) {
                    <tr>
                      <td class="fl-mono">{{ row.namespace }}</td>
                      <td class="is-num">{{ row.count }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </fl-panel>
        }

        @if (s.nfs; as nfs) {
          <fl-panel title="NFS configuration">
            <button
              panelActions
              flButton="ghost"
              size="sm"
              type="button"
              [attr.aria-expanded]="nfsOpen()"
              (click)="toggleNfs()"
            >
              {{ nfsOpen() ? 'Hide' : 'Show' }}
            </button>
            <div class="flex flex-col gap-4">
              @if (nfs.confirmsBeforeDisk) {
                <fl-alert tone="warning" title="Durability">{{ nfs.durability }}</fl-alert>
              }
              @if (nfsOpen()) {
                <fl-key-value>
                  <fl-kv-item key="Export path" [mono]="true">{{ nfs.exportPath }}</fl-kv-item>
                  <fl-kv-item key="Export options (master)" [mono]="true">{{
                    nfs.exportOptions
                  }}</fl-kv-item>
                  <fl-kv-item key="Mount options (workers)" [mono]="true">{{
                    nfs.mountOptions
                  }}</fl-kv-item>
                </fl-key-value>
              } @else if (!nfs.confirmsBeforeDisk) {
                <p class="m-0 text-fl-body-sm text-fl-ink-muted">
                  How the master exports the disk and how the workers mount it.
                </p>
              }
            </div>
          </fl-panel>
        }

        <app-storage-snapshots-panel
          [snapshots]="snapshots()"
          [loading]="snapshotsLoading()"
          [open]="snapshotsOpen()"
          (toggled)="toggleSnapshots()"
        />
      }

      <app-cluster-replicated-volumes-card [clusterId]="clusterId()" />

      <app-cluster-node-disks-card [clusterId]="clusterId()" />

      <app-storage-classes-panel />
    }

    <cluster-orphaned-volumes [clusterId]="clusterId()" />
  `,
})
export class ClusterStorageTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly storageService = inject(ClusterStorageService);
  private readonly snapshotsService = inject(ApplicationSnapshotsService);

  readonly storage = this.storageService.storage;
  readonly isLoading = this.storageService.loading;
  readonly errorMessage = this.storageService.error;
  readonly requestedPercent = this.storageService.requestedPercent;
  readonly namespaceBreakdown = this.storageService.namespaceBreakdown;

  readonly snapshots = this.snapshotsService.snapshots;
  readonly snapshotsLoading = this.snapshotsService.loading;

  readonly clusterId = computed(() => this.clusterService.cluster()?.id ?? null);
  private readonly orphanedVolumes = viewChild(ClusterOrphanedVolumesComponent);

  readonly nfsOpen = signal(false);
  readonly snapshotsOpen = signal(false);
  readonly badge = computed<StorageStatusView>(() => {
    const status = this.storage()?.status;
    return status ? STORAGE_STATUS[status] : STORAGE_STATUS.UNKNOWN;
  });

  readonly summaryLine = computed(() => this.badge().summary);

  constructor() {
    effect(() => {
      if (!this.snapshotsOpen()) return;
      const id = this.clusterService.cluster()?.id;
      if (id && this.snapshots().length === 0 && !this.snapshotsLoading()) {
        void this.snapshotsService.loadForCluster(id);
      }
    });
  }

  ngOnInit(): void {
    void (async () => {
      const id = this.clusterService.cluster()?.id;
      if (id) {
        await this.storageService.load(id);
      }
    })();
  }

  async refresh(): Promise<void> {
    const id = this.clusterService.cluster()?.id;
    if (!id) return;
    await this.storageService.load(id, true);
    await this.orphanedVolumes()?.reload();
    if (this.snapshotsOpen()) {
      await this.snapshotsService.loadForCluster(id);
    }
  }

  toggleNfs(): void {
    this.nfsOpen.update((open) => !open);
  }

  toggleSnapshots(): void {
    this.snapshotsOpen.update((open) => !open);
  }
}
