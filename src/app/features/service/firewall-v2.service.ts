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

  readonly firewalls = this.firewallsData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly selectedFirewall = this.selectedFirewallData.asReadonly();
  readonly reconciliationStatus = this.reconciliationStatusData.asReadonly();
  readonly filter = this.filterData.asReadonly();

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

  async enableForCluster(clusterId: string): Promise<FirewallResponseDto | null> {
    this.loadingData.set(true);
    this.errorData.set(null);

    try {
      const firewall = await firstValueFrom(
        this.firewallsService.clusterFirewallsControllerEnableForCluster(clusterId)
      );

      this.selectedFirewallData.set(firewall);
      this.updateFirewallInList(firewall);

      return firewall;
    } catch (error: any) {
      console.error('Error enabling firewall for cluster:', error);
      this.errorData.set(error?.message || 'Failed to enable firewall');
      return null;
    } finally {
      this.loadingData.set(false);
    }
  }

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

  updateFilter(filter: Partial<FirewallFilterState>): void {
    this.filterData.update(current => ({
      ...current,
      ...filter
    }));
  }

  clearFilter(): void {
    this.filterData.set({
      search: '',
      status: undefined,
      clusterId: undefined,
      coverage: undefined
    });
  }

  clearSelectedFirewall(): void {
    this.selectedFirewallData.set(null);
    this.reconciliationStatusData.set(null);
  }

  clearError(): void {
    this.errorData.set(null);
  }

  async reloadSelectedFirewall(): Promise<void> {
    const current = this.selectedFirewallData();
    if (current) {
      await this.getFirewall(current.id);
    }
  }

  async pollReconciliation(id: string, timeoutMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getReconciliationStatus(id);

      if (!status) {
        return false;
      }

      if (status.status === ReconciliationStatus.IN_SYNC) {
        await this.getFirewall(id);
        return true;
      }

      if (status.status === ReconciliationStatus.ERROR) {
        await this.getFirewall(id);
        return false;
      }

      await this.delay(pollInterval);
    }

    return false;
  }

  private updateFirewallInList(updatedFirewall: FirewallResponseDto): void {
    this.firewallsData.update(firewalls => {
      const index = firewalls.findIndex(fw => fw.id === updatedFirewall.id);
      if (index !== -1) {
        const updated = [...firewalls];
        updated[index] = updatedFirewall;
        return updated;
      }
      return [...firewalls, updatedFirewall];
    });
  }

  private extendFirewall(firewall: FirewallResponseDto): FirewallExtended {
    const status = firewall.reconciliationStatus as ReconciliationStatus;

    return {
      ...firewall,
      statusBadgeColor: getStatusBadgeColor(status),
      statusBadgeLabel: getStatusBadgeLabel(status),
      driftIndicator: getDriftIndicator(firewall.hasDrift, status)
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
