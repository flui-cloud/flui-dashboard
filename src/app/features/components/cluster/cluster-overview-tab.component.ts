import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule, Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideCircleCheck,
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
import { EnableBackupsModalComponent } from '../backup/enable-backups/enable-backups-modal.component';
import { ClusterMaintenanceCardComponent } from '../maintenance/cluster-maintenance-card.component';
import { ClusterEgressCardComponent } from '../egress/cluster-egress-card.component';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { ClusterOverviewNodesCardComponent } from './cluster-overview-nodes-card.component';
import { meterBarClass } from './cluster-overview-nodes';

@Component({
  selector: 'cluster-overview-tab',
  standalone: true,
  imports: [MaskIdPipe, ClusterOverviewNodesCardComponent,
    ClusterMaintenanceCardComponent,
    ClusterEgressCardComponent,
    RouterModule, NgIconComponent, AutoscaleWarningBannerComponent, AttachVNetDialogComponent, EnableBackupsModalComponent],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideCircleCheck,
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
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './cluster-overview-tab.component.html',
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


  onVNetAttached(): void {
    this.showAttachDialog.set(false);
  }

  goToScaling(): void {
    const id = this.cluster()?.id;
    if (id) this.router.navigate(['/cluster', id, 'scaling']);
  }

  goToNodes(): void {
    const id = this.cluster()?.id;
    if (id) this.router.navigate(['/cluster', id, 'nodes']);
  }
  syncStatus = signal<any>(null);

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
    return meterBarClass(value, warn, danger);
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
}
