import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { FirewallV2Service } from '../../service/firewall-v2.service';
import { ReconciliationStatusBadgeComponent } from './reconciliation-status-badge.component';
import { DriftIndicatorComponent } from './drift-indicator.component';
import { FirewallRuleComparisonComponent } from './firewall-rule-comparison.component';
import { FirewallInlineRuleEditorComponent } from './firewall-inline-rule-editor.component';
import { FirewallRuleFormData, convertRuleResponseToFormData } from '../../model/firewall-v2.models';

/**
 * Detail view for a single firewall
 * Shows status, allows editing desired rules, and triggering reconciliation
 */
@Component({
  selector: 'app-firewall-detail',
  standalone: true,
  imports: [
    CommonModule,
    NgIcon,
    ReconciliationStatusBadgeComponent,
    DriftIndicatorComponent,
    FirewallRuleComparisonComponent,
    FirewallInlineRuleEditorComponent
  ],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  templateUrl: './firewall-detail.component.html',
  styleUrls: ['./firewall-detail.component.scss']
})
export class FirewallDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly firewallService = inject(FirewallV2Service);

  // Local state
  firewallId = signal<string>('');
  isReconciling = signal(false);
  isDeleting = signal(false);
  showComparison = signal(false);
  editMode = signal(false);

  // Service state
  firewall = this.firewallService.selectedFirewall;
  loading = this.firewallService.loading;
  error = this.firewallService.error;

  // Computed
  desiredRules = computed(() => {
    const fw = this.firewall();
    if (!fw?.desiredRules) return [];
    return fw.desiredRules.map((rule: any) => convertRuleResponseToFormData(rule));
  });

  appliedRules = computed(() => {
    const fw = this.firewall();
    if (!fw?.lastAppliedRules) return [];
    return fw.lastAppliedRules.map((rule: any) => convertRuleResponseToFormData(rule));
  });

  canReconcile = computed(() => {
    const fw = this.firewall();
    return fw?.hasDrift || fw?.reconciliationStatus === 'ERROR' || fw?.reconciliationStatus === 'PENDING';
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
  }

  async reconcile() {
    const id = this.firewallId();
    if (!id) return;

    this.isReconciling.set(true);
    try {
      await this.firewallService.reconcile(id);
      // Optionally poll for completion
      await this.firewallService.pollReconciliation(id, 30000);
    } finally {
      this.isReconciling.set(false);
    }
  }

  async deleteFirewall() {
    if (!confirm('Are you sure? This will leave the cluster unprotected!')) {
      return;
    }

    const id = this.firewallId();
    if (!id) return;

    this.isDeleting.set(true);
    try {
      const success = await this.firewallService.deleteFirewall(id);
      if (success) {
        this.router.navigate(['/infrastructure/firewall/clusters']);
      }
    } finally {
      this.isDeleting.set(false);
    }
  }

  toggleComparison() {
    this.showComparison.update(v => !v);
  }

  goToEditRules() {
    this.editMode.set(true);
  }

  async saveRules(rules: FirewallRuleFormData[]) {
    const id = this.firewallId();
    if (!id) return;

    try {
      // Update desired rules via service (service handles conversion)
      const result = await this.firewallService.updateDesiredRules(id, rules);

      if (result) {
        this.editMode.set(false);
        // Reload firewall to show updated state
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
    this.router.navigate(['/infrastructure/firewall/clusters']);
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  }
}
