import { Component, computed, input, output, signal, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { PricingService } from '../../../shared/services/pricing.service';
import { ProviderLogoService } from '../../../shared/services/provider-logo.service';
import {
  lucideSettings,
  lucideCheck,
  lucideX,
  lucideTriangleAlert,
  lucideExternalLink,
  lucideShield,
  lucideZap,
  lucideGlobe,
  lucideHardDrive,
  lucideActivity,
  lucideClock,
  lucideMapPin,
  lucideServer,
  lucideWifi,
  lucideCalendar,
} from '@ng-icons/lucide';
import {
  ProviderConfigurationDto,
  ProviderDefinitionDto,
} from '../../../core/api';
import { ProviderStatus } from '../../model/provider.models';

@Component({
  selector: 'provider-card',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIcon],
  providers: [
    provideIcons({
      lucideSettings,
      lucideCheck,
      lucideX,
      lucideTriangleAlert,
      lucideExternalLink,
      lucideShield,
      lucideZap,
      lucideGlobe,
      lucideHardDrive,
      lucideActivity,
      lucideClock,
      lucideMapPin,
      lucideServer,
      lucideWifi,
      lucideCalendar,
    }),
  ],
  template: `
    <div
      class="group relative rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md h-full flex flex-col"
    >
      <div class="p-6 flex-1 flex flex-col">
        <!-- Header - Always the same structure -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center space-x-3">
            <div class="rounded-lg bg-muted shrink-0 flex items-center justify-center" style="width:40px;height:40px">
              @if (logoUrl()) {
                <img [src]="logoUrl()" [alt]="getProvider().displayName" width="32" height="32" style="object-fit:contain;overflow:visible;flex-shrink:0" />
              } @else {
                <ng-icon name="lucideGlobe" class="h-5 w-5 text-muted-foreground" />
              }
            </div>
            <div>
              <h3 class="font-semibold text-lg">
                {{ getProvider().displayName }}
              </h3>
              <p class="text-sm text-muted-foreground">
                {{ getProvider().description }}
              </p>
            </div>
          </div>

          <div [class]="statusBadgeClass()">
            <ng-icon [name]="statusIcon()" class="h-3 w-3" />
            <span class="text-xs font-medium">{{ statusText() }}</span>
          </div>
        </div>

        <!-- Content Area - Flexible based on configuration status -->
        <div class="flex-1 space-y-4">
          @if (isConfigured()) {
          <!-- Configuration Status Info -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground flex items-center">
                <ng-icon name="lucideMapPin" class="h-4 w-4 mr-1" />
                Active Regions
              </span>
              <span class="font-medium">
                @if (getSupportedRegionsCount() > 0) {
                  {{ getEnabledRegions().length }} of {{ getSupportedRegionsCount() }}
                } @else {
                  {{ getEnabledRegions().length }} active
                }
              </span>
            </div>

            @if (getLastHealthCheck()) {
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground flex items-center">
                <ng-icon name="lucideActivity" class="h-4 w-4 mr-1" />
                Last Health Check
              </span>
              <span class="font-medium">{{ lastHealthCheckText() }}</span>
            </div>
            }

            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground flex items-center">
                <ng-icon name="lucideCalendar" class="h-4 w-4 mr-1" />
                Configured
              </span>
              <span class="font-medium">{{ getFormattedDate(configuration()?.createdAt) }}</span>
            </div>
          </div>

          <!-- Active Regions Display -->
          @if (getEnabledRegions().length > 0) {
          <div>
            <p class="text-sm text-muted-foreground mb-2 flex items-center">
              <ng-icon name="lucideServer" class="h-4 w-4 mr-1" />
              Active Regions
            </p>
            <div class="flex flex-wrap gap-1">
              @for (regionId of getEnabledRegions(); track regionId) {
              <span
                class="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs"
              >
                {{ getRegionDisplay(regionId) }}
              </span>
              }
            </div>
          </div>
          }

          } @else {
          <!-- Non-configured provider info -->
          <div class="space-y-4">
            <!-- Available Regions -->
            @if (getSupportedRegionsCount() > 0) {
            <div>
              <p class="text-sm text-muted-foreground mb-2 flex items-center">
                <ng-icon name="lucideGlobe" class="h-4 w-4 mr-1" />
                Available Regions ({{ getSupportedRegionsCount() }})
              </p>
              <div class="flex flex-wrap gap-1">
                @for (region of getProvider().capabilities.supportedRegions.slice(0, 6); track region.id) {
                <span
                  class="inline-flex items-center px-2 py-1 rounded-md bg-muted/50 text-muted-foreground text-xs"
                >
                  {{ getRegionDisplay(region.id) }}
                </span>
                }
                @if (getSupportedRegionsCount() > 6) {
                <span class="text-xs text-muted-foreground px-2 py-1">
                  +{{ getSupportedRegionsCount() - 6 }} more
                </span>
                }
              </div>
            </div>
            }

            <!-- Credential Type -->
            @if (getCredentialType()) {
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground flex items-center">
                <ng-icon name="lucideShield" class="h-4 w-4 mr-1" />
                Authentication
              </span>
              <span class="font-medium">{{ getCredentialTypeDisplay() }}</span>
            </div>
            }

            <!-- Configuration Notice -->
            <div class="p-3 rounded-md bg-blue-50 dark:bg-blue-900/20">
              <p class="text-sm text-blue-700 dark:text-blue-300 flex items-center">
                <ng-icon name="lucideSettings" class="h-4 w-4 mr-1" />
                This provider needs to be configured before use
              </p>
            </div>
          </div>
          }

          <!-- Features Section - Always shown if available -->
          @if (featuresEnabled() && hasFeatures()) {
          <div>
            <p class="text-sm text-muted-foreground mb-2 flex items-center">
              <ng-icon name="lucideZap" class="h-4 w-4 mr-1" />
              Features
            </p>
            <div class="grid grid-cols-2 gap-2">
              @for (feature of displayFeatures(); track feature.key) {
              <div class="flex items-center space-x-2 text-xs">
                <ng-icon
                  [name]="feature.enabled ? 'lucideCheck' : 'lucideX'"
                  [class]="
                    feature.enabled
                      ? 'h-3 w-3 text-green-500'
                      : 'h-3 w-3 text-muted-foreground'
                  "
                />
                <span
                  [class]="
                    feature.enabled ? 'text-foreground' : 'text-muted-foreground'
                  "
                >
                  {{ feature.label }}
                </span>
              </div>
              }
            </div>
          </div>
          }

          <!-- Pricing Section - Always shown if available -->
          @if (hasPricing()) {
          <div class="p-3 rounded-md bg-muted/50">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-muted-foreground">Starting from</span>
              <span class="font-semibold">
                {{ monthlyPriceDisplay()?.currency }}
                {{ monthlyPriceDisplay()?.price | number:'1.2-2' }}
                <span class="text-xs text-muted-foreground">/month</span>
              </span>
            </div>

            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-xs text-muted-foreground">{{ billingCycleText() }}</span>
                @if (monthlyPriceDisplay()?.isConverted) {
                <span class="text-xs text-amber-600 dark:text-amber-400">*Estimated</span>
                }
              </div>

              @if (getProvider().pricingUrl) {
              <div class="pt-2 border-t border-border/50">
                <button
                  (click)="openPricing()"
                  class="inline-flex items-center text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
                >
                  <ng-icon name="lucideExternalLink" class="h-3 w-3 mr-1" />
                  View current pricing
                </button>
              </div>
              }
            </div>
          </div>
          }
        </div>

        <!-- Action Buttons - Always at the bottom -->
        <div class="flex space-x-2 pt-4">
          @if (!isConfigured() || getStatus() === 'not_configured') {
          <button
            (click)="configure.emit(getProvider().id)"
            class="flex-1 inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ng-icon name="lucideSettings" class="h-4 w-4 mr-2" />
            Configure
          </button>
          } @else {
          <a
            [routerLink]="['/management/providers', getProvider().id]"
            class="flex-1 inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ng-icon name="lucideSettings" class="h-4 w-4 mr-2" />
            Manage
          </a>
          }

          <button
            (click)="openDocs()"
            class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            title="View Documentation"
          >
            <ng-icon name="lucideExternalLink" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ProviderCardComponent {
  private readonly pricingService = inject(PricingService);
  private readonly providerLogo = inject(ProviderLogoService);

  configuration = input<ProviderConfigurationDto>();
  provider = input<ProviderDefinitionDto>();

  configure = output<string>();
  featuresEnabled = signal<boolean>(true); // Enable features by default

  readonly isConfigured = computed(() => !!this.configuration());

  readonly logoUrl = toSignal(
    toObservable(computed(() => this.provider()?.logoUrl ?? null)).pipe(
      switchMap((url) => this.providerLogo.resolve(url)),
    ),
    { initialValue: null as string | null },
  );

  readonly getProvider = computed(() => {
    return this.provider()!;
  });

  readonly getStatus = computed(() => {
    return this.configuration()?.status || 'not_configured';
  });

  readonly getIsActive = computed(() => {
    return this.configuration()?.isActive || false;
  });

  readonly getEnabledRegions = computed(() => {
    return this.configuration()?.enabledRegions || [];
  });

  readonly getAvailableRegions = computed(() => {
    const enabledRegions = this.getEnabledRegions();
    const allRegions =
      this.getProvider().capabilities?.supportedRegions?.map((r) => r.id) || [];
    return allRegions.filter((regionId) => !enabledRegions.includes(regionId));
  });

  readonly hasAvailableRegions = computed(() => {
    return this.getAvailableRegions().length > 0;
  });

  readonly getLastHealthCheck = computed(() => {
    const lastCheck = this.configuration()?.lastHealthCheck;
    return lastCheck ? new Date(lastCheck) : undefined;
  });

  // Add new computed properties for additional info
  readonly getCredentialType = computed(() => {
    return this.getProvider().capabilities?.credentialType;
  });

  readonly getConfigurationId = computed(() => {
    return this.configuration()?.id?.slice(0, 8); // Show first 8 chars of ID
  });

  readonly statusBadgeClass = computed(() => {
    const status = this.getStatus();
    const baseClass =
      'inline-flex items-center space-x-1 rounded-full px-2 py-1';

    switch (status) {
      case ProviderStatus.ACTIVE:
        return `${baseClass} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
      case ProviderStatus.ERROR:
        return `${baseClass} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      case ProviderStatus.CONFIGURING:
      case ProviderStatus.VALIDATING:
        return `${baseClass} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`;
      case ProviderStatus.DISABLED:
        return `${baseClass} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`;
      default:
        return `${baseClass} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`;
    }
  });

  readonly statusIcon = computed(() => {
    const status = this.getStatus();
    switch (status) {
      case ProviderStatus.ACTIVE:
        return 'lucideCheck';
      case ProviderStatus.ERROR:
        return 'lucideX';
      case ProviderStatus.CONFIGURING:
      case ProviderStatus.VALIDATING:
        return 'lucideTriangleAlert';
      default:
        return 'lucideX';
    }
  });

  readonly statusText = computed(() => {
    const status = this.getStatus();
    switch (status) {
      case ProviderStatus.ACTIVE:
        return 'Active';
      case ProviderStatus.ERROR:
        return 'Error';
      case ProviderStatus.CONFIGURING:
        return 'Configuring';
      case ProviderStatus.VALIDATING:
        return 'Validating';
      case ProviderStatus.DISABLED:
        return 'Disabled';
      case ProviderStatus.NOT_CONFIGURED:
        return 'Not Configured';
      default:
        return 'Unknown';
    }
  });

  readonly displayFeatures = computed(() => {
    const features = this.getProvider().capabilities?.features;
    if (!features) return [];

    return [
      {
        key: 'loadBalancers',
        label: 'Load Balancers',
        enabled: features.loadBalancers || false,
      },
      {
        key: 'privateNetworking',
        label: 'Private Network',
        enabled: features.privateNetworking || false,
      },
      {
        key: 'snapshots',
        label: 'Snapshots',
        enabled: features.snapshots || false,
      },
      {
        key: 'backups',
        label: 'Backups',
        enabled: features.backups || false,
      },
    ];
  });

  readonly lastHealthCheckText = computed(() => {
    const lastCheck = this.getLastHealthCheck();
    if (!lastCheck) return 'Never';

    const now = new Date();
    const diff = now.getTime() - lastCheck.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  });

  readonly monthlyPriceDisplay = computed(() => {
    const pricing = this.getProvider().capabilities?.pricing;
    if (!pricing) return null;

    const { currency, minimumCost, billingCycle } = pricing;
    let monthlyPrice = minimumCost;
    let actualBilling = billingCycle;

    // Convert hourly to monthly using shared pricing service
    if (billingCycle === 'hourly') {
      monthlyPrice = this.pricingService.calculateMonthlyPrice(minimumCost);
    }

    return {
      currency: currency || 'EUR',
      price: monthlyPrice,
      actualBilling,
      isConverted: billingCycle === 'hourly',
    };
  });

  readonly billingCycleText = computed(() => {
    const pricing = this.getProvider().capabilities?.pricing;
    if (!pricing) return '';

    switch (pricing.billingCycle) {
      case 'hourly':
        return 'Billed hourly';
      case 'monthly':
        return 'Billed monthly';
      default:
        return 'Billing varies';
    }
  });

  readonly getCredentialTypeDisplay = computed(() => {
    const type = this.getCredentialType() as string;
    switch (type) {
      case 'api_key':
        return 'API Key';
      case 'access_key_secret':
        return 'Access Key + Secret';
      case 'bearer_token':
        return 'Bearer Token';
      case 'user_password':
        return 'Username/Password';
      default:
        return type || 'Unknown';
    }
  });

  getSupportedRegionsCount(): number {
    // Prefer availableRegions from configuration (populated after setup)
    const fromConfig = (this.configuration()?.availableRegions as any[])?.length;
    if (fromConfig) return fromConfig;
    return this.getProvider().capabilities?.supportedRegions?.length || 0;
  }

  hasFeatures(): boolean {
    return this.getProvider().capabilities?.features !== undefined;
  }

  hasPricing(): boolean {
    return this.getProvider().capabilities?.pricing !== undefined;
  }

  getRegionDisplay(regionId: string): string {
    const region = this.getProvider().capabilities?.supportedRegions?.find(
      (r) => r.id === regionId
    );
    return region ? `${'🌍'} ${region.displayName || regionId}` : regionId;
  }

  openDocs(): void {
    const docUrl = this.getProvider().documentationUrl;
    if (docUrl) {
      window.open(docUrl, '_blank');
    }
  }

  openPricing(): void {
    const pricingUrl = this.getProvider().pricingUrl;
    if (pricingUrl) {
      window.open(pricingUrl, '_blank');
    }
  }

  getFormattedDate(dateString?: string): string {
    if (!dateString) return 'Unknown';

    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

    return date.toLocaleDateString();
  }
}
