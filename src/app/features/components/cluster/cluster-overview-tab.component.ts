import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideCircleCheck,
  lucideServer,
  lucideCpu,
  lucideGlobe,
  lucideKey,
  lucideShield,
  lucideShieldPlus,
  lucideArrowRight,
  lucideCheckCircle,
  lucideAlertCircle,
  lucidePackage,
  lucideNetwork,
  lucideArchive,
} from '@ng-icons/lucide';
import { PlatformComponentsService } from '../../service/platform-components.service';
import { PlatformComponentResponseDto } from '../../../core/api/model/platformComponentResponseDto';

import { ClusterService } from '../../service/cluster.service';
import { ClusterMonitoringService } from '../../service/cluster-monitoring.service';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import { ClusterVariablesService } from '../../service/cluster-variables.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { FirewallV2Service } from '../../service/firewall-v2.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { BackupService } from '../../service/backup.service';
import { ProviderType } from '../../model/cluster.models';
import { BackupPolicy } from '../../model/backup.models';
import { AutoscaleWarningBannerComponent } from './autoscale-warning-banner.component';
import { AttachVNetDialogComponent } from './attach-vnet-dialog.component';
import { AddWorkerDialogComponent } from './add-worker-dialog.component';
import { EnableBackupsModalComponent } from '../backup/enable-backups/enable-backups-modal.component';

@Component({
  selector: 'cluster-overview-tab',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIconComponent, AutoscaleWarningBannerComponent, AttachVNetDialogComponent, AddWorkerDialogComponent, EnableBackupsModalComponent],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideCircleCheck,
      lucideServer,
      lucideCpu,
      lucideGlobe,
      lucideKey,
      lucideShield,
      lucideShieldPlus,
      lucideArrowRight,
      lucideCheckCircle,
      lucideAlertCircle,
      lucidePackage,
      lucideNetwork,
      lucideArchive,
    }),
  ],
  template: `
    <div class="space-y-4">

      <!-- Autoscale warning banner (only when warning != NONE) -->
      <app-autoscale-warning-banner
        [status]="autoscaleStatus()"
        (configure)="goToAutoscaling()"
        (addWorker)="openAddWorker()"
      />

      <!-- Health Bar (slim, link → monitoring) -->
      @if (monitoring.servers().length > 0) {
        <a [routerLink]="['../monitoring']" class="card-surface px-4 py-2.5 flex items-center gap-3 sm:gap-5 text-sm hover:border-primary/40 transition-colors overflow-hidden">
          <div class="flex items-center gap-1.5 font-medium flex-shrink-0" [class]="healthTextColor()">
            <span class="h-2 w-2 rounded-full flex-shrink-0" [class]="healthDotColor()"></span>
            {{ monitoring.healthStatus() }}
          </div>
          <span class="hidden sm:inline text-border">|</span>
          <div class="hidden sm:flex items-center gap-2">
            <span class="text-label normal-case tracking-normal">Avg CPU</span>
            <div class="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div class="h-full rounded-full transition-all" [class]="progressBarColor(cpuPercent(), 70, 90)" [style.width.%]="cpuPercent()"></div>
            </div>
            <span class="font-medium tabular-nums" [class]="metricColor(cpuPercent(), 70, 90)">{{ cpuPercent().toFixed(0) }}%</span>
          </div>
          <span class="hidden sm:inline text-border">|</span>
          <div class="hidden sm:flex items-center gap-2">
            <span class="text-label normal-case tracking-normal">Avg Memory</span>
            <div class="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div class="h-full rounded-full transition-all" [class]="progressBarColor(memPercent(), 75, 90)" [style.width.%]="memPercent()"></div>
            </div>
            <span class="font-medium tabular-nums" [class]="metricColor(memPercent(), 75, 90)">{{ memPercent().toFixed(0) }}%</span>
          </div>
          <span class="ml-auto flex items-center gap-1 text-xs text-primary flex-shrink-0">
            <span class="hidden sm:inline">Monitoring</span> <ng-icon name="lucideArrowRight" class="h-3 w-3" />
          </span>
        </a>
      }

      @if (cluster(); as c) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">

          <!-- LEFT: Nodes -->
          <div class="card-surface p-4 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-1.5 text-label">
                <ng-icon name="lucideServer" class="h-3.5 w-3.5" />
                Nodes
              </div>
              <span class="text-lg font-bold text-foreground">{{ c.nodeCount || 0 }}</span>
            </div>
            @if (clusterService.nodesIsLoading()) {
              <div class="space-y-1.5 flex-1">
                @for (i of [1,2,3]; track i) {
                  <div class="skeleton h-6"></div>
                }
              </div>
            } @else if (previewNodes().length > 0) {
              <div class="space-y-1 flex-1">
                @for (node of previewNodes(); track node.id) {
                  <div class="flex items-center gap-1.5 text-xs px-2 py-1 card-inner">
                    <span class="h-1.5 w-1.5 rounded-full flex-shrink-0" [class]="nodeStatusDot(node.status)"></span>
                    <span class="text-value truncate">{{ node.name }}</span>
                    @if (node.status) {
                      <span class="ml-auto text-sub capitalize flex-shrink-0">{{ node.status }}</span>
                    }
                  </div>
                }
                @if ((c.nodeCount || 0) > 3) {
                  <p class="text-sub pl-2">+{{ (c.nodeCount || 0) - 3 }} more</p>
                }
              </div>
            } @else {
              <p class="text-sub flex-1">No nodes loaded</p>
            }
            @if (c.autoScalingEnabled) {
              <p class="text-sub mt-2 pt-2 border-t border-border">
                Auto-scale · {{ c.minNodes }}–{{ c.maxNodes }} nodes
              </p>
            }
            <a [routerLink]="['../nodes']" class="card-link">
              View all nodes <ng-icon name="lucideArrowRight" class="h-3 w-3" />
            </a>
          </div>

          <!-- RIGHT: 2×2 grid -->
          <div class="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">

            <!-- Firewall (full width) -->
            <div class="sm:col-span-2 card-surface p-4 flex flex-col">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-1.5 text-label">
                  <ng-icon name="lucideShield" class="h-3.5 w-3.5" />
                  Firewall
                </div>
                @if (firewallService.selectedFirewall()) {
                  <div class="flex items-center gap-1 text-xs font-medium" [class]="firewallStatusColor(firewallService.selectedFirewall()!.reconciliationStatus)">
                    @if (firewallService.selectedFirewall()!.reconciliationStatus === 'IN_SYNC') {
                      <ng-icon name="lucideCheckCircle" class="h-3.5 w-3.5" />
                    } @else {
                      <ng-icon name="lucideAlertCircle" class="h-3.5 w-3.5" />
                    }
                    {{ firewallService.selectedFirewall()!.reconciliationStatus }}
                  </div>
                }
              </div>
              @if (firewallService.isLoading()) {
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  @for (i of [1,2,3]; track i) {
                    <div class="skeleton h-14"></div>
                  }
                </div>
              } @else if (firewallService.selectedFirewall()) {
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div class="card-inner px-3 py-2 text-xs">
                    <p class="text-sub mb-0.5">Desired rules</p>
                    <p class="text-base font-bold text-foreground">{{ firewallService.selectedFirewall()!.desiredRules.length }}</p>
                  </div>
                  <div class="card-inner px-3 py-2 text-xs">
                    <p class="text-sub mb-0.5">Applied rules</p>
                    <p class="text-base font-bold text-foreground">{{ firewallService.selectedFirewall()!.lastAppliedRules?.length ?? '—' }}</p>
                  </div>
                  <div class="card-inner px-3 py-2 text-xs">
                    <p class="text-sub mb-0.5">Last sync</p>
                    <p class="text-value">
                      @if (firewallService.selectedFirewall()!.lastReconciliationAt) {
                        {{ formatRelative(firewallService.selectedFirewall()!.lastReconciliationAt!) }}
                      } @else { — }
                    </p>
                  </div>
                </div>
              } @else {
                <p class="text-sub">No firewall configured</p>
              }
              <a [routerLink]="['../firewall']" class="card-link">
                Manage firewall <ng-icon name="lucideArrowRight" class="h-3 w-3" />
              </a>
            </div>

            <!-- Backups (full width) -->
            <div class="sm:col-span-2 card-surface p-4 flex flex-col">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-1.5 text-label">
                  <ng-icon name="lucideArchive" class="h-3.5 w-3.5" />
                  Backups
                </div>
                @if (clusterPolicies().length > 0) {
                  <div class="flex items-center gap-1 text-xs font-medium status-healthy">
                    <ng-icon name="lucideCheckCircle" class="h-3.5 w-3.5" />
                    Active
                  </div>
                }
              </div>
              @if (clusterPolicies().length > 0) {
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div class="card-inner px-3 py-2 text-xs">
                    <p class="text-sub mb-0.5">Policies</p>
                    <p class="text-base font-bold text-foreground">{{ clusterPolicies().length }}</p>
                  </div>
                  <div class="card-inner px-3 py-2 text-xs">
                    <p class="text-sub mb-0.5">Schedule</p>
                    <p class="text-value font-mono">{{ clusterPolicies()[0].cronSchedule || 'on-demand' }}</p>
                  </div>
                  <div class="card-inner px-3 py-2 text-xs">
                    <p class="text-sub mb-0.5">Profile</p>
                    <p class="text-value capitalize">{{ clusterPolicies()[0].profile }}</p>
                  </div>
                </div>
                <a [routerLink]="['/management/backup/policies']" class="card-link">
                  Manage backups <ng-icon name="lucideArrowRight" class="h-3 w-3" />
                </a>
              } @else {
                <p class="text-sub mb-3">No backups configured for this cluster.</p>
                <button
                  type="button"
                  (click)="openEnableBackups()"
                  class="self-start rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Enable backups
                </button>
              }
            </div>

            <!-- DNS Zone -->
            <div class="card-surface p-4 flex flex-col">
              <div class="flex items-center gap-1.5 text-label mb-3">
                <ng-icon name="lucideGlobe" class="h-3.5 w-3.5" />
                DNS Zone
              </div>
              @if (dnsZoneService.loading()) {
                <div class="space-y-2 flex-1">
                  <div class="skeleton h-5 w-3/4"></div>
                  <div class="skeleton h-4 w-16"></div>
                  <div class="grid grid-cols-2 gap-2 pt-1">
                    <div class="skeleton h-10"></div>
                    <div class="skeleton h-10"></div>
                  </div>
                </div>
              } @else if (dnsZoneService.hasAssignment()) {
                <div class="space-y-2 flex-1">
                  <p class="font-medium text-foreground truncate text-sm" [title]="dnsZoneService.assignment()?.dnsZone?.zoneName">
                    {{ dnsZoneService.assignment()?.dnsZone?.zoneName }}
                  </p>
                  <div class="text-xs font-medium" [class]="reconciliationClass()">
                    {{ dnsZoneService.reconciliationStatus() ?? 'PENDING' }}
                  </div>
                  <div class="grid grid-cols-2 gap-2 pt-1">
                    <div class="card-inner px-2 py-1.5 text-xs">
                      <p class="text-sub">Issuers</p>
                      <p class="font-bold" [class]="dnsZoneService.issuersReady() ? 'status-healthy' : 'text-foreground'">
                        {{ dnsZoneService.issuers().length }}{{ dnsZoneService.issuersReady() ? ' ✓' : '' }}
                      </p>
                    </div>
                    <div class="card-inner px-2 py-1.5 text-xs">
                      <p class="text-sub">Endpoints</p>
                      <p class="font-bold text-foreground">{{ appEndpointsService.endpoints().length }}</p>
                    </div>
                  </div>
                </div>
              } @else {
                <p class="text-sub flex-1">Not configured</p>
              }
              <a [routerLink]="['../dns']" class="card-link">
                Manage DNS <ng-icon name="lucideArrowRight" class="h-3 w-3" />
              </a>
            </div>

            <!-- Variables -->
            <div class="card-surface p-4 flex flex-col">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-1.5 text-label">
                  <ng-icon name="lucideKey" class="h-3.5 w-3.5" />
                  Variables
                </div>
                <span class="text-lg font-bold text-foreground">{{ variablesService.sets().length }}</span>
              </div>
              @if (variablesService.loading()) {
                <div class="space-y-1.5 flex-1">
                  @for (i of [1,2]; track i) {
                    <div class="skeleton h-6"></div>
                  }
                </div>
              } @else if (variablesService.sets().length === 0) {
                <p class="text-sub flex-1">No variable sets</p>
              } @else {
                <div class="space-y-1 flex-1">
                  @for (vs of previewVarSets(); track vs.name) {
                    <div class="flex items-center justify-between px-2 py-1 card-inner text-xs">
                      <span class="font-mono text-value truncate max-w-[60%]">{{ vs.name }}</span>
                      <span class="text-sub flex-shrink-0">{{ vs.keys.length }} keys</span>
                    </div>
                  }
                  @if (variablesService.sets().length > 3) {
                    <p class="text-sub pl-2">+{{ variablesService.sets().length - 3 }} more</p>
                  }
                </div>
              }
              <a [routerLink]="['../variables']" class="card-link">
                Manage variables <ng-icon name="lucideArrowRight" class="h-3 w-3" />
              </a>
            </div>

            <!-- Platform Health -->
            <div class="card-surface p-4 flex flex-col">
              <div class="flex items-center gap-1.5 text-label mb-3">
                <ng-icon name="lucidePackage" class="h-3.5 w-3.5" />
                Platform Components
              </div>
              @if (platformService.globalLoading()) {
                <div class="grid grid-cols-3 gap-2 flex-1">
                  @for (i of [1,2,3]; track i) {
                    <div class="skeleton h-12"></div>
                  }
                </div>
              } @else if (platformComponentsForCluster().length > 0) {
                <div class="grid grid-cols-3 gap-2 flex-1">
                  <div class="card-inner px-2 py-1.5 text-xs text-center">
                    <p class="text-sub">Healthy</p>
                    <p class="font-bold status-healthy">{{ platformHealthyCount() }}</p>
                  </div>
                  <div class="card-inner px-2 py-1.5 text-xs text-center">
                    <p class="text-sub">Degraded</p>
                    <p class="font-bold" [class]="platformDegradedCount() > 0 ? 'status-degraded' : 'text-foreground'">{{ platformDegradedCount() }}</p>
                  </div>
                  <div class="card-inner px-2 py-1.5 text-xs text-center">
                    <p class="text-sub">Missing</p>
                    <p class="font-bold" [class]="platformMissingCount() > 0 ? 'status-error' : 'text-foreground'">{{ platformMissingCount() }}</p>
                  </div>
                </div>
              } @else {
                <p class="text-sub flex-1">No data</p>
              }
              <a routerLink="/infrastructure/platform-components" class="card-link">
                View all <ng-icon name="lucideArrowRight" class="h-3 w-3" />
              </a>
            </div>

            <!-- Network / VNet -->
            <div class="card-surface p-4 flex flex-col">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-1.5 text-label">
                  <ng-icon name="lucideNetwork" class="h-3.5 w-3.5" />
                  Network
                </div>
                @if (c.vnetId) {
                  <span class="text-xs font-medium status-healthy">Attached</span>
                } @else {
                  <span class="text-xs font-medium text-sub">Not attached</span>
                }
              </div>
              @if (c.vnetId) {
                <div class="space-y-1 flex-1">
                  <p class="text-sm font-medium text-foreground truncate" [title]="c.vnetName ?? c.vnetId">
                    {{ c.vnetName || 'VNet' }}
                  </p>
                  <p class="font-mono text-xs text-sub truncate" [title]="c.vnetId">{{ c.vnetId }}</p>
                </div>
              } @else {
                <p class="text-sub flex-1 text-xs">
                  Attach this cluster to a VNet to enable autoscaling and private networking.
                </p>
                <button
                  type="button"
                  (click)="openAttachVNet()"
                  class="card-link text-left"
                >
                  Attach VNet <ng-icon name="lucideArrowRight" class="h-3 w-3" />
                </button>
              }
            </div>

            <!-- Auth Proxy -->
            <div class="card-surface p-4 flex flex-col">
              <div class="flex items-center gap-1.5 text-label mb-3">
                <ng-icon name="lucideShieldPlus" class="h-3.5 w-3.5" />
                Auth Proxy
              </div>
              <p class="text-sub flex-1 text-xs">
                In-cluster JWT validator for internal apps.
                Faster auth, works offline from the Flui API.
              </p>
              <a [routerLink]="'/settings'" [queryParams]="{ clusterId: c.id }" fragment="auth-proxy" class="card-link">
                Manage <ng-icon name="lucideArrowRight" class="h-3 w-3" />
              </a>
            </div>

          </div>
        </div>

        <!-- Cluster Info strip -->
        <div class="card-surface px-4 py-3">
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
            <div>
              <p class="text-label mb-0.5">Provider</p>
              <p class="text-value">{{ getProviderLabel(c.provider) }}</p>
            </div>
            <div>
              <p class="text-label mb-0.5">Region</p>
              <p class="text-value">{{ c.region || '—' }}</p>
            </div>
            <div>
              <p class="text-label mb-0.5">K3s Version</p>
              <p class="text-value">{{ c.version || 'N/A' }}</p>
            </div>
            <div>
              <p class="text-label mb-0.5">Auto-scaling</p>
              @if (c.autoScalingEnabled) {
                <p class="font-medium status-healthy">Enabled</p>
              } @else {
                <p class="text-sub font-medium">Disabled</p>
              }
            </div>
            <div>
              <p class="text-label mb-0.5">Created</p>
              <p class="text-value">{{ formatDate(c.createdAt) }}</p>
            </div>
            @if (c.id) {
              <div>
                <p class="text-label mb-0.5">Cluster ID</p>
                <p class="font-mono text-sub truncate" [title]="c.id">{{ c.id }}</p>
              </div>
            }
          </div>
        </div>
      }

      @if (showAttachDialog() && cluster()?.id; as cid) {
        <app-attach-vnet-dialog
          [clusterId]="cid"
          [provider]="cluster()?.provider ?? ''"
          (closed)="showAttachDialog.set(false)"
          (attached)="onVNetAttached()"
        />
      }

      @if (showAddWorkerDialog() && cluster()?.id; as cid) {
        <app-add-worker-dialog
          [clusterId]="cid"
          [currentNodes]="autoscaleStatus()?.currentNodes ?? (cluster()?.nodeCount ?? 0)"
          [maxNodes]="autoscaleStatus()?.maxNodes ?? cluster()?.maxNodes ?? null"
          (closed)="showAddWorkerDialog.set(false)"
        />
      }

      @if (showEnableBackups() && cluster()?.id; as cid) {
        <app-enable-backups-modal
          [clusterId]="cid"
          [open]="true"
          (closed)="onEnableBackupsClosed($event)"
        />
      }

    </div>
  `,
})
export class ClusterOverviewTabComponent implements OnInit, OnDestroy {
  readonly clusterService = inject(ClusterService);
  readonly monitoring = inject(ClusterMonitoringService);
  readonly dnsZoneService = inject(ClusterDnsZoneService);
  readonly variablesService = inject(ClusterVariablesService);
  readonly firewallService = inject(FirewallV2Service);
  readonly appEndpointsService = inject(AppEndpointsService);
  readonly platformService = inject(PlatformComponentsService);
  readonly autoscaleService = inject(ClusterAutoscaleService);
  readonly backupService = inject(BackupService);
  private readonly router = inject(Router);

  cluster = this.clusterService.cluster;
  autoscaleStatus = this.autoscaleService.status;
  showAttachDialog = signal<boolean>(false);
  showAddWorkerDialog = signal<boolean>(false);
  showEnableBackups = signal<boolean>(false);
  clusterPolicies = signal<BackupPolicy[]>([]);

  openEnableBackups(): void {
    this.showEnableBackups.set(true);
  }

  async onEnableBackupsClosed(result: { activated: boolean }): Promise<void> {
    this.showEnableBackups.set(false);
    if (result.activated) await this.refreshClusterPolicies();
  }

  async refreshClusterPolicies(): Promise<void> {
    const id = this.cluster()?.id;
    if (!id) return;
    this.clusterPolicies.set(await this.backupService.loadPoliciesByCluster(id));
  }

  openAttachVNet(): void {
    this.showAttachDialog.set(true);
  }

  openAddWorker(): void {
    this.showAddWorkerDialog.set(true);
  }

  onVNetAttached(): void {
    this.showAttachDialog.set(false);
  }

  goToAutoscaling(): void {
    const id = this.cluster()?.id;
    if (id) this.router.navigate(['/cluster', id, 'autoscaling']);
  }

  goToNodes(): void {
    const id = this.cluster()?.id;
    if (id) this.router.navigate(['/cluster', id, 'nodes']);
  }
  syncStatus = signal<any | null>(null);

  readonly cpuPercent = computed(() => Number.parseFloat(String(this.monitoring.clusterStats()[0]?.value ?? '0')));
  readonly memPercent = computed(() => Number.parseFloat(String(this.monitoring.clusterStats()[1]?.value ?? '0')));

  readonly healthDotColor = computed(() => {
    const s = this.monitoring.healthStatus();
    if (s === 'HEALTHY') return 'dot-healthy';
    if (s === 'DEGRADED') return 'dot-degraded';
    return 'dot-error';
  });

  readonly healthTextColor = computed(() => {
    const s = this.monitoring.healthStatus();
    if (s === 'HEALTHY') return 'status-healthy';
    if (s === 'DEGRADED') return 'status-degraded';
    return 'status-error';
  });

  readonly previewNodes = computed(() => this.clusterService.nodes().slice(0, 3));
  readonly previewVarSets = computed(() => this.variablesService.sets().slice(0, 3));

  readonly platformComponentsForCluster = computed(() => {
    const id = this.cluster()?.id;
    if (!id) return [];
    const entry = this.platformService.entries().find(e => e.clusterId === id);
    return entry?.components ?? [];
  });

  readonly platformHealthyCount = computed(() =>
    this.platformComponentsForCluster().filter(c => c.status === PlatformComponentResponseDto.StatusEnum.Healthy).length
  );
  readonly platformDegradedCount = computed(() =>
    this.platformComponentsForCluster().filter(c => c.status === PlatformComponentResponseDto.StatusEnum.Degraded).length
  );
  readonly platformMissingCount = computed(() =>
    this.platformComponentsForCluster().filter(c => c.status === PlatformComponentResponseDto.StatusEnum.Missing).length
  );

  ngOnInit(): void {
    void (async () => {
      this.monitoring.startPolling();
      const c = this.cluster();
      if (c?.id) {
        const calls: Promise<any>[] = [
          this.clusterService.reconcileClusterStatus(c.id, false),
          this.dnsZoneService.loadAssignment(c.id),
          this.dnsZoneService.loadIssuers(c.id),
          this.variablesService.loadSets(c.id, 'default'),
          this.firewallService.getFirewallByCluster(c.id),
          this.appEndpointsService.loadEndpoints(c.id),
          this.platformService.loadForCluster(c.id, this.cluster()?.name ?? c.id),
          this.refreshClusterPolicies(),
        ];
        if (this.clusterService.nodes().length === 0) {
          calls.push(this.clusterService.loadClusterNodes(c.id));
        }
        const [statusResult] = await Promise.allSettled(calls);
        if (statusResult.status === 'fulfilled') {
          this.syncStatus.set(statusResult.value);
        }
      }
    })();
  }

  ngOnDestroy(): void {
    this.monitoring.stopPolling();
  }

  getProviderLabel(provider?: ProviderType): string {
    switch (provider) {
      case ProviderType.HETZNER: return 'Hetzner';
      case ProviderType.CONTABO: return 'Contabo';
      case ProviderType.SCALEWAY: return 'Scaleway';
      case ProviderType.OVH: return 'OVH';
      default: return 'Unknown';
    }
  }

  formatDate(date?: Date): string {
    if (!date) return 'N/A';
    const now = new Date();
    const target = new Date(date);
    const diffDays = Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return target.toLocaleDateString();
  }

  formatRelative(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  metricColor(value: number, warn: number, danger: number): string {
    if (value >= danger) return 'status-error';
    if (value >= warn) return 'status-degraded';
    return 'status-healthy';
  }

  progressBarColor(value: number, warn: number, danger: number): string {
    if (value >= danger) return 'bg-red-500';
    if (value >= warn) return 'bg-orange-400';
    return 'bg-green-500';
  }

  reconciliationClass(): string {
    const status = this.dnsZoneService.reconciliationStatus();
    if (status === 'IN_SYNC') return 'status-healthy';
    if (status === 'DRIFT' || status === 'ERROR') return 'status-degraded';
    return 'status-pending';
  }

  firewallStatusColor(status: string): string {
    if (status === 'IN_SYNC') return 'status-healthy';
    if (status === 'DRIFT') return 'status-degraded';
    if (status === 'ERROR') return 'status-error';
    return 'status-pending';
  }

  nodeStatusDot(status?: string): string {
    if (!status) return 'dot-pending';
    const s = status.toLowerCase();
    if (s === 'running' || s === 'active') return 'dot-healthy';
    if (s === 'stopped' || s === 'off') return 'dot-pending';
    return 'dot-degraded';
  }
}
