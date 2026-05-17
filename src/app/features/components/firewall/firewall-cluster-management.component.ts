import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FirewallV2Service } from '../../service/firewall-v2.service';
import { ReconciliationStatusBadgeComponent } from './reconciliation-status-badge.component';
import { DriftIndicatorComponent } from './drift-indicator.component';
import { ReconciliationStatus, CoverageStatus, getCoverageStatusLabel } from '../../model/firewall-v2.models';
import { FirewallClusterInfoDto, FirewallNodeInfoDto } from '../../../core/api/model/models';

/**
 * Main component for listing and managing cluster firewalls
 * Displays all firewalls with filtering, coverage status and quick actions
 */
@Component({
  selector: 'app-firewall-cluster-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ReconciliationStatusBadgeComponent,
    DriftIndicatorComponent
  ],
  templateUrl: './firewall-cluster-management.component.html',
  styleUrls: ['./firewall-cluster-management.component.scss']
})
export class FirewallClusterManagementComponent implements OnInit {
  private readonly firewallService = inject(FirewallV2Service);
  // Local state
  searchQuery = signal('');
  selectedStatus = signal<ReconciliationStatus | undefined>(undefined);
  selectedCoverage = signal<CoverageStatus | undefined>(undefined);
  reconciling = signal<Set<string>>(new Set());

  // Service state
  firewalls = this.firewallService.extendedFirewalls;
  stats = this.firewallService.stats;
  loading = this.firewallService.loading;
  error = this.firewallService.error;

  // Status options for filter
  statusOptions = [
    { value: undefined, label: 'All Statuses' },
    { value: ReconciliationStatus.IN_SYNC, label: 'In Sync' },
    { value: ReconciliationStatus.DRIFT, label: 'Drift Detected' },
    { value: ReconciliationStatus.PENDING, label: 'Pending' },
    { value: ReconciliationStatus.ERROR, label: 'Error' },
    { value: ReconciliationStatus.RECONCILING, label: 'Reconciling' }
  ];

  // Coverage options for filter
  coverageOptions: { value: CoverageStatus | undefined; label: string }[] = [
    { value: undefined, label: 'All Coverage' },
    { value: 'FULL', label: 'Full Coverage' },
    { value: 'PARTIAL', label: 'Partial Coverage' },
    { value: 'ORPHANED', label: 'Orphaned' },
    { value: 'UNKNOWN', label: 'Unknown' }
  ];

  ngOnInit(): void {
    void (async () => {
      await this.loadFirewalls();
    })();
  }

  async loadFirewalls() {
    await this.firewallService.loadFirewalls();
  }

  async onSearchChange(search: string) {
    this.searchQuery.set(search);
    this.firewallService.updateFilter({ search });
  }

  async onStatusFilterChange(status: ReconciliationStatus | undefined) {
    this.selectedStatus.set(status);
    this.firewallService.updateFilter({ status });
  }

  onCoverageFilterChange(coverage: CoverageStatus | undefined) {
    this.selectedCoverage.set(coverage);
    this.firewallService.updateFilter({ coverage });
  }

  async reconcileFirewall(firewallId: string, event: Event) {
    event.stopPropagation();

    this.reconciling.update(set => {
      set.add(firewallId);
      return new Set(set);
    });

    try {
      await this.firewallService.reconcile(firewallId);
    } finally {
      this.reconciling.update(set => {
        set.delete(firewallId);
        return new Set(set);
      });
    }
  }

  isReconciling(firewallId: string): boolean {
    return this.reconciling().has(firewallId);
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  }

  async refresh() {
    await this.loadFirewalls();
  }

  // Coverage helpers

  getCoverageLabel(status: CoverageStatus): string {
    return getCoverageStatusLabel(status);
  }

  getCoverageBadgeClass(status: CoverageStatus): string {
    const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
    switch (status) {
      case 'FULL':     return `${base} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`;
      case 'PARTIAL':  return `${base} bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400`;
      case 'ORPHANED': return `${base} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400`;
      default:         return `${base} bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400`;
    }
  }

  getCardClass(status: CoverageStatus): string {
    const base = 'border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer';
    switch (status) {
      case 'ORPHANED':
        return `${base} bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50`;
      case 'PARTIAL':
        return `${base} bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/50`;
      default:
        return `${base} bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700`;
    }
  }

  getNodeDotClass(status: FirewallNodeInfoDto.StatusEnum): string {
    const base = 'inline-block w-2.5 h-2.5 rounded-full';
    switch (status) {
      case 'ready':    return `${base} bg-green-500`;
      case 'creating':
      case 'joining':  return `${base} bg-blue-400`;
      case 'error':    return `${base} bg-red-500`;
      case 'deleting': return `${base} bg-gray-400`;
      default:         return `${base} bg-gray-300`;
    }
  }

  getNodeCountClass(coverage: CoverageStatus): string {
    switch (coverage) {
      case 'FULL':     return 'font-medium text-green-700 dark:text-green-400';
      case 'PARTIAL':  return 'font-medium text-orange-700 dark:text-orange-400';
      case 'ORPHANED': return 'font-medium text-red-700 dark:text-red-400';
      default:         return 'text-gray-500 dark:text-gray-400';
    }
  }

  getClusterStatusClass(status: FirewallClusterInfoDto.ClusterStatusEnum): string {
    switch (status) {
      case 'ready':    return 'text-green-600 dark:text-green-400 font-medium';
      case 'creating':
      case 'scaling':  return 'text-blue-600 dark:text-blue-400 font-medium';
      case 'error':
      case 'deletion_failed': return 'text-red-600 dark:text-red-400 font-medium';
      case 'deleting':
      case 'deleted':  return 'text-gray-500 dark:text-gray-400 font-medium';
      case 'stopped':  return 'text-yellow-600 dark:text-yellow-400 font-medium';
      default:         return 'text-gray-500 dark:text-gray-400';
    }
  }
}
