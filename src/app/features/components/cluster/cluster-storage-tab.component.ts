import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideChevronDown,
  lucideChevronRight,
  lucideCircleAlert,
  lucideCopy,
  lucideDatabase,
  lucideExternalLink,
  lucideHardDrive,
  lucideLoader,
  lucideRefreshCw,
  lucideShare2,
} from '@ng-icons/lucide';

import { ClusterService } from '../../service/cluster.service';
import { ClusterStorageService } from '../../service/cluster-storage.service';
import { ApplicationSnapshotsService } from '../../service/application-snapshots.service';
import { ClusterStorageStatusDto } from '../../../core/api/model/clusterStorageStatusDto';
import {
  ApplicationSnapshot,
  SnapshotStatus,
  STORAGE_CLASSES,
  getSnapshotKind,
  snapshotSizeLabel,
  snapshotStatus,
} from '../../model/volume-management.models';

type StatusEnum = ClusterStorageStatusDto.StatusEnum;

interface StatusBadgeConfig {
  label: string;
  classes: string;
  summary: string;
}

const STATUS_CONFIG: Record<StatusEnum, StatusBadgeConfig> = {
  READY: {
    label: 'Ready',
    classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    summary: 'Shared storage is healthy and serving PVCs.',
  },
  DEGRADED: {
    label: 'Degraded',
    classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    summary: 'Configuration is in place, but live PVC status could not be fetched.',
  },
  PROVISIONING: {
    label: 'Provisioning',
    classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    summary: 'Cluster is still being created. Storage is not observable yet.',
  },
  DISABLED: {
    label: 'Disabled',
    classes: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    summary: 'Shared storage is disabled — cluster is using flui-local fallback.',
  },
  ERROR: {
    label: 'Error',
    classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    summary: 'Shared storage is in an error state.',
  },
  UNKNOWN: {
    label: 'Unknown',
    classes: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    summary: 'Storage status could not be determined.',
  },
};

@Component({
  selector: 'cluster-storage-tab',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideHardDrive,
      lucideShare2,
      lucideDatabase,
      lucideRefreshCw,
      lucideCopy,
      lucideCheck,
      lucideChevronDown,
      lucideChevronRight,
      lucideCircleAlert,
      lucideExternalLink,
      lucideLoader,
    }),
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <ng-icon name="lucideHardDrive" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Cluster storage
          </h2>
          <p class="text-sm text-muted-foreground mt-0.5">
            One disk on the master node, shared with every other node. This is where most of your apps' data lives.
          </p>
        </div>
        <button
          (click)="refresh()"
          [disabled]="isLoading()"
          class="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
        >
          <ng-icon
            name="lucideRefreshCw"
            class="h-3.5 w-3.5"
            [class.animate-spin]="isLoading()"
          />
          Refresh
        </button>
      </div>

      <!-- Loading -->
      @if (isLoading() && !storage()) {
        <div class="animate-pulse space-y-4">
          <div class="skeleton h-20 rounded-lg"></div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="skeleton h-32 rounded-lg"></div>
            <div class="skeleton h-32 rounded-lg"></div>
          </div>
        </div>
      }

      <!-- Error (transport-level) -->
      @if (errorMessage() && !isLoading()) {
        <div class="card-surface p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
          <div class="flex items-start gap-3">
            <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <p class="text-sm font-medium text-red-900 dark:text-red-200">Failed to load storage status</p>
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ errorMessage() }}</p>
            </div>
          </div>
        </div>
      }

      @if (storage(); as s) {
        <!-- Status banner -->
        <div class="card-surface p-4">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <span
                class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                [class]="badge().classes"
              >
                {{ badge().label }}
              </span>
              <p class="text-sm text-foreground">{{ summaryLine() }}</p>
            </div>
          </div>
          @if (s.message && (s.status === 'DEGRADED' || s.status === 'ERROR' || s.status === 'UNKNOWN')) {
            <p class="text-xs text-muted-foreground mt-3 font-mono whitespace-pre-wrap">{{ s.message }}</p>
          }
        </div>

        @if (s.enabled) {
          <!-- Volume + NFS cards -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @if (s.volume; as vol) {
              <div class="card-inner p-4">
                <div class="flex items-center gap-2 mb-3">
                  <ng-icon name="lucideHardDrive" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span class="text-label">Backing volume</span>
                  <span class="ml-auto text-xs uppercase tracking-wide text-muted-foreground">
                    {{ vol.provider }}
                  </span>
                </div>
                <dl class="space-y-2 text-sm">
                  <div class="flex items-center justify-between gap-3">
                    <dt class="text-muted-foreground">Volume ID</dt>
                    <dd class="flex items-center gap-2 font-mono text-xs">
                      <span class="truncate max-w-[180px]" [title]="vol.volumeId">{{ vol.volumeId }}</span>
                      <button
                        (click)="copy(vol.volumeId, 'volumeId')"
                        class="p-1 hover:bg-muted rounded"
                        title="Copy"
                      >
                        <ng-icon
                          [name]="copied() === 'volumeId' ? 'lucideCheck' : 'lucideCopy'"
                          class="h-3 w-3"
                        />
                      </button>
                    </dd>
                  </div>
                  <div class="flex items-center justify-between">
                    <dt class="text-muted-foreground">Size</dt>
                    <dd class="font-medium">
                      {{ vol.sizeGb && vol.sizeGb > 0 ? vol.sizeGb + ' GB' : 'Unknown' }}
                    </dd>
                  </div>
                  <div class="flex items-center justify-between">
                    <dt class="text-muted-foreground">Mount path</dt>
                    <dd class="font-mono text-xs">{{ vol.mountPath || '/var/lib/flui/storage' }}</dd>
                  </div>
                  <div class="flex items-center justify-between">
                    <dt class="text-muted-foreground">Filesystem label</dt>
                    <dd class="font-mono text-xs">{{ vol.fsLabel || 'flui-data' }}</dd>
                  </div>
                </dl>
              </div>
            }

            <!-- PVC summary card -->
            <div class="card-inner p-4">
              <div class="flex items-center gap-2 mb-3">
                <ng-icon name="lucideDatabase" class="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span class="text-label">PVC usage</span>
              </div>

              @if (s.status === 'READY' && s.pvcs; as pvcs) {
                <div class="space-y-3 text-sm">
                  <div class="flex items-baseline justify-between">
                    <span class="text-3xl font-bold">{{ pvcs.bound }}</span>
                    <span class="text-xs text-muted-foreground">bound PVCs</span>
                  </div>
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-muted-foreground text-xs">
                        Requested {{ pvcs.requestedGb }} GB{{ s.volume?.sizeGb ? ' of ' + s.volume!.sizeGb + ' GB' : '' }}
                      </span>
                      <span class="text-xs font-medium">{{ requestedPercent().toFixed(0) }}%</span>
                    </div>
                    <div class="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        class="h-full bg-blue-500 transition-all"
                        [style.width.%]="requestedPercent()"
                      ></div>
                    </div>
                    <p class="text-[11px] text-muted-foreground mt-1">
                      Requested capacity, not actual on-disk usage.
                    </p>
                  </div>
                </div>
              } @else if (s.status === 'PROVISIONING') {
                <div class="flex items-center gap-2 text-sm text-muted-foreground py-3">
                  <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                  Preparing storage…
                </div>
              } @else {
                <p class="text-sm text-muted-foreground">PVC summary not available.</p>
              }
            </div>
          </div>

          <!-- Per-namespace breakdown -->
          @if (s.status === 'READY' && namespaceBreakdown().length > 0) {
            <div class="card-inner p-4">
              <span class="text-label">Per-namespace breakdown</span>
              <table class="w-full mt-3 text-sm">
                <thead>
                  <tr class="text-left text-muted-foreground border-b border-border">
                    <th class="py-2 font-normal">Namespace</th>
                    <th class="py-2 font-normal text-right">PVCs</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of namespaceBreakdown(); track row.namespace) {
                    <tr class="border-b border-border/50 last:border-0">
                      <td class="py-2 font-mono text-xs">{{ row.namespace }}</td>
                      <td class="py-2 text-right font-medium">{{ row.count }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <!-- NFS export disclosure -->
          @if (s.nfs; as nfs) {
            <div class="card-inner">
              <button
                type="button"
                (click)="toggleNfs()"
                class="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <span class="flex items-center gap-2">
                  <ng-icon name="lucideShare2" class="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span class="text-label">NFS configuration</span>
                </span>
                <ng-icon
                  [name]="nfsOpen() ? 'lucideChevronDown' : 'lucideChevronRight'"
                  class="h-4 w-4 text-muted-foreground"
                />
              </button>
              @if (nfsOpen()) {
                <dl class="px-4 pb-4 space-y-2 text-sm">
                  <div>
                    <dt class="text-muted-foreground text-xs">Export path</dt>
                    <dd class="font-mono text-xs mt-0.5">{{ nfs.exportPath }}</dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground text-xs">Export options (master)</dt>
                    <dd class="font-mono text-xs mt-0.5 break-all">{{ nfs.exportOptions }}</dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground text-xs">Mount options (workers)</dt>
                    <dd class="font-mono text-xs mt-0.5 break-all">{{ nfs.mountOptions }}</dd>
                  </div>
                </dl>
              }
            </div>
          }

          <!-- Cluster-wide snapshots -->
          <div class="card-inner">
            <button
              type="button"
              (click)="toggleSnapshots()"
              class="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <span class="flex items-center gap-2">
                <ng-icon name="lucideDatabase" class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span class="text-label">Application snapshots in this cluster</span>
                <span class="text-xs text-muted-foreground">({{ snapshots().length }})</span>
              </span>
              <ng-icon
                [name]="snapshotsOpen() ? 'lucideChevronDown' : 'lucideChevronRight'"
                class="h-4 w-4 text-muted-foreground"
              />
            </button>
            @if (snapshotsOpen()) {
              <div class="px-4 pb-4">
                @if (snapshotsLoading() && snapshots().length === 0) {
                  <div class="flex items-center gap-2 text-sm text-muted-foreground py-3">
                    <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                    Loading snapshots…
                  </div>
                } @else if (snapshots().length === 0) {
                  <p class="text-sm text-muted-foreground py-3">
                    No application snapshots yet. Create one from any application's Snapshots tab.
                  </p>
                } @else {
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-left text-muted-foreground border-b border-border">
                        <th class="py-2 font-normal">App</th>
                        <th class="py-2 font-normal">PVC</th>
                        <th class="py-2 font-normal">Type</th>
                        <th class="py-2 font-normal">Status</th>
                        <th class="py-2 font-normal text-right">Size</th>
                        <th class="py-2 font-normal">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (snap of snapshots(); track snap.exportId) {
                        <tr class="border-b border-border/50 last:border-0">
                          <td class="py-2">
                            <a [routerLink]="['/apps/applications', snap.appId]" class="text-blue-600 dark:text-blue-400 hover:underline">
                              {{ snap.appId }}
                            </a>
                          </td>
                          <td class="py-2 font-mono text-xs">{{ snap.sourcePvcName || '—' }}</td>
                          <td class="py-2">
                            <span class="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground">
                              {{ kindOf(snap) }}
                            </span>
                          </td>
                          <td class="py-2">
                            <span class="text-xs" [class]="snapshotStatusClass(snapshotStatusOf(snap))">{{ snapshotLabel(snap) }}</span>
                          </td>
                          <td class="py-2 text-right">{{ snapshotSize(snap) }}</td>
                          <td class="py-2 text-xs text-muted-foreground">
                            {{ formatDate(snap.createdAt) }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            }
          </div>
        } @else {
          <!-- Disabled empty state -->
          <div class="card-inner p-8 text-center">
            <ng-icon name="lucideHardDrive" class="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p class="text-sm font-medium">Shared storage is disabled</p>
            <p class="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              This cluster is using <span class="font-mono">flui-local</span> as the fallback.
              PVCs land on each node's bundled disk and are not portable across nodes.
            </p>
          </div>
        }

        <!-- Storage classes overview -->
        <div class="card-inner p-4">
          <span class="text-label">Where your apps store data</span>
          <p class="text-xs text-muted-foreground mt-1">
            Flui picks the right one automatically based on the app. You almost never need to choose by hand.
          </p>
          <div class="mt-3 space-y-2">
            @for (sc of storageClasses; track sc.name) {
              <div class="flex items-start justify-between gap-4 p-3 rounded-md border border-border">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium">{{ sc.label }}</span>
                    <span class="font-mono text-[11px] text-muted-foreground">{{ sc.name }}</span>
                    <span class="text-[11px] px-2 py-0.5 rounded-full" [class]="stateClass(sc.state)">
                      {{ stateLabel(sc.state) }}
                    </span>
                  </div>
                  <p class="text-xs text-muted-foreground mt-1">{{ sc.description }}</p>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ClusterStorageTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly storageService = inject(ClusterStorageService);
  private readonly snapshotsService = inject(ApplicationSnapshotsService);

  readonly storageClasses = STORAGE_CLASSES;

  readonly storage = this.storageService.storage;
  readonly isLoading = this.storageService.loading;
  readonly errorMessage = this.storageService.error;
  readonly requestedPercent = this.storageService.requestedPercent;
  readonly namespaceBreakdown = this.storageService.namespaceBreakdown;

  readonly snapshots = this.snapshotsService.snapshots;
  readonly snapshotsLoading = this.snapshotsService.loading;

  readonly nfsOpen = signal(false);
  readonly snapshotsOpen = signal(false);
  readonly copied = signal<string | null>(null);

  readonly badge = computed<StatusBadgeConfig>(() => {
    const status = this.storage()?.status;
    return status ? STATUS_CONFIG[status] : STATUS_CONFIG.UNKNOWN;
  });

  readonly summaryLine = computed(() => this.badge().summary);

  constructor() {
    // Load cluster-wide snapshots when the snapshots panel is first opened.
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

  copy(value: string, key: string): void {
    void navigator.clipboard.writeText(value).then(() => {
      this.copied.set(key);
      setTimeout(() => {
        if (this.copied() === key) this.copied.set(null);
      }, 1500);
    });
  }

  kindOf(snap: ApplicationSnapshot): string {
    return getSnapshotKind(snap);
  }

  snapshotStatusOf(snap: ApplicationSnapshot): SnapshotStatus {
    return snapshotStatus(snap);
  }

  snapshotLabel(snap: ApplicationSnapshot): string {
    const st = snapshotStatus(snap);
    if (st === 'PENDING') return 'Copying…';
    if (st === 'DELETING') return 'Deleting…';
    if (st === 'READY') return 'Ready';
    return st;
  }

  snapshotSize(snap: ApplicationSnapshot): string {
    const { headline, subline } = snapshotSizeLabel(snap);
    return subline ? `${headline} (${subline})` : headline;
  }

  snapshotStatusClass(status: SnapshotStatus): string {
    switch (status) {
      case 'READY':
        return 'text-green-600 dark:text-green-400 font-medium';
      case 'PENDING':
        return 'text-blue-600 dark:text-blue-400';
      case 'FAILED':
        return 'text-red-600 dark:text-red-400 font-medium';
      case 'DELETING':
        return 'text-amber-600 dark:text-amber-400';
      default:
        return 'text-muted-foreground';
    }
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  }

  stateClass(state: 'active' | 'fallback'): string {
    switch (state) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'fallback':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  }

  stateLabel(state: 'active' | 'fallback'): string {
    switch (state) {
      case 'active':
        return 'Active';
      case 'fallback':
        return 'Fallback';
    }
  }
}
