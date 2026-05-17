import { Injectable, signal, computed } from '@angular/core';
import { catchError, map, of, tap, Observable } from 'rxjs';
import {
  ProviderManagementService,
  ProviderDefinitionDto,
  ProviderConfigurationDto,
  ConfigureProviderDto,
  ValidationResultDto,
  ProviderCredentialsDto,
  EnableProviderDto,
  UpdateCredentialsExpiryDto,
  UpdateProviderRegionsDto,
} from '../../core/api';
import {
  ProviderStatus,
  HealthStatus,
} from '../model/provider.models';

@Injectable({ providedIn: 'root' })
export class ProvidersService {
  private readonly providers = signal<ProviderDefinitionDto[]>([]);
  private readonly configurations = signal<ProviderConfigurationDto[]>([]);
  private readonly loading = signal<boolean>(false);

  readonly availableProviders = computed(() => this.providers());
  readonly configuredProviders = computed(() => this.configurations());
  readonly activeProviders = computed(() =>
    this.configurations().filter(
      (config) => config.status === ProviderStatus.ACTIVE
    )
  );
  readonly isLoading = computed(() => this.loading());

  constructor(private readonly providerManagementService: ProviderManagementService) {}

  loadProviders(): void {
    this.loading.set(true);

    this.providerManagementService
      .managementControllerGetAvailableProviders()
      .pipe(
        catchError((error) => {
          console.error('Failed to load providers:', error);
          this.loading.set(false);
          return of([]);
        })
      )
      .subscribe({
        next: (providers) => {
          this.providers.set(providers);
          this.loading.set(false);
        },
      });
  }

  loadConfigurations(): void {
    this.loadConfigurations$().subscribe();
  }

  loadConfigurations$(): Observable<ProviderConfigurationDto[]> {
    this.loading.set(true);
    return this.providerManagementService
      .managementControllerGetUserProviderConfigurations()
      .pipe(
        tap((configurations) => {
          this.configurations.set(configurations);
          this.loading.set(false);
        }),
        catchError((error) => {
          console.error('Failed to load configurations:', error);
          this.loading.set(false);
          return of([]);
        })
      );
  }

  getProviderById(id: string): ProviderDefinitionDto | undefined {
    return this.providers().find((p) => p.id === id);
  }

  getConfigurationByProvider(
    providerId: string
  ): ProviderConfigurationDto | undefined {
    return this.configurations().find((c) => c.provider === providerId);
  }

  validateProvider(
    providerId: string,
    credentials: ProviderCredentialsDto
  ): Promise<ValidationResultDto> {
    return new Promise((resolve, reject) => {
      this.providerManagementService
        .managementControllerValidateProvider(
          providerId as any,
          credentials
        )
        .pipe(
          catchError((error) => {
            console.error('Validation failed:', error);
            reject(error);
            return of(null);
          })
        )
        .subscribe({
          next: (result) => { if (result) resolve(result); },
        });
    });
  }

  configureProvider(
    providerId: string,
    config: { credentials: ProviderCredentialsDto; enabledRegions: string[] }
  ): Promise<ProviderConfigurationDto> {
    return new Promise((resolve, reject) => {
      const configDto: ConfigureProviderDto = {
        provider: providerId as any,
        credentials: config.credentials,
        enabledRegions: config.enabledRegions,
        additionalConfig: {},
      };

      this.providerManagementService
        .managementControllerConfigureProvider(
          providerId as any,
          configDto
        )
        .pipe(
          catchError((error) => {
            console.error('Failed to configure provider:', error);
            reject(error);
            return of(null);
          })
        )
        .subscribe({
          next: (newConfig) => {
            if (newConfig) {
              // Update the local configurations
              this.configurations.update((configs) => [...configs, newConfig]);
              resolve(newConfig);
            } else {
              reject(new Error('Failed to create provider configuration'));
            }
          },
        });
    });
  }

  toggleProvider(providerId: string, enableProvider: EnableProviderDto): Promise<void> {
    return new Promise((resolve, reject) => {
      const currentConfig = this.getConfigurationByProvider(providerId);
      if (!currentConfig) {
        resolve();
        return;
      }

      this.providerManagementService
        .managementControllerEnableProvider(providerId as any, enableProvider)
        .pipe(
          catchError((error) => {
            console.error('Failed to toggle provider:', error);
            reject(error);
            return of(null);
          })
        )
        .subscribe({
          next: (updatedConfig) => {
            if (updatedConfig) {
              const currentConfigs = this.configurations();
              const configIndex = currentConfigs.findIndex(
                (c) => c.provider === providerId
              );

              if (configIndex >= 0) {
                currentConfigs[configIndex] = updatedConfig;
                this.configurations.set([...currentConfigs]);
              }
            }
            resolve();
          },
        });
    });
  }

  rotateCredentials(providerId: string, credentials: ProviderCredentialsDto): Promise<ProviderConfigurationDto> {
    return new Promise((resolve, reject) => {
      this.providerManagementService
        .managementControllerRotateProviderCredentials(providerId as any, credentials)
        .pipe(catchError((error) => { reject(error); return of(null); }))
        .subscribe({ next: (config) => { if (config) { this.updateConfigInState(config); resolve(config); } } });
    });
  }

  updateCredentialsExpiry(providerId: string, dto: UpdateCredentialsExpiryDto): Promise<ProviderConfigurationDto> {
    return new Promise((resolve, reject) => {
      this.providerManagementService
        .managementControllerUpdateProviderCredentialsExpiry(providerId as any, dto)
        .pipe(catchError((error) => { reject(error); return of(null); }))
        .subscribe({ next: (config) => { if (config) { this.updateConfigInState(config); resolve(config); } } });
    });
  }

  updateRegions(providerId: string, dto: UpdateProviderRegionsDto): Promise<ProviderConfigurationDto> {
    return new Promise((resolve, reject) => {
      this.providerManagementService
        .managementControllerUpdateProviderRegions(providerId as any, dto)
        .pipe(catchError((error) => { reject(error); return of(null); }))
        .subscribe({ next: (config) => { if (config) { this.updateConfigInState(config); resolve(config); } } });
    });
  }

  private updateConfigInState(updated: ProviderConfigurationDto): void {
    this.configurations.update((configs) => {
      const idx = configs.findIndex((c) => c.provider === updated.provider);
      if (idx >= 0) {
        const next = [...configs];
        next[idx] = updated;
        return next;
      }
      return [...configs, updated];
    });
  }

  removeProvider(providerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.providerManagementService
        .managementControllerRemoveProviderConfiguration(providerId as any)
        .pipe(
          catchError((error) => {
            console.error('Failed to remove provider configuration:', error);
            reject(error);
            return of(null);
          })
        )
        .subscribe({
          next: () => {
            this.configurations.update((configs) =>
              configs.filter((c) => c.provider !== providerId)
            );
            resolve();
          },
        });
    });
  }

  getProviderHealth(providerId: string): Promise<HealthStatus> {
    return new Promise((resolve, reject) => {
      this.providerManagementService
        .managementControllerGetProviderHealth(providerId as any)
        .pipe(
          map((healthDto) => ({
            status: healthDto.status as 'healthy' | 'degraded' | 'unhealthy',
            lastCheck: new Date(healthDto.lastCheck),
            responseTime: healthDto.responseTime,
            errors: healthDto.errorMessage
              ? [healthDto.errorMessage]
              : undefined,
          })),
          catchError((error) => {
            console.error('Failed to get provider health:', error);
            reject(error);
            return of(null);
          })
        )
        .subscribe({
          next: (healthStatus) => {
            if (healthStatus) resolve(healthStatus);
          },
        });
    });
  }

  getProviderRegions(providerId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.providerManagementService
        .managementControllerGetProviderRegions(providerId as any)
        .pipe(
          catchError((error) => {
            console.error('Failed to get provider regions:', error);
            reject(error);
            return of([]);
          })
        )
        .subscribe({
          next: (regions) => resolve(regions),
        });
    });
  }

  getProviderInstanceTypes(providerId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.providerManagementService
        .managementControllerGetProviderInstanceTypes(
          providerId as any
        )
        .pipe(
          catchError((error) => {
            console.error('Failed to get provider instance types:', error);
            reject(error);
            return of([]);
          })
        )
        .subscribe({
          next: (instanceTypes) => resolve(instanceTypes),
        });
    });
  }
}
