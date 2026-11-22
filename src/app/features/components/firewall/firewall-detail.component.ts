import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FirewallV2Service } from '../../service/firewall-v2.service';
import { ProvidersService } from '../../service/providers.service';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { ReconciliationStatusBadgeComponent } from './reconciliation-status-badge.component';
import { DriftIndicatorComponent } from './drift-indicator.component';
import { FirewallRuleComparisonComponent } from './firewall-rule-comparison.component';
import { FirewallInlineRuleEditorComponent } from './firewall-inline-rule-editor.component';
import { FirewallRulesTable } from './firewall-rules-table';
import {
  FirewallRuleFormData,
  convertRuleResponseToFormData,
} from '../../model/firewall-v2.models';
import { FirewallRuleResponseDto } from '../../../core/api/model/models';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';

const LIST_LINK = '/infrastructure/firewall/clusters';

@Component({
  selector: 'app-firewall-detail',
  imports: [
    MaskIdPipe,
    JsonPipe,
    ReconciliationStatusBadgeComponent,
    DriftIndicatorComponent,
    FirewallRuleComparisonComponent,
    FirewallInlineRuleEditorComponent,
    FirewallRulesTable,
    FlPageHeader,
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlAlert,
    FlCopyId,
    FlLoadingState,
    FlButton,
    FlSpinner,
    FlActionsMenu,
  ],
  host: { class: 'block' },
  templateUrl: './firewall-detail.component.html',
})
export class FirewallDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly firewallService = inject(FirewallV2Service);
  private readonly providersService = inject(ProvidersService);
  private readonly clustersApi = inject(InfrastructureClustersService);
  private readonly confirmService = inject(ConfirmService);

  private readonly clusterProvider = signal<string | null>(null);
  readonly firewallCap = computed(() => {
    const p = this.clusterProvider();
    return p ? this.providersService.getProviderDefinition(p)?.capabilities?.firewall : undefined;
  });
  readonly supportsSshAllowlist = computed(() => this.firewallCap()?.supportsSshAllowlist ?? true);
  readonly isHostFirewall = computed(() => this.firewallCap()?.backend === 'host-nftables');

  firewallId = signal<string>('');
  isReconciling = signal(false);
  isDeleting = signal(false);
  showComparison = signal(false);
  editMode = signal(false);

  firewall = this.firewallService.selectedFirewall;
  loading = this.firewallService.loading;
  error = this.firewallService.error;

  desiredRules = computed(() => {
    const fw = this.firewall();
    if (!fw?.desiredRules) return [];
    return fw.desiredRules.map((rule) =>
      convertRuleResponseToFormData(rule as FirewallRuleResponseDto),
    );
  });

  appliedRules = computed(() => {
    const fw = this.firewall();
    if (!fw?.lastAppliedRules) return [];
    return fw.lastAppliedRules.map((rule) =>
      convertRuleResponseToFormData(rule as FirewallRuleResponseDto),
    );
  });

  readonly title = computed(() => {
    const name = this.firewall()?.clusterInfo?.clusterName;
    return name ? `${name} firewall` : 'Firewall';
  });

  readonly breadcrumb = computed<Crumb[]>(() => [
    { label: 'Cluster firewalls', link: LIST_LINK },
    { label: this.firewall()?.clusterInfo?.clusterName ?? 'Firewall' },
  ]);

  readonly moreActions = computed<MenuAction[]>(() => [
    { id: 'delete', label: 'Delete firewall', danger: true, disabled: this.isDeleting() },
  ]);

  canReconcile = computed(() => {
    const fw = this.firewall();
    return (
      fw?.hasDrift || fw?.reconciliationStatus === 'ERROR' || fw?.reconciliationStatus === 'PENDING'
    );
  });

  ngOnInit(): void {
    void (async () => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.firewallId.set(id);
        await this.loadFirewall(id);
      }
    })();
  }

  async loadFirewall(id: string) {
    await this.firewallService.getFirewall(id);
    await this.loadClusterCapability();
  }

  private async loadClusterCapability() {
    const clusterId = this.firewall()?.clusterId;
    if (!clusterId) return;
    try {
      const cluster = await firstValueFrom(
        this.clustersApi.clustersControllerGetCluster(clusterId),
      );
      if (cluster?.provider) {
        this.providersService.loadProviderDefinition(cluster.provider);
        this.clusterProvider.set(cluster.provider);
      }
    } catch {}
  }

  async reconcile() {
    const id = this.firewallId();
    if (!id) return;

    this.isReconciling.set(true);
    try {
      await this.firewallService.reconcile(id);
      await this.firewallService.pollReconciliation(id, 30000);
    } finally {
      this.isReconciling.set(false);
    }
  }

  onAction(action: string) {
    if (action === 'delete') void this.deleteFirewall();
  }

  async deleteFirewall() {
    const ok = await this.confirmService.confirm({
      title: 'Delete this firewall?',
      body: 'The cluster is left without a firewall and every port is unprotected.',
      confirmLabel: 'Delete firewall',
      destructive: true,
    });
    if (!ok) return;

    const id = this.firewallId();
    if (!id) return;

    this.isDeleting.set(true);
    try {
      const success = await this.firewallService.deleteFirewall(id);
      if (success) {
        this.router.navigate([LIST_LINK]);
      }
    } finally {
      this.isDeleting.set(false);
    }
  }

  toggleComparison() {
    this.showComparison.update((v) => !v);
  }

  goToEditRules() {
    this.editMode.set(true);
  }

  async saveRules(rules: FirewallRuleFormData[]) {
    const id = this.firewallId();
    if (!id) return;

    try {
      const result = await this.firewallService.updateDesiredRules(id, rules);

      if (result) {
        this.editMode.set(false);
        await this.loadFirewall(id);
      }
    } catch (error) {
      console.error('Failed to save rules:', error);
    }
  }

  cancelEdit() {
    this.editMode.set(false);
  }

  goBack() {
    this.router.navigate([LIST_LINK]);
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  }
}
