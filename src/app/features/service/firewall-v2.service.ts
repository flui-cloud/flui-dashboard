/**
 * Firewall V2 Service - Desired-State Management
 *
 * This service manages cluster firewalls using the new v2 API with desired-state reconciliation.
 * It replaces the old template/attachment-based approach with direct rule management.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FirewallsService } from '../../core/api/api/firewalls.service';
import {
  FirewallResponseDto,
  ReconciliationStatusDto,
  UpdateFirewallRulesDto
} from '../../core/api/model/models';
import {
  ReconciliationStatus,
  FirewallExtended,
  FirewallStats,
  FirewallFilterState,
  FirewallRuleFormData,
  calculateFirewallStats,
  getStatusBadgeColor,
  getStatusBadgeLabel,
  getDriftIndicator,
  convertRuleFormDataToResponse
} from '../model/firewall-v2.models';

@Injectable({
  providedIn: 'root'
})
export class FirewallV2Service {
  private readonly firewallsService = inject(FirewallsService);

  // State signals
  private readonly firewallsData = signal<FirewallResponseDto[]>([]);
  private readonly loadingData = signal<boolean>(false);
  private readonly errorData = signal<string | null>(null);
  private readonly selectedFirewallData = signal<FirewallResponseDto | null>(null);
  private readonly reconciliationStatusData = signal<ReconciliationStatusDto | null>(null);
  private readonly filterData = signal<FirewallFilterState>({
    search: '',
    status: undefined,
    clusterId: undefined
  });

  // Public readonly signals
  readonly firewalls = this.firewallsData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly selectedFirewall = this.selectedFirewallData.asReadonly();
  readonly reconciliationStatus = this.reconciliationStatusData.asReadonly();
  readonly filter = this.filterData.asReadonly();

  // Computed signals
  readonly filteredFirewalls = computed(() => {
    const firewalls = this.firewallsData();
    const filter = this.filterData();

    let filtered = firewalls;

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(
        fw =>
          fw.id.toLowerCase().includes(searchLower) ||
          fw.clusterId.toLowerCase().includes(searchLower) ||
          (fw.clusterInfo?.clusterName?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    if (filter.status) {
      filtered = filtered.filter(fw => fw.reconciliationStatus === filter.status);
    }

    if (filter.clusterId) {
      filtered = filtered.filter(fw => fw.clusterId === filter.clusterId);
    }

    if (filter.coverage) {
      filtered = filtered.filter(fw => fw.coverageStatus === filter.coverage);
    }

    return filtered;
  });

  readonly extendedFirewalls = computed((): FirewallExtended[] => {
    return this.filteredFirewalls().map(fw => this.extendFirewall(fw));
  });

  readonly stats = computed((): FirewallStats => {
    return calculateFirewallStats(this.firewallsData());
  });

  readonly hasFirewalls = computed(() => this.firewallsData().length > 0);
  readonly hasError = computed(() => !!this.errorData());
  readonly isLoading = computed(() => this.loadingData());

  /**
   * Load all firewalls with optional filters
   */
  async loadFirewalls(filters?: { clusterId?: string; status?: ReconciliationStatus }): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);

    try {
      const firewalls = await firstValueFrom(
        this.firewallsService.clusterFirewallsControllerListFirewalls(
          filters?.clusterId,
          filters?.status
        )
      );

      this.firewallsData.set(firewalls);
    } catch (error: any) {
      console.error('Error loading firewalls:', error);
      this.errorData.set(error?.message || 'Failed to load firewalls');
    } finally {
      this.loadingData.set(false);
    }
  }

  /**
   * Get firewall by ID
   */
  async getFirewall(id: string): Promise<FirewallResponseDto | null> {
    this.loadingData.set(true);
    this.errorData.set(null);

    try {
      const firewall = await firstValueFrom(
        this.firewallsService.clusterFirewallsControllerGetFirewall(id)
      );

      this.selectedFirewallData.set(firewall);
      return firewall;
    } catch (error: any) {
      console.error('Error loading firewall:', error);
      this.errorData.set(error?.message || 'Failed to load firewall');
      return null;
    } finally {
      this.loadingData.set(false);
    }
  }

  /**
   * Get firewall by cluster ID
   */
  async getFirewallByCluster(clusterId: string): Promise<FirewallResponseDto | null> {
    this.loadingData.set(true);
    this.errorData.set(null);

    try {
      const firewall = await firstValueFrom(
        this.firewallsService.clusterFirewallsControllerGetFirewallByCluster(clusterId)
      );

      this.selectedFirewallData.set(firewall);
      return firewall;
    } catch (error: any) {
      console.error('Error loading firewall by cluster:', error);

      // 404 is expected if cluster has no firewall
      if (error?.status === 404) {
        this.selectedFirewallData.set(null);
        return null;
      }

      this.errorData.set(error?.message || 'Failed to load firewall');
      return null;
    } finally {
      this.loadingData.set(false);
    }
  }

  /**
   * Update desired firewall rules (does not apply to provider)
   * This will set the firewall status to DRIFT if rules differ from applied
   */
  async updateDesiredRules(id: string, rules: FirewallRuleFormData[]): Promise<FirewallResponseDto | null> {
    this.loadingData.set(true);
    this.errorData.set(null);

    try {
      const desiredRules = rules.map(convertRuleFormDataToResponse);
      const dto: UpdateFirewallRulesDto = {
        desiredRules: desiredRules as any[]
      };

      const updatedFirewall = await firstValueFrom(
        this.firewallsService.clusterFirewallsControllerUpdateDesiredRules(id, dto)
      );

      this.selectedFirewallData.set(updatedFirewall);
      this.updateFirewallInList(updatedFirewall);

      return updatedFirewall;
    } catch (error: any) {
      console.error('Error updating desired rules:', error);
      this.errorData.set(error?.message || 'Failed to update desired rules');
      return null;
    } finally {
      this.loadingData.set(false);
    }
  }

  /**
   * Trigger reconciliation - applies desired state to provider
   */
  async reconcile(id: string): Promise<FirewallResponseDto | null> {
    this.loadingData.set(true);
    this.errorData.set(null);

    try {
      const reconciledFirewall = await firstValueFrom(
        this.firewallsService.clusterFirewallsControllerReconcile(id)
      );

      this.selectedFirewallData.set(reconciledFirewall);
      this.updateFirewallInList(reconciledFirewall);

      return reconciledFirewall;
    } catch (error: any) {
      console.error('Error reconciling firewall:', error);
      this.errorData.set(error?.message || 'Failed to reconcile firewall');
      return null;
    } finally {
      this.loadingData.set(false);
    }
  }

  /**
   * Get reconciliation status (lightweight endpoint)
   */
  async getReconciliationStatus(id: string): Promise<ReconciliationStatusDto | null> {
    try {
      const status = await firstValueFrom(
        this.firewallsService.clusterFirewallsControllerGetReconciliationStatus(id)
      );

      this.reconciliationStatusData.set(status);
      return status;
    } catch (error: any) {
      console.error('Error loading reconciliation status:', error);
      return null;
    }
  }

  /**
   * Delete firewall
   * Warning: This will leave the cluster unprotected
   */
  async deleteFirewall(id: string): Promise<boolean> {
    this.loadingData.set(true);
    this.errorData.set(null);

    try {
      await firstValueFrom(
        this.firewallsService.clusterFirewallsControllerDeleteFirewall(id)
      );

      const updated = this.firewallsData().filter(fw => fw.id !== id);
      this.firewallsData.set(updated);

      if (this.selectedFirewallData()?.id === id) {
        this.selectedFirewallData.set(null);
      }

      return true;
    } catch (error: any) {
      console.error('Error deleting firewall:', error);
      this.errorData.set(error?.message || 'Failed to delete firewall');
      return false;
    } finally {
      this.loadingData.set(false);
    }
  }

  /**
   * Update filter
   */
  updateFilter(filter: Partial<FirewallFilterState>): void {
    this.filterData.update(current => ({
      ...current,
      ...filter
    }));
  }

  /**
   * Clear filter
   */
  clearFilter(): void {
    this.filterData.set({
      search: '',
      status: undefined,
      clusterId: undefined,
      coverage: undefined
    });
  }

  /**
   * Clear selected firewall
   */
  clearSelectedFirewall(): void {
    this.selectedFirewallData.set(null);
    this.reconciliationStatusData.set(null);
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.errorData.set(null);
  }

  /**
   * Reload current firewall
   */
  async reloadSelectedFirewall(): Promise<void> {
    const current = this.selectedFirewallData();
    if (current) {
      await this.getFirewall(current.id);
    }
  }

  /**
   * Poll reconciliation status until complete or timeout
   * Returns true if reconciliation completed successfully
   */
  async pollReconciliation(id: string, timeoutMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getReconciliationStatus(id);

      if (!status) {
        return false;
      }

      // Check if reconciliation is complete
      if (status.status === ReconciliationStatus.IN_SYNC) {
        // Reload full firewall data
        await this.getFirewall(id);
        return true;
      }

      if (status.status === ReconciliationStatus.ERROR) {
        // Reload full firewall data to get error message
        await this.getFirewall(id);
        return false;
      }

      // Still reconciling, wait and poll again
      await this.delay(pollInterval);
    }

    // Timeout reached
    return false;
  }

  // Private helper methods

  /**
   * Update a firewall in the list
   */
  private updateFirewallInList(updatedFirewall: FirewallResponseDto): void {
    this.firewallsData.update(firewalls => {
      const index = firewalls.findIndex(fw => fw.id === updatedFirewall.id);
      if (index !== -1) {
        const updated = [...firewalls];
        updated[index] = updatedFirewall;
        return updated;
      }
      // If not found, add it
      return [...firewalls, updatedFirewall];
    });
  }

  /**
   * Extend firewall with computed UI fields
   */
  private extendFirewall(firewall: FirewallResponseDto): FirewallExtended {
    const status = firewall.reconciliationStatus as ReconciliationStatus;

    return {
      ...firewall,
      statusBadgeColor: getStatusBadgeColor(status),
      statusBadgeLabel: getStatusBadgeLabel(status),
      driftIndicator: getDriftIndicator(firewall.hasDrift, status)
    };
  }

  /**
   * Delay helper for polling
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
