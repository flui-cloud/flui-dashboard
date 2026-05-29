import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ProviderFirewallsService, ProviderManagementService } from '../../core/api/api/api';
import { ProviderFirewallResponseDto } from '../../core/api/model/models';
import {
  ProviderFirewallExtended,
  ProviderFirewallStats,
} from '../model/firewall.models';

/**
 * Service for managing provider firewalls (emergency use only).
 * For normal firewall operations, use FirewallV2Service.
 */
@Injectable({
  providedIn: 'root',
})
export class FirewallService {
  private readonly providerFirewallsApi = inject(ProviderFirewallsService);
  private readonly providerManagementApi = inject(ProviderManagementService);

  // Provider Firewalls State
  private readonly providerFirewalls = signal<ProviderFirewallExtended[]>([]);
  private readonly isLoadingProviderFirewalls = signal(false);
  private readonly providerFirewallsError = signal<string | null>(null);

  // Public Readonly Signals
  readonly allProviderFirewalls = this.providerFirewalls.asReadonly();
  readonly loadingProviderFirewalls =
    this.isLoadingProviderFirewalls.asReadonly();
  readonly providerFirewallsErrorMessage =
    this.providerFirewallsError.asReadonly();

  /**
   * Check if a firewall is a control-cluster firewall
   */
  private isObservabilityFirewall(fw: ProviderFirewallExtended): boolean {
    return fw.labels?.['flui-cluster-type'] === 'control' || fw.labels?.['flui-cluster-type'] === 'observability';
  }

  /**
   * Get effective "inUse" status for a firewall.
   * Control-cluster firewalls are always considered in use.
   */
  private isFirewallInUse(fw: ProviderFirewallExtended): boolean {
    return this.isObservabilityFirewall(fw) || fw.inUse;
  }

  // Computed Signals
  readonly inUseProviderFirewalls = computed(() =>
    this.providerFirewalls().filter((fw) => this.isFirewallInUse(fw))
  );

  readonly unusedProviderFirewalls = computed(() =>
    this.providerFirewalls().filter((fw) => !this.isFirewallInUse(fw))
  );

  readonly providerFirewallStats = computed<ProviderFirewallStats>(() => {
    const all = this.providerFirewalls();
    const byProvider: Record<string, number> = {};

    all.forEach((fw) => {
      byProvider[fw.provider] = (byProvider[fw.provider] || 0) + 1;
    });

    return {
      total: all.length,
      inUse: this.inUseProviderFirewalls().length,
      unused: this.unusedProviderFirewalls().length,
      byProvider,
    };
  });

  /**
   * Load provider firewalls from all providers
   */
  async loadProviderFirewalls(filters?: {
    provider?: string;
    clusterId?: string;
  }): Promise<void> {
    this.isLoadingProviderFirewalls.set(true);
    this.providerFirewallsError.set(null);

    try {
      let providers: string[];
      if (filters?.provider) {
        providers = [filters.provider];
      } else {
        // Fetch active provider configurations directly to avoid calling
        // non-configured providers (which would crash)
        const configurations = await firstValueFrom(
          this.providerManagementApi.managementControllerGetUserProviderConfigurations()
        );
        providers = configurations
          .filter(c => c.status === 'active')
          .map(c => c.provider as string);
      }

      if (providers.length === 0) {
        this.providerFirewalls.set([]);
        return;
      }

      // Fetch firewalls from all active providers in parallel
      const results = await Promise.all(
        providers.map(async (provider) => {
          try {
            const firewalls = await firstValueFrom(
              this.providerFirewallsApi.providerFirewallsControllerListFirewalls(
                provider as any,
                undefined,
                undefined,
                filters?.clusterId
              )
            );
            return firewalls.map((fw) =>
              this.extendProviderFirewall(fw, provider)
            );
          } catch (error) {
            console.error(`Error loading ${provider} firewalls:`, error);
            return [];
          }
        })
      );

      // Flatten and set results
      const allFirewalls = results.flat();
      this.providerFirewalls.set(allFirewalls);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to load provider firewalls';
      this.providerFirewallsError.set(errorMessage);
      console.error('Error loading provider firewalls:', error);
    } finally {
      this.isLoadingProviderFirewalls.set(false);
    }
  }

  /**
   * Delete a provider firewall
   */
  async deleteProviderFirewall(
    provider: string,
    id: string
  ): Promise<void> {
    this.isLoadingProviderFirewalls.set(true);
    this.providerFirewallsError.set(null);

    try {
      await firstValueFrom(
        this.providerFirewallsApi.providerFirewallsControllerDeleteFirewall(
          provider as any,
          id,
          true // confirm parameter
        )
      );

      // Remove from local state
      this.providerFirewalls.update((current) =>
        current.filter((fw) => fw.id !== id)
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to delete provider firewall';
      this.providerFirewallsError.set(errorMessage);
      console.error('Error deleting provider firewall:', error);
      throw error;
    } finally {
      this.isLoadingProviderFirewalls.set(false);
    }
  }

  /**
   * Extend provider firewall DTO with additional metadata
   */
  private extendProviderFirewall(
    fw: ProviderFirewallResponseDto,
    provider: string
  ): ProviderFirewallExtended {
    // Extract cluster info from labels
    const labels = (fw.labels || {}) as Record<string, string>;
    const clusterId = labels['flui-cluster-id'];
    const clusterName = labels['flui-cluster-name'];

    return {
      id: fw.id,
      name: fw.name,
      provider,
      rules: fw.rules,
      labels: (fw.labels || {}) as Record<string, unknown>,
      appliedServers: fw.appliedServers,
      inUse: !!clusterId && fw.appliedServers.length > 0,
      clusterId,
      clusterName,
    };
  }
}
