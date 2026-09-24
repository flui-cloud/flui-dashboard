import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProviderManagementService } from '../../core/api/api/providerManagement.service';
import { AccessManagementService } from '../../core/api/api/accessManagement.service';
import {
  ProviderDefinitionDto,
  ProviderRegionDto,
  NodeSizeOptionDto,
  SSHKeyDto,
} from '../../core/api/model/models';
import { ProviderLogoService } from './provider-logo.service';

/**
 * Provider Option - Simplified provider info for selection
 */
export interface ProviderOption {
  id: string;
  name: string;
  displayName: string;
  logoUrl: string | null;
  regions: number;
  comingSoon?: boolean;
}

/**
 * Provider Region - Region info with availability
 */
export interface ProviderRegion {
  id: string;
  name: string;
  country: string;
  flagEmoji: string;
  available: boolean;
}

/**
 * Server Type Option - Server/Node size with pricing
 */
export interface ServerTypeOption {
  id: string;
  name: string;
  vcpu: number;
  ram: number;
  disk: number;
  storageType: 'local' | 'network';
  pricePerHour: number;
  cpuType: 'shared' | 'dedicated';
  architecture: 'x86' | 'arm';
  bareMetal: boolean;
  managedFirewall: boolean;
  supportsHourlyBilling: boolean;
  blockStoragePricePerGbMonthly: number | null; // €/GB/month, null if local storage
  availableRegionIds?: string[];
}

/**
 * Shared service for Provider Selection Wizards
 *
 * Centralizes loading logic for providers, regions, server types, and SSH keys
 * Used by Cluster Creation Wizard and Build Agent Wizard
 */
@Injectable({ providedIn: 'root' })
export class ProviderWizardService {
  private readonly providerManagementService = inject(ProviderManagementService);
  private readonly accessManagementService = inject(AccessManagementService);
  private readonly providerLogo = inject(ProviderLogoService);

  // === State Signals ===

  // Provider definitions cache (raw DTOs, keyed by provider ID)
  private readonly providerDefinitions = signal<Record<string, ProviderDefinitionDto>>({});

  // Providers
  private readonly providers = signal<ProviderOption[]>([]);
  private readonly isLoadingProviders = signal<boolean>(false);
  private readonly providersError = signal<string | null>(null);

  // Regions (keyed by provider ID)
  private readonly regions = signal<Record<string, ProviderRegion[]>>({});
  private readonly isLoadingRegions = signal<boolean>(false);
  private readonly regionsError = signal<string | null>(null);

  // Server Types (keyed by "provider:region")
  private readonly serverTypes = signal<Record<string, ServerTypeOption[]>>({});
  /**
   * Every size the provider sells, sold out or not, each with the regions it
   * can be ordered in right now — possibly none. The per-region lists above
   * keep only what can be ordered there, which suits creating a cluster and
   * hides from anyone looking at a sold-out machine that it exists at all.
   */
  private readonly catalogues = signal<Record<string, ServerTypeOption[]>>({});
  private readonly isLoadingServerTypes = signal<boolean>(false);
  private readonly serverTypesError = signal<string | null>(null);
  private readonly allRegionsLoadedFor = new Set<string>();

  // SSH Keys
  private readonly sshKeys = signal<SSHKeyDto[]>([]);
  private readonly isLoadingSshKeys = signal<boolean>(false);
  private readonly sshKeysError = signal<string | null>(null);

  // === Public Readonly Signals ===

  readonly providersData = this.providers.asReadonly();
  readonly isProviderLoading = this.isLoadingProviders.asReadonly();
  readonly providerError = this.providersError.asReadonly();

  readonly regionsData = this.regions.asReadonly();
  readonly isRegionLoading = this.isLoadingRegions.asReadonly();
  readonly regionError = this.regionsError.asReadonly();

  readonly serverTypesData = this.serverTypes.asReadonly();
  readonly isServerTypeLoading = this.isLoadingServerTypes.asReadonly();
  readonly serverTypeError = this.serverTypesError.asReadonly();

  readonly sshKeysData = this.sshKeys.asReadonly();
  readonly isSshKeyLoading = this.isLoadingSshKeys.asReadonly();
  readonly sshKeyError = this.sshKeysError.asReadonly();

  // === Provider Methods ===

  /**
   * Load available cloud providers with real region counts.
   * Provider definitions are cached; regions are pre-fetched in parallel for all enabled providers.
   */
  async loadProviders(): Promise<ProviderOption[]> {
    // Return cached data if both providers and definitions are already loaded
    const cached = this.providers();
    if (cached.length > 0 && Object.keys(this.providerDefinitions()).length > 0) {
      return cached;
    }

    this.isLoadingProviders.set(true);
    this.providersError.set(null);

    try {
      const providersDto = await firstValueFrom(
        this.providerManagementService.managementControllerGetAvailableProviders()
      );

      // Cache raw DTOs for topology/capability access
      const defsMap: Record<string, ProviderDefinitionDto> = {};
      providersDto.forEach(p => { if (p.id) defsMap[p.id] = p; });
      this.providerDefinitions.set(defsMap);

      const logoUrls = await Promise.all(
        providersDto.map((provider) => this.providerLogo.resolveUrl(provider.logoUrl))
      );
      const mappedProviders: ProviderOption[] = providersDto.map((provider, index) => ({
        id: provider.id || '',
        name: provider.displayName || provider.name || '',
        displayName: provider.displayName || provider.name || '',
        logoUrl: logoUrls[index],
        regions: 0,
        comingSoon: !(provider.enabled ?? false),
      }));
      this.providers.set(mappedProviders);

      // Pre-fetch regions in parallel for all enabled providers to populate the count.
      // Uses a silent fetch (no isLoadingRegions flag) to avoid interfering with the region
      // selection UI that depends on that signal.
      const enabledProviderIds = mappedProviders
        .filter((p) => !p.comingSoon)
        .map((p) => p.id)
        .filter(Boolean);

      if (enabledProviderIds.length > 0) {
        const regionResults = await Promise.allSettled(
          enabledProviderIds.map((id) => this.fetchRegionsSilently(id))
        );

        // Update region counts from the loaded regions
        this.providers.update((current) =>
          current.map((p) => {
            const idx = enabledProviderIds.indexOf(p.id);
            if (idx === -1) return p;
            const result = regionResults[idx];
            return {
              ...p,
              regions: result.status === 'fulfilled' ? result.value.length : 0,
            };
          })
        );
      }

      console.log('✅ [ProviderWizardService] Providers loaded:', this.providers().length);
      return this.providers();
    } catch (error: any) {
      console.error('❌ [ProviderWizardService] Failed to load providers:', error);
      this.providersError.set('Failed to load cloud providers. Please try again.');
      throw error;
    } finally {
      this.isLoadingProviders.set(false);
    }
  }

  /**
   * Get cached providers
   */
  getProviders(): ProviderOption[] {
    return this.providers();
  }

  /**
   * Get cached raw ProviderDefinitionDto for a provider (includes vnetTopology, dnsZoneDelegation, etc.)
   */
  getProviderDefinition(id: string): ProviderDefinitionDto | undefined {
    return this.providerDefinitions()[id];
  }

  // === Region Methods ===

  /**
   * Silently fetch and cache regions without touching isLoadingRegions.
   * Used during provider pre-fetch to avoid interfering with the region selection UI.
   */
  private async fetchRegionsSilently(provider: string): Promise<ProviderRegion[]> {
    const cached = this.regions()[provider];
    if (cached && cached.length > 0) return cached;

    const regionsDto = await firstValueFrom(
      this.providerManagementService.managementControllerGetProviderRegions(
        provider as 'hetzner' | 'contabo' | 'scaleway'
      )
    );

    const mappedRegions: ProviderRegion[] = (regionsDto as ProviderRegionDto[]).map(
      (region: ProviderRegionDto) => ({
        id: region.id || region.name,
        name: region.displayName || region.name,
        country: region.country || '',
        flagEmoji: region.flagEmoji || '🌍',
        available: region.available !== false,
      })
    );

    this.regions.update((current) => ({ ...current, [provider]: mappedRegions }));
    return mappedRegions;
  }

  /**
   * Load regions for a specific provider
   */
  async loadRegions(provider: string): Promise<ProviderRegion[]> {
    // Return cached data if available
    const cached = this.regions()[provider];
    if (cached && cached.length > 0) {
      return cached;
    }

    this.isLoadingRegions.set(true);
    this.regionsError.set(null);

    try {
      const regionsDto = await firstValueFrom(
        this.providerManagementService.managementControllerGetProviderRegions(
          provider as 'hetzner' | 'contabo'
        )
      );

      const mappedRegions: ProviderRegion[] = (regionsDto as ProviderRegionDto[]).map(
        (region: ProviderRegionDto) => ({
          id: region.id || region.name,
          name: region.displayName || region.name,
          country: region.country || '',
          flagEmoji: region.flagEmoji || '🌍',
          available: region.available !== false,
        })
      );

      this.regions.update((current) => ({
        ...current,
        [provider]: mappedRegions,
      }));

      console.log(`✅ [ProviderWizardService] Regions loaded for ${provider}:`, mappedRegions.length);
      return mappedRegions;
    } catch (error: any) {
      console.error(`❌ [ProviderWizardService] Failed to load regions for ${provider}:`, error);
      this.regionsError.set('Failed to load regions. Please try again.');
      throw error;
    } finally {
      this.isLoadingRegions.set(false);
    }
  }

  /**
   * Get cached regions for a provider
   */
  getRegions(provider: string): ProviderRegion[] {
    return this.regions()[provider] || [];
  }

  // === Server Type Methods ===

  /**
   * Load server types/node sizes for a provider and region
   */
  async loadServerTypes(provider: string, region: string): Promise<ServerTypeOption[]> {
    const cacheKey = `${provider}:${region}`;

    // Return cached data if available
    const cached = this.serverTypes()[cacheKey];
    if (cached && cached.length > 0) {
      return cached;
    }

    this.isLoadingServerTypes.set(true);
    this.serverTypesError.set(null);

    try {
      const nodeSizesDto = await firstValueFrom(
        this.providerManagementService.managementControllerGetProviderNodeSizes(
          provider as 'hetzner' | 'contabo',
          region  // Filter node sizes by selected region
          // skipCache omitted: metadata (CPU/RAM/price) is safe to serve from
          // the backend's 24h cache — live availability is fetched by the
          // backend unconditionally for providers that have one
        )
      );

      const mappedServerTypes = this.mapNodeSizesToServerTypes(
        nodeSizesDto,
        region
      );

      this.serverTypes.update((current) => ({
        ...current,
        [cacheKey]: mappedServerTypes,
      }));

      console.log(
        `✅ [ProviderWizardService] Server types loaded for ${provider} in ${region}:`,
        mappedServerTypes.length
      );
      return mappedServerTypes;
    } catch (error: any) {
      console.error(
        `❌ [ProviderWizardService] Failed to load server types for ${provider}:`,
        error
      );
      this.serverTypesError.set('Failed to load server types. Please try again.');
      throw error;
    } finally {
      this.isLoadingServerTypes.set(false);
    }
  }

  /**
   * Get cached server types for a provider and region
   */
  getServerTypes(provider: string, region: string): ServerTypeOption[] {
    const cacheKey = `${provider}:${region}`;
    return this.serverTypes()[cacheKey] || [];
  }

  /** Every size the provider sells, including those that cannot be ordered anywhere right now. */
  getCatalogue(provider: string): ServerTypeOption[] {
    return this.catalogues()[provider] ?? [];
  }

  async loadServerTypesAllRegions(provider: string): Promise<ProviderRegion[]> {
    const regions = await this.loadRegions(provider);

    if (this.allRegionsLoadedFor.has(provider)) {
      return regions;
    }

    this.isLoadingServerTypes.set(true);
    this.serverTypesError.set(null);

    try {
      // One request for every region instead of one PER region: the backend
      // already returns region-scoped prices/availability for the full
      // catalog, so region membership can be derived client-side.
      const nodeSizesDto = await firstValueFrom(
        this.providerManagementService.managementControllerGetProviderNodeSizes(
          provider as 'hetzner' | 'contabo'
        )
      );
      const catalog = nodeSizesDto.filter((nodeSize) => !nodeSize.deprecated);

      const regionIdsByType: Record<string, string[]> = {};
      for (const region of regions) {
        for (const nodeSize of catalog) {
          if (this.isAvailableInRegion(nodeSize, region.id)) {
            (regionIdsByType[nodeSize.id] ??= []).push(region.id);
          }
        }
      }

      const updates: Record<string, ServerTypeOption[]> = {};
      for (const region of regions) {
        const availableInRegion = catalog.filter((nodeSize) =>
          this.isAvailableInRegion(nodeSize, region.id)
        );
        updates[`${provider}:${region.id}`] = this.mapNodeSizesToServerTypes(
          availableInRegion,
          region.id
        ).map((serverType) => ({
          ...serverType,
          availableRegionIds: regionIdsByType[serverType.id] ?? [region.id],
        }));
      }

      this.serverTypes.update((current) => ({ ...current, ...updates }));
      this.catalogues.update((current) => ({
        ...current,
        [provider]: this.mapNodeSizesToServerTypes(catalog, regions[0]?.id ?? '').map(
          (serverType) => ({
            ...serverType,
            availableRegionIds: regionIdsByType[serverType.id] ?? [],
          })
        ),
      }));
      this.serverTypesError.set(null);
      this.allRegionsLoadedFor.add(provider);

      return regions;
    } catch (error) {
      console.error(
        `❌ [ProviderWizardService] Failed to load server types for ${provider}:`,
        error
      );
      this.serverTypesError.set('Failed to load server types. Please try again.');
      throw error;
    } finally {
      this.isLoadingServerTypes.set(false);
    }
  }

  /** Mirrors the region-availability rule management.service.ts applies server-side for a single region. */
  private isAvailableInRegion(nodeSize: NodeSizeOptionDto, region: string): boolean {
    if (!nodeSize.availability || !Array.isArray(nodeSize.availability)) {
      const location = nodeSize.locations?.find((loc) => loc.name === region);
      if (!location) return false;
      if (!location.deprecation) return true;
      return new Date() < new Date(location.deprecation.unavailable_after);
    }

    const locationAvailability = nodeSize.availability.find((av) => av.location === region);
    if (!locationAvailability) return false;

    if (locationAvailability.deprecated) {
      const location = nodeSize.locations?.find((loc) => loc.name === region);
      if (location?.deprecation && new Date() >= new Date(location.deprecation.unavailable_after)) {
        return false;
      }
    }

    return locationAvailability.available;
  }

  /**
   * Map NodeSizeOptionDto to ServerTypeOption
   */
  private mapNodeSizesToServerTypes(
    nodeSizes: NodeSizeOptionDto[],
    region: string
  ): ServerTypeOption[] {
    return nodeSizes
      .filter((nodeSize) => !nodeSize.deprecated)
      .map((nodeSize) => {
        // Find price for selected region
        const priceForRegion = nodeSize.prices.find((p) => p.location === region);
        const price = priceForRegion || nodeSize.prices[0];
        const pricePerHour = price?.priceHourly?.net ? Number.parseFloat(price.priceHourly.net) : 0;

        return {
          id: nodeSize.id,
          name: nodeSize.name,
          vcpu: nodeSize.cores,
          ram: nodeSize.memory,
          disk: nodeSize.disk,
          storageType: (nodeSize.storageType as 'local' | 'network') ?? 'network',
          pricePerHour: pricePerHour,
          cpuType: nodeSize.cpuType,
          architecture: nodeSize.architecture,
          bareMetal: nodeSize.bareMetal ?? false,
          managedFirewall: nodeSize.managedFirewall ?? false,
          supportsHourlyBilling: nodeSize.supportsHourlyBilling ?? true,
          blockStoragePricePerGbMonthly: nodeSize.blockStoragePricePerGbMonthly
            ? Number.parseFloat(nodeSize.blockStoragePricePerGbMonthly)
            : null,
        };
      })
      .sort((a, b) => a.pricePerHour - b.pricePerHour);
  }

  // === SSH Key Methods ===

  /**
   * Load SSH keys
   */
  async loadSshKeys(): Promise<SSHKeyDto[]> {
    // Always reload SSH keys to ensure fresh data
    this.isLoadingSshKeys.set(true);
    this.sshKeysError.set(null);

    try {
      const keys = await firstValueFrom(
        this.accessManagementService.accessControllerListSSHKeys()
      );

      this.sshKeys.set(keys);
      console.log('✅ [ProviderWizardService] SSH keys loaded:', keys.length);
      return keys;
    } catch (error: any) {
      console.error('❌ [ProviderWizardService] Failed to load SSH keys:', error);
      this.sshKeysError.set('Failed to load SSH keys. Please try again.');
      throw error;
    } finally {
      this.isLoadingSshKeys.set(false);
    }
  }

  /**
   * Create a new SSH key
   */
  async createSshKey(name: string, userName: string, providers?: string[], tags?: Record<string, any>): Promise<SSHKeyDto> {
    this.isLoadingSshKeys.set(true);
    this.sshKeysError.set(null);

    try {
      const newKey = await firstValueFrom(
        this.accessManagementService.accessControllerAddSSHKey({
          name,
          userName,
          tags: tags || {},
          ...(providers && providers.length > 0 ? { providers: providers as any[] } : {}),
        })
      );

      // Add to local cache
      this.sshKeys.update((keys) => [...keys, newKey]);
      console.log('✅ [ProviderWizardService] SSH key created:', newKey.name);
      return newKey;
    } catch (error: any) {
      console.error('❌ [ProviderWizardService] Failed to create SSH key:', error);
      this.sshKeysError.set('Failed to create SSH key. Please try again.');
      throw error;
    } finally {
      this.isLoadingSshKeys.set(false);
    }
  }

  /**
   * Update SSH key tags
   */
  async updateSshKeyTags(keyId: string, tags: Record<string, any>): Promise<SSHKeyDto> {
    try {
      const updated = await firstValueFrom(
        this.accessManagementService.accessControllerUpdateSSHKey(keyId, { tags })
      );

      // Update local cache
      this.sshKeys.update((keys) =>
        keys.map((key) => (key.id === keyId ? { ...key, tags } : key))
      );

      console.log('✅ [ProviderWizardService] SSH key tags updated:', keyId);
      return updated;
    } catch (error: any) {
      console.error('❌ [ProviderWizardService] Failed to update SSH key tags:', error);
      throw error;
    }
  }

  /**
   * Get cached SSH keys
   */
  getSshKeys(): SSHKeyDto[]  {
    return this.sshKeys();
  }

  // === Cache Management ===

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.providers.set([]);
    this.regions.set({});
    this.serverTypes.set({});
    this.allRegionsLoadedFor.clear();
    this.sshKeys.set([]);
    console.log('🗑️ [ProviderWizardService] Cache cleared');
  }

  /**
   * Clear cache for a specific provider
   */
  clearProviderCache(provider: string): void {
    this.regions.update((current) => {
      const { [provider]: _, ...rest } = current;
      return rest;
    });

    // Clear server types for this provider
    this.serverTypes.update((current) => {
      const filtered: Record<string, ServerTypeOption[]> = {};
      Object.keys(current).forEach((key) => {
        if (!key.startsWith(`${provider}:`)) {
          filtered[key] = current[key];
        }
      });
      return filtered;
    });

    this.allRegionsLoadedFor.delete(provider);

    console.log(`🗑️ [ProviderWizardService] Cache cleared for provider: ${provider}`);
  }

  /**
   * Clear SSH keys cache
   */
  clearSshKeysCache(): void {
    this.sshKeys.set([]);
    console.log('🗑️ [ProviderWizardService] SSH keys cache cleared');
  }
}
