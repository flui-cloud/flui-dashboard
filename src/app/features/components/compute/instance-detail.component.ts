import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, computed, inject, viewChild, effect, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideServer,
  lucideCpu,
  lucideMemoryStick,
  lucideHardDrive,
  lucideMapPin,
  lucideGlobe,
  lucideExternalLink,
  lucideLoader,
  lucideTrash2,
  lucideTerminal,
  lucideChevronDown,
  lucideChevronUp,
  lucideNetwork,
  lucideBox,
  lucideInfo,
  lucideKey,
  lucideCircleAlert,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { VirtualInstancesService, InfrastructureServersService } from '../../../core/api';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { InstanceWithLabels, isManagedByFlui, getOwnership, getClusterInfo } from '../../model/instance.models';
import { InstanceDeleteDialogComponent } from './instance-delete-dialog.component';
import { SshTerminalComponent } from './ssh-terminal.component';
import { ClusterService } from '../../service/cluster.service';
import { ClusterType, isControlClusterType } from '../../model/cluster.models';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  InstanceDetailSurfaceInput,
  InstanceDetailSurfaceRevision,
  buildInstanceDetailSurface,
  presentedContent,
} from './instance-detail-surface';

const STATUS_DOT = {
  ok: 'bg-green-500',
  warn: 'bg-amber-500',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/50',
} as const;

const STATUS_TEXT = {
  ok: 'text-green-700 dark:text-green-400',
  warn: 'text-amber-700 dark:text-amber-400',
  danger: 'text-destructive',
  muted: 'text-muted-foreground',
} as const;

const OWNERSHIP_LABEL: Record<string, string> = {
  self: 'Managed by Flui',
  'other-flui': 'Other installation',
  unmanaged: 'Unmanaged',
};

@Component({
  selector: 'app-instance-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgIcon,
    HlmButtonDirective,
    InstanceDeleteDialogComponent,
    SshTerminalComponent,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideServer,
      lucideCpu,
      lucideMemoryStick,
      lucideHardDrive,
      lucideMapPin,
      lucideGlobe,
      lucideExternalLink,
      lucideLoader,
      lucideTrash2,
      lucideTerminal,
      lucideChevronDown,
      lucideChevronUp,
      lucideNetwork,
      lucideBox,
      lucideInfo,
      lucideKey,
      lucideCircleAlert,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="p-6 space-y-4">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <button
          hlmBtn
          variant="outline"
          size="sm"
          [routerLink]="['/infrastructure/compute']"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4 mr-2" />
          Back to Instances
        </button>
      </div>

      @if (isLoading()) {
        <div class="flex items-center justify-center py-12">
          <div class="flex items-center gap-2 text-muted-foreground">
            <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin" />
            Loading instance details...
          </div>
        </div>
      } @else if (instance()) {
        <!-- Main Layout: Content + Sidebar -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- Main Content (2/3) -->
          <div class="lg:col-span-2 space-y-4">
            <div class="card-surface p-5">
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="icon-chip chip-brand">
                    <ng-icon name="lucideServer" class="h-5 w-5" />
                  </span>
                  <div class="min-w-0">
                    <h1 class="m-0 text-xl font-semibold text-foreground truncate">
                      {{ instance()!.displayName || instance()!.name }}
                    </h1>
                    @if (instance()!.displayName && instance()!.displayName !== instance()!.name) {
                      <p class="m-0 text-xs font-mono text-muted-foreground">{{ instance()!.name }}</p>
                    }
                  </div>
                </div>

                @if (isManaged()) {
                  <button
                    hlmBtn
                    variant="outline"
                    size="sm"
                    class="text-destructive hover:text-destructive"
                    (click)="openDeleteDialog()"
                    [disabled]="isDeleting() || isObservabilityInstance()"
                    [title]="isObservabilityInstance() ? 'Control instance can only be managed via CLI' : 'Delete instance'"
                  >
                    @if (isDeleting()) {
                      <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    } @else {
                      <ng-icon name="lucideTrash2" class="h-4 w-4 mr-2" />
                      Delete
                    }
                  </button>
                }
              </div>

              <div class="mt-4 flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 mr-1 text-xs font-medium" [class]="statusTextClass()">
                  <span class="h-1.5 w-1.5 rounded-full" [class]="statusDotClass()"></span>
                  {{ instance()!.status }}
                </span>
                <span class="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground" [attr.title]="ownershipHint()">
                  @if (ownership() !== 'self') {
                    <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  }
                  {{ ownershipLabel() }}
                </span>
                <span class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {{ instance()!.provider }}
                </span>
                <span class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <ng-icon name="lucideMapPin" class="h-3 w-3" />
                  {{ instance()!.regionName || instance()!.region }}
                </span>
                @if (instance()!.dataCenter) {
                  <span class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                    {{ instance()!.dataCenter }}
                  </span>
                }
              </div>
            </div>

            <section class="card-surface p-5">
              <h2 class="m-0 mb-4 text-label">Overview</h2>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div class="card-inner px-3 py-2.5">
                  <p class="m-0 flex items-center gap-1.5 text-label"><ng-icon name="lucideCpu" class="h-3.5 w-3.5" />CPU Cores</p>
                  <p class="m-0 mt-1 text-lg font-semibold text-foreground tabular-nums">{{ instance()!.cpuCores }}</p>
                </div>
                <div class="card-inner px-3 py-2.5">
                  <p class="m-0 flex items-center gap-1.5 text-label"><ng-icon name="lucideMemoryStick" class="h-3.5 w-3.5" />RAM</p>
                  <p class="m-0 mt-1 text-lg font-semibold text-foreground tabular-nums">{{ formatMemory(instance()!.ramMb) }}</p>
                </div>
                <div class="card-inner px-3 py-2.5">
                  <p class="m-0 flex items-center gap-1.5 text-label"><ng-icon name="lucideHardDrive" class="h-3.5 w-3.5" />Storage</p>
                  <p class="m-0 mt-1 text-lg font-semibold text-foreground tabular-nums">{{ formatDisk(instance()!.diskMb) }}</p>
                </div>
                @if (instance()!.ipConfig?.v4?.ip) {
                  <div class="card-inner px-3 py-2.5">
                    <p class="m-0 flex items-center gap-1.5 text-label"><ng-icon name="lucideGlobe" class="h-3.5 w-3.5" />IPv4 Address</p>
                    <p class="m-0 mt-1 text-sm font-mono font-semibold text-foreground">{{ instance()!.ipConfig?.v4?.ip }}</p>
                  </div>
                }
                @if (instance()!.ipConfig?.v6?.ip) {
                  <div class="card-inner px-3 py-2.5">
                    <p class="m-0 flex items-center gap-1.5 text-label"><ng-icon name="lucideGlobe" class="h-3.5 w-3.5" />IPv6 Address</p>
                    <p class="m-0 mt-1 text-xs font-mono font-semibold text-foreground break-all">{{ instance()!.ipConfig?.v6?.ip }}</p>
                  </div>
                }
                @if (instance()!.macAddress) {
                  <div class="card-inner px-3 py-2.5">
                    <p class="m-0 flex items-center gap-1.5 text-label"><ng-icon name="lucideNetwork" class="h-3.5 w-3.5" />MAC Address</p>
                    <p class="m-0 mt-1 text-sm font-mono font-semibold text-foreground">{{ instance()!.macAddress }}</p>
                  </div>
                }
              </div>
            </section>

            @if (isObservabilityInstance()) {
              <div class="card-surface px-4 py-3 flex items-start gap-3">
                <ng-icon name="lucideCircleAlert" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p class="m-0 text-sm font-medium text-foreground">Observability Instance</p>
                  <p class="m-0 mt-0.5 text-sm text-muted-foreground">
                    This instance is part of the control cluster and can only be managed via CLI.
                  </p>
                </div>
              </div>
            }

            @if (clusterInfo()) {
              <div class="card-surface px-4 py-3 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <ng-icon name="lucideBox" class="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div class="min-w-0">
                    <p class="m-0 text-sm text-foreground">
                      Part of <span class="font-semibold">{{ clusterInfo()!.clusterName }}</span> cluster
                    </p>
                    <p class="m-0 text-xs text-muted-foreground">{{ clusterInfo()!.nodeType }} node</p>
                  </div>
                </div>
                <a
                  [routerLink]="['/cluster', clusterInfo()!.clusterId]"
                  class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
                >
                  View cluster
                  <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                </a>
              </div>
            }

            <!-- SSH Terminal (Collapsible) -->
            @if (isManaged()) {
              <div class="card-surface">
                <div class="p-5">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <span class="icon-chip icon-chip-sm bg-muted text-muted-foreground">
                        <ng-icon name="lucideTerminal" class="h-4 w-4" />
                      </span>
                      <div>
                        <h2 class="m-0 text-sm font-semibold text-foreground">SSH Terminal</h2>
                        @if (!canConnectSsh()) {
                          <p class="text-xs text-muted-foreground">
                            {{ instance()?.status !== 'running' ? 'Instance must be running' : 'No IP address available' }}
                          </p>
                        } @else if (isTerminalVisible()) {
                          <p class="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400"><span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>Connected</p>
                        } @else {
                          <p class="text-xs text-muted-foreground">Ready to connect</p>
                        }
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      @if (isWorkloadInstance()) {
                        <!-- Bootstrap key toggle pill -->
                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            (click)="toggleBootstrapKey()"
                            class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors select-none"
                            [class]="useBootstrapKey()
                              ? 'border-amber-400/60 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'border-border bg-transparent text-muted-foreground hover:text-foreground hover:border-border/80'"
                          >
                            <ng-icon name="lucideKey" class="h-3 w-3" />
                            Bootstrap key
                          </button>
                          <!-- Info tooltip -->
                          <div class="relative group">
                            <button type="button" class="flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground hover:text-foreground transition-colors">
                              <ng-icon name="lucideInfo" class="h-3.5 w-3.5" />
                            </button>
                            <div class="absolute right-0 bottom-full mb-2 w-64 rounded-md border border-border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                              <p class="font-semibold mb-1">Bootstrap key authentication</p>
                              <p class="text-muted-foreground">Bypasses ephemeral certificates and uses the cluster bootstrap SSH key instead. Enable this as a fallback when the ephemeral certificate system is not working.</p>
                              <div class="absolute right-2 top-full border-4 border-transparent border-t-border" style="margin-top:-1px"></div>
                              <div class="absolute right-2 top-full border-4 border-transparent border-t-popover"></div>
                            </div>
                          </div>
                        </div>
                      }
                      <button
                        hlmBtn
                        [variant]="isTerminalVisible() ? 'secondary' : 'default'"
                        [disabled]="!canConnectSsh()"
                        size="sm"
                        (click)="toggleTerminal()"
                      >
                        @if (isTerminalVisible()) {
                          <ng-icon name="lucideChevronUp" class="h-4 w-4 mr-2" />
                          Collapse
                        } @else {
                          <ng-icon name="lucideChevronDown" class="h-4 w-4 mr-2" />
                          Expand
                        }
                      </button>
                    </div>
                  </div>
                </div>

                @if (isTerminalVisible() && canConnectSsh()) {
                  <div class="px-5 pb-5">
                    @if (useBootstrapKey()) {
                      <div class="flex items-center gap-1.5 mb-2 rounded-md border border-amber-400/40 bg-amber-500/8 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <ng-icon name="lucideKey" class="h-3.5 w-3.5 shrink-0" />
                        <span>Using bootstrap key — ephemeral certificates bypassed</span>
                      </div>
                    }
                    <div style="height: 500px">
                      <app-ssh-terminal
                        [serverId]="getServerIdForSsh()"
                        [serverIp]="getServerIpForSsh()"
                        [useBootstrapKey]="useBootstrapKey()"
                        [clusterId]="$safeNavigationMigration(clusterInfo()?.clusterId)"
                      />
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Sidebar (1/3) -->
          <div class="space-y-4">
            <section class="card-surface p-5">
              <h2 class="m-0 mb-4 text-label">Instance Details</h2>
              <div class="space-y-3">
                @if (instance()!.osType) {
                  <div>
                    <p class="m-0 text-label">Operating System</p>
                    <p class="m-0 mt-0.5 text-sm font-semibold text-foreground">{{ instance()!.osType }}</p>
                  </div>
                }
                @if (instance()!.productType) {
                  <div>
                    <p class="m-0 text-label">Product Type</p>
                    <p class="m-0 mt-0.5 text-sm font-semibold text-foreground">{{ instance()!.productType }}</p>
                  </div>
                }
                @if (instance()!.productName) {
                  <div>
                    <p class="m-0 text-label">Product Name</p>
                    <p class="m-0 mt-0.5 text-sm font-semibold text-foreground">{{ instance()!.productName }}</p>
                  </div>
                }
                @if (instance()!.defaultUser) {
                  <div>
                    <p class="m-0 text-label">Default User</p>
                    <p class="m-0 mt-0.5 text-sm font-mono font-semibold text-foreground">{{ instance()!.defaultUser }}</p>
                  </div>
                }
                <div class="border-t border-border pt-3 space-y-3">
                  <div>
                    <p class="m-0 text-label">Created</p>
                    <p class="m-0 mt-0.5 text-sm text-foreground">{{ instance()!.createdAt | date: 'short' }}</p>
                  </div>
                  <div>
                    <p class="m-0 text-label">Last Updated</p>
                    <p class="m-0 mt-0.5 text-sm text-foreground">{{ instance()!.updatedAt | date: 'short' }}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      } @else {
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <ng-icon name="lucideServer" class="h-12 w-12 text-muted-foreground mb-4" />
          <h3 class="text-lg font-medium text-foreground mb-2">Instance not found</h3>
          <p class="text-muted-foreground mb-4">
            The instance you're looking for doesn't exist or has been deleted.
          </p>
          <button hlmBtn [routerLink]="['/infrastructure/compute']">
            Go back to instances
          </button>
        </div>
      }

      <app-instance-delete-dialog
        #deleteDialog
        [instance]="instance()"
        [isDeleting]="isDeleting()"
        (confirmed)="onDeleteConfirmed($event)"
        (cancelled)="onDeleteCancelled()"
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

    // Publish this page's own Semantic Surface snapshot whenever it changes;
    // ngOnDestroy clears it so the snapshot never outlives this page — same
    // lifecycle as ApplicationDetailComponent's.
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

  // Cluster type tracking
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

  // SSH Terminal state
  isTerminalVisible = signal(false);
  useBootstrapKey = signal(false);
  canConnectSsh = computed(() => {
    const inst = this.instance();
    return inst?.status === 'running' &&
           inst?.ipConfig?.v4?.ip &&
           this.isManaged();
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

    // Fetch all instances and find the one matching provider and providerId
    this.virtualInstancesService
      .instancesControllerFindAll(
        undefined, // type
        undefined, // status
        undefined, // provider
        undefined, // region
        undefined, // dataCenter
        undefined, // search
        undefined, // clusterId
        undefined, // ownership
        true       // skipCache - always fetch fresh data from providers
      )
      .subscribe({
      next: async (response) => {
        const foundInstance = response.data?.find(
          (inst) => inst.provider === provider && inst.providerId === providerId
        );
        this.instance.set(foundInstance || null);

        // Load cluster type if instance belongs to a cluster
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

  /**
   * Load cluster type for the instance's cluster
   */
  private async loadClusterType(clusterId: string): Promise<void> {
    try {
      await this.clusterService.selectCluster(clusterId);
      const cluster = this.clusterService.cluster();
      if (cluster) {
        this.instanceClusterType.set(cluster.clusterType || null);
      }
    } catch (error) {
      console.error('Failed to load cluster type:', error);
      // Don't fail the instance load if cluster fetch fails
      this.instanceClusterType.set(null);
    }
  }

  formatMemory(mb: number): string {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(0)} GB`;
    }
    return `${mb} MB`;
  }

  formatDisk(mb: number): string {
    if (mb >= 1024 * 1024) {
      return `${(mb / (1024 * 1024)).toFixed(0)} TB`;
    } else if (mb >= 1024) {
      return `${(mb / 1024).toFixed(0)} GB`;
    }
    return `${mb} MB`;
  }

  openDeleteDialog() {
    this.deleteDialog()?.open();
  }

  onDeleteConfirmed(event: { instance: InstanceWithLabels; force: boolean }) {
    const { instance, force } = event;

    this.isDeleting.set(true);

    this.infrastructureServersService
      .serversControllerDeleteServer(
        instance.providerId,
        instance.provider as 'contabo' | 'hetzner',
        force
      )
      .subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.router.navigate(['/infrastructure/compute']);
        },
        error: (error) => {
          console.error('Failed to delete instance:', error);
          this.isDeleting.set(false);
          alert(`Failed to delete instance: ${error.message || 'Unknown error'}`);
        },
      });
  }

  onDeleteCancelled() {
    // Dialog chiuso, non fare nulla
  }

  /**
   * Toggle SSH terminal visibility
   */
  toggleTerminal(): void {
    this.isTerminalVisible.update(visible => !visible);
  }

  /**
   * Toggle bootstrap key auth mode (workload instances only).
   * Collapses terminal to force a fresh reconnect with new settings.
   */
  toggleBootstrapKey(): void {
    this.useBootstrapKey.update(v => !v);
    if (this.isTerminalVisible()) {
      this.isTerminalVisible.set(false);
    }
  }

  /**
   * Get server ID for SSH connection
   */
  getServerIdForSsh(): string {
    return this.instance()?.providerId || this.instance()?.id || '';
  }

  /**
   * Get server IP for SSH connection
   */
  getServerIpForSsh(): string {
    return this.instance()?.ipConfig?.v4?.ip || '';
  }

  private readonly statusTone = computed(() => {
    switch (this.instance()?.status?.toLowerCase()) {
      case 'running':
        return 'ok';
      case 'stopped':
        return 'warn';
      case 'error':
      case 'failed':
        return 'danger';
      default:
        return 'muted';
    }
  });

  readonly statusDotClass = computed(() => STATUS_DOT[this.statusTone()]);
  readonly statusTextClass = computed(() => STATUS_TEXT[this.statusTone()]);

  readonly ownershipLabel = computed(() => OWNERSHIP_LABEL[this.ownership()] ?? OWNERSHIP_LABEL['unmanaged']);
  readonly ownershipHint = computed(() =>
    this.ownership() === 'other-flui'
      ? 'Provisioned by another Flui installation sharing this cloud provider account'
      : null,
  );
}
