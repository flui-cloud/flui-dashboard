import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed, inject, viewChild } from '@angular/core';
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
  lucideCalendar,
  lucideActivity,
  lucideExternalLink,
  lucideLoader,
  lucideTrash2,
  lucideTerminal,
  lucideChevronDown,
  lucideChevronUp,
  lucideNetwork,
  lucideDatabase,
  lucideClock,
  lucideBox,
  lucideInfo,
  lucideKey,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import {
  HlmCardContentDirective,
  HlmCardDirective,
  HlmCardHeaderDirective,
  HlmCardTitleDirective,
} from '@spartan-ng/ui-card-helm';
import { VirtualInstancesService, InfrastructureServersService } from '../../../core/api';
import { InstanceWithLabels, isManagedByFlui, getClusterInfo } from '../../model/instance.models';
import { InstanceManagedBadgeComponent } from './instance-managed-badge.component';
import { InstanceDeleteDialogComponent } from './instance-delete-dialog.component';
import { SshTerminalComponent } from './ssh-terminal.component';
import { ClusterService } from '../../service/cluster.service';
import { ClusterType } from '../../model/cluster.models';

@Component({
  selector: 'app-instance-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgIcon,
    HlmButtonDirective,
    HlmCardDirective,
    HlmCardHeaderDirective,
    HlmCardTitleDirective,
    HlmCardContentDirective,
    InstanceManagedBadgeComponent,
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
      lucideCalendar,
      lucideActivity,
      lucideExternalLink,
      lucideLoader,
      lucideTrash2,
      lucideTerminal,
      lucideChevronDown,
      lucideChevronUp,
      lucideNetwork,
      lucideDatabase,
      lucideClock,
      lucideBox,
      lucideInfo,
      lucideKey,
    }),
  ],
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
            <!-- Instance Header Card - Compact with Status Border -->
            <div hlmCard [class]="getStatusBorderClass()">
              <div hlmCardHeader class="pb-3">
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                      <ng-icon name="lucideServer" class="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h1 class="text-xl font-bold">
                        {{ instance()!.displayName || instance()!.name }}
                      </h1>
                      @if (instance()!.displayName && instance()!.displayName !== instance()!.name) {
                        <p class="text-xs font-mono text-muted-foreground">{{ instance()!.name }}</p>
                      }
                    </div>
                  </div>

                  @if (isManaged()) {
                    <button
                      hlmBtn
                      variant="destructive"
                      size="sm"
                      (click)="openDeleteDialog()"
                      [disabled]="isDeleting() || isObservabilityInstance()"
                      [title]="isObservabilityInstance() ? 'Observability instance can only be managed via CLI' : 'Delete instance'"
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
              </div>

              <div hlmCardContent class="pt-0">
                <!-- Inline Badges -->
                <div class="flex flex-wrap items-center gap-2">
                  <app-instance-managed-badge [isManaged]="isManaged()" />

                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    <ng-icon name="lucideBox" class="h-3 w-3" />
                    {{ instance()!.provider }}
                  </span>

                  <span [class]="getStatusBadgeClass()">
                    <ng-icon name="lucideActivity" class="h-3 w-3" />
                    {{ instance()!.status }}
                  </span>

                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    <ng-icon name="lucideMapPin" class="h-3 w-3" />
                    {{ instance()!.regionName || instance()!.region }}
                  </span>

                  @if (instance()!.dataCenter) {
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      <ng-icon name="lucideDatabase" class="h-3 w-3" />
                      {{ instance()!.dataCenter }}
                    </span>
                  }
                </div>
              </div>
            </div>

            <!-- Overview: Resources + Network Unified -->
            <div hlmCard>
              <div hlmCardHeader class="pb-3">
                <h2 hlmCardTitle class="text-base">Overview</h2>
              </div>
              <div hlmCardContent class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Resources Column -->
                <div class="space-y-3">
                  <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-sm">
                      <ng-icon name="lucideCpu" class="h-5 w-5 text-white" />
                    </div>
                    <div class="flex-1">
                      <p class="text-xs text-muted-foreground">CPU Cores</p>
                      <p class="text-lg font-bold">{{ instance()!.cpuCores }}</p>
                    </div>
                  </div>

                  <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 shadow-sm">
                      <ng-icon name="lucideMemoryStick" class="h-5 w-5 text-white" />
                    </div>
                    <div class="flex-1">
                      <p class="text-xs text-muted-foreground">RAM</p>
                      <p class="text-lg font-bold">{{ formatMemory(instance()!.ramMb) }}</p>
                    </div>
                  </div>

                  <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-teal-500 shadow-sm">
                      <ng-icon name="lucideHardDrive" class="h-5 w-5 text-white" />
                    </div>
                    <div class="flex-1">
                      <p class="text-xs text-muted-foreground">Storage</p>
                      <p class="text-lg font-bold">{{ formatDisk(instance()!.diskMb) }}</p>
                    </div>
                  </div>
                </div>

                <!-- Network Column -->
                <div class="space-y-3">
                  @if (instance()!.ipConfig?.v4?.ip) {
                    <div class="flex items-center gap-3">
                      <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
                        <ng-icon name="lucideGlobe" class="h-5 w-5 text-white" />
                      </div>
                      <div class="flex-1">
                        <p class="text-xs text-muted-foreground">IPv4 Address</p>
                        <p class="text-sm font-mono font-semibold">{{ instance()!.ipConfig?.v4?.ip }}</p>
                      </div>
                    </div>
                  }

                  @if (instance()!.ipConfig?.v6?.ip) {
                    <div class="flex items-center gap-3">
                      <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600 shadow-sm">
                        <ng-icon name="lucideGlobe" class="h-5 w-5 text-white" />
                      </div>
                      <div class="flex-1">
                        <p class="text-xs text-muted-foreground">IPv6 Address</p>
                        <p class="text-xs font-mono font-semibold break-all">{{ instance()!.ipConfig?.v6?.ip }}</p>
                      </div>
                    </div>
                  }

                  @if (instance()!.macAddress) {
                    <div class="flex items-center gap-3">
                      <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 shadow-sm">
                        <ng-icon name="lucideNetwork" class="h-5 w-5 text-white" />
                      </div>
                      <div class="flex-1">
                        <p class="text-xs text-muted-foreground">MAC Address</p>
                        <p class="text-sm font-mono font-semibold">{{ instance()!.macAddress }}</p>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Observability Instance Warning -->
            @if (isObservabilityInstance()) {
              <div class="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div class="flex items-center gap-3">
                  <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <div class="flex-1">
                    <p class="text-sm font-medium text-yellow-900 dark:text-yellow-200">Observability Instance</p>
                    <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      This instance is part of the observability cluster and can only be managed via CLI.
                    </p>
                  </div>
                </div>
              </div>
            }

            <!-- Cluster Banner (if part of cluster) -->
            @if (clusterInfo()) {
              <div class="px-4 py-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <ng-icon name="lucideBox" class="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <p class="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                        Part of <span class="font-bold">{{ clusterInfo()!.clusterName }}</span> cluster
                      </p>
                      <p class="text-xs text-indigo-700 dark:text-indigo-300">
                        {{ clusterInfo()!.nodeType }} node
                      </p>
                    </div>
                  </div>
                  <a
                    [routerLink]="['/cluster', clusterInfo()!.clusterId]"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 transition-colors"
                  >
                    View cluster
                    <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                  </a>
                </div>
              </div>
            }

            <!-- SSH Terminal (Collapsible) -->
            @if (isManaged()) {
              <div hlmCard class="border-l-4 border-l-emerald-500">
                <div hlmCardHeader class="pb-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm">
                        <ng-icon name="lucideTerminal" class="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h2 class="text-base font-semibold">SSH Terminal</h2>
                        @if (!canConnectSsh()) {
                          <p class="text-xs text-muted-foreground">
                            {{ instance()?.status !== 'running' ? 'Instance must be running' : 'No IP address available' }}
                          </p>
                        } @else if (isTerminalVisible()) {
                          <p class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Connected</p>
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
                  <div hlmCardContent class="pt-0">
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
                        [clusterId]="clusterInfo()?.clusterId"
                      />
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Sidebar (1/3) -->
          <div class="space-y-4">
            <!-- Metadata Card -->
            <div hlmCard class="bg-muted/30">
              <div hlmCardHeader class="pb-3">
                <h2 hlmCardTitle class="text-base">Instance Details</h2>
              </div>
              <div hlmCardContent class="space-y-3">
                @if (instance()!.osType) {
                  <div class="flex items-start gap-2">
                    <ng-icon name="lucideServer" class="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div class="flex-1">
                      <p class="text-xs text-muted-foreground">Operating System</p>
                      <p class="text-sm font-medium">{{ instance()!.osType }}</p>
                    </div>
                  </div>
                }

                @if (instance()!.productType) {
                  <div class="flex items-start gap-2">
                    <ng-icon name="lucideBox" class="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div class="flex-1">
                      <p class="text-xs text-muted-foreground">Product Type</p>
                      <p class="text-sm font-medium">{{ instance()!.productType }}</p>
                    </div>
                  </div>
                }

                @if (instance()!.productName) {
                  <div class="flex items-start gap-2">
                    <ng-icon name="lucideDatabase" class="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div class="flex-1">
                      <p class="text-xs text-muted-foreground">Product Name</p>
                      <p class="text-sm font-medium">{{ instance()!.productName }}</p>
                    </div>
                  </div>
                }

                @if (instance()!.defaultUser) {
                  <div class="flex items-start gap-2">
                    <ng-icon name="lucideActivity" class="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div class="flex-1">
                      <p class="text-xs text-muted-foreground">Default User</p>
                      <p class="text-sm font-mono font-medium">{{ instance()!.defaultUser }}</p>
                    </div>
                  </div>
                }

                <div class="border-t border-border pt-3 mt-3">
                  <div class="flex items-start gap-2 mb-2">
                    <ng-icon name="lucideClock" class="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div class="flex-1">
                      <p class="text-xs text-muted-foreground">Created</p>
                      <p class="text-xs font-medium">{{ instance()!.createdAt | date: 'short' }}</p>
                    </div>
                  </div>

                  <div class="flex items-start gap-2">
                    <ng-icon name="lucideClock" class="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div class="flex-1">
                      <p class="text-xs text-muted-foreground">Last Updated</p>
                      <p class="text-xs font-medium">{{ instance()!.updatedAt | date: 'short' }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
export class InstanceDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly virtualInstancesService = inject(VirtualInstancesService);
  private readonly infrastructureServersService = inject(InfrastructureServersService);
  private readonly clusterService = inject(ClusterService);

  deleteDialog = viewChild<InstanceDeleteDialogComponent>('deleteDialog');

  instance = signal<InstanceWithLabels | null>(null);
  isLoading = signal(true);
  isDeleting = signal(false);

  // Cluster type tracking
  private readonly instanceClusterType = signal<ClusterType | null>(null);

  isManaged = computed(() => {
    const inst = this.instance();
    return inst ? isManagedByFlui(inst) : false;
  });

  clusterInfo = computed(() => {
    const inst = this.instance();
    return inst ? getClusterInfo(inst) : null;
  });

  isObservabilityInstance = computed(() => {
    return this.instanceClusterType() === ClusterType.OBSERVABILITY;
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

  /**
   * Get dynamic status border class based on instance status
   */
  getStatusBorderClass(): string {
    const status = this.instance()?.status?.toLowerCase();
    switch (status) {
      case 'running':
        return 'border-l-4 border-l-green-500';
      case 'stopped':
        return 'border-l-4 border-l-amber-500';
      case 'error':
      case 'failed':
        return 'border-l-4 border-l-red-500';
      default:
        return 'border-l-4 border-l-gray-400';
    }
  }

  /**
   * Get dynamic status badge class based on instance status
   */
  getStatusBadgeClass(): string {
    const status = this.instance()?.status?.toLowerCase();
    const baseClass = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border';

    switch (status) {
      case 'running':
        return `${baseClass} bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800`;
      case 'stopped':
        return `${baseClass} bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800`;
      case 'error':
      case 'failed':
        return `${baseClass} bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800`;
      default:
        return `${baseClass} bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700`;
    }
  }
}
