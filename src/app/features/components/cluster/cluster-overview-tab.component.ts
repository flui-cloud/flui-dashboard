import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
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
import { isControlClusterType } from '../../model/cluster.models';
import { BackupPolicy } from '../../model/backup.models';
import { AutoscaleWarningBannerComponent } from './autoscale-warning-banner.component';
import { AttachVNetDialogComponent } from './attach-vnet-dialog.component';
import { EnableBackupsModalComponent } from '../backup/enable-backups/enable-backups-modal.component';
import { ClusterMaintenanceCardComponent } from '../maintenance/cluster-maintenance-card.component';
import { ClusterEgressLineComponent } from '../egress/cluster-egress-line.component';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { SandboxService } from '../../../core/services/sandbox.service';
import { ClusterHaCardComponent } from './cluster-ha-card.component';
import { ClusterOverviewNodesCardComponent } from './cluster-overview-nodes-card.component';
import {
  dnsState,
  formatAge,
  formatRelative,
  healthState,
  plural,
  providerLabel,
  syncState,
} from './cluster-overview-view';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'cluster-overview-tab',
  imports: [
    DatePipe,
    MaskIdPipe,
    RouterModule,
    ClusterOverviewNodesCardComponent,
    ClusterHaCardComponent,
    ClusterMaintenanceCardComponent,
    ClusterEgressLineComponent,
    AutoscaleWarningBannerComponent,
    AttachVNetDialogComponent,
    EnableBackupsModalComponent,
    FlAlert,
    FlButton,
    FlCopyId,
    FlKeyValue,
    FlKvItem,
    FlLoadingState,
    FlPanel,
    FlStatus,
    FlUsageBar,
  ],
  host: { class: 'fl-stack' },
  templateUrl: './cluster-overview-tab.component.html',
})
export class ClusterOverviewTabComponent implements OnInit, OnDestroy {
  readonly clusterService = inject(ClusterService);
  private readonly sandbox = inject(SandboxService);
  /** A demo guest sees the cluster, not the levers that run it. */
  readonly guest = computed(() => this.sandbox.inSandbox());
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
  syncStatus = signal<unknown>(null);

  readonly cpuPercent = computed(() =>
    Number.parseFloat(String(this.monitoring.clusterStats()[0]?.value ?? '0')),
  );
  readonly memPercent = computed(() =>
    Number.parseFloat(String(this.monitoring.clusterStats()[1]?.value ?? '0')),
  );

  readonly previewVarSets = computed(() => this.variablesService.sets().slice(0, 3));

  readonly platformComponentsForCluster = computed(() => {
    const id = this.cluster()?.id;
    if (!id) return [];
    const entry = this.platformService.entries().find((e) => e.clusterId === id);
    return entry?.components ?? [];
  });

  readonly platformHealthyCount = computed(
    () =>
      this.platformComponentsForCluster().filter(
        (c) => c.status === PlatformComponentResponseDto.StatusEnum.Healthy,
      ).length,
  );
  readonly platformDegradedCount = computed(
    () =>
      this.platformComponentsForCluster().filter(
        (c) => c.status === PlatformComponentResponseDto.StatusEnum.Degraded,
      ).length,
  );
  readonly platformMissingCount = computed(
    () =>
      this.platformComponentsForCluster().filter(
        (c) => c.status === PlatformComponentResponseDto.StatusEnum.Missing,
      ).length,
  );

  ngOnInit(): void {
    void (async () => {
      this.monitoring.startPolling();
      const c = this.cluster();
      if (c?.id) {
        const calls: Promise<unknown>[] = [
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

  protected readonly providerLabel = providerLabel;
  protected readonly isControl = isControlClusterType;
  protected readonly healthState = healthState;
  protected readonly syncState = syncState;
  protected readonly dnsState = dnsState;
  protected readonly formatAge = formatAge;
  protected readonly formatRelative = formatRelative;
  protected readonly plural = plural;

  protected sentence(value: string | null | undefined): string {
    if (!value) return '—';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
