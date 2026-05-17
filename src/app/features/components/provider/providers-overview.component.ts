import {
  Component,
  computed,
  inject,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideFilter,
  lucidePlus,
  lucideRefreshCw,
  lucideSettings,
  lucideActivity,
  lucideTriangleAlert,
  lucideCheck,
  lucideChartBar,
} from '@ng-icons/lucide';
import { ProviderCardComponent } from './provider-card.component';
import { ProviderStatus } from '../../model/provider.models';
import { ProvidersService } from '../../service/providers.service';
import { ProviderManagementService, ProviderDefinitionDto } from '../../../core/api';

interface ProviderItem {
  type: 'available' | 'configured';
  data: any;
  id: string;
}

@Component({
  selector: 'providers-overview',
  standalone: true,
  imports: [CommonModule, NgIcon, ProviderCardComponent],
  providers: [
    provideIcons({
      lucideSearch,
      lucideFilter,
      lucidePlus,
      lucideRefreshCw,
      lucideSettings,
      lucideActivity,
      lucideTriangleAlert,
      lucideCheck,
      lucideChartBar,
    }),
  ],
  template: `
    <div class="space-y-6">
      <div
        class="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0"
      >
        <div>
          <h1 class="text-3xl font-bold tracking-tight">Cloud Providers</h1>
          <p class="text-muted-foreground">
            Manage your cloud provider integrations and configurations
          </p>
        </div>
        <div class="flex items-center space-x-2">
          <button
            (click)="refreshProviders()"
            [disabled]="providersService.isLoading()"
            class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ng-icon
              name="lucideRefreshCw"
              [class]="
                providersService.isLoading()
                  ? 'h-4 w-4 mr-2 animate-spin'
                  : 'h-4 w-4 mr-2'
              "
            />
            Refresh
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div class="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div class="flex items-center space-x-2">
            <ng-icon name="lucideActivity" class="h-5 w-5 text-blue-500" />
            <h3 class="text-sm font-medium text-muted-foreground">
              Total Providers
            </h3>
          </div>
          <p class="text-2xl font-bold">
            {{ providersService.availableProviders().length }}
          </p>
        </div>

        <div class="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div class="flex items-center space-x-2">
            <ng-icon name="lucideCheck" class="h-5 w-5 text-green-500" />
            <h3 class="text-sm font-medium text-muted-foreground">Active</h3>
          </div>
          <p class="text-2xl font-bold">{{ activeProvidersCount() }}</p>
        </div>

        <div class="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div class="flex items-center space-x-2">
            <ng-icon name="lucideSettings" class="h-5 w-5 text-orange-500" />
            <h3 class="text-sm font-medium text-muted-foreground">
              Configured
            </h3>
          </div>
          <p class="text-2xl font-bold">{{ configuredProvidersCount() }}</p>
        </div>

        <div class="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div class="flex items-center space-x-2">
            <ng-icon name="lucideChartBar" class="h-5 w-5 text-purple-500" />
            <h3 class="text-sm font-medium text-muted-foreground">Regions</h3>
          </div>
          <p class="text-2xl font-bold">{{ totalRegionsCount() }}</p>
        </div>
      </div>

      <div
        class="flex flex-col space-y-4 md:flex-row md:items-center md:space-y-0 md:space-x-4"
      >
        <div class="flex-1">
          <div class="relative">
            <ng-icon
              name="lucideSearch"
              class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search providers..."
              [value]="searchTerm()"
              (input)="searchTerm.set($any($event.target).value)"
              class="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <select
            [value]="statusFilter()"
            (change)="statusFilter.set($any($event.target).value)"
            class="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="not_configured">Not Configured</option>
            <option value="error">Error</option>
            <option value="disabled">Disabled</option>
          </select>

          <select
            [value]="credentialTypeFilter()"
            (change)="credentialTypeFilter.set($any($event.target).value)"
            class="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">All Types</option>
            <option value="api_key">API Key</option>
            <option value="bearer_token">Bearer Token</option>
            <option value="user_password">Username/Password</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        @for (item of filteredProviders(); track item.id) {
        <provider-card
          [configuration]="item.type === 'configured' ? item.data : undefined"
          [provider]="getProviderDefinition(item)"
          (configure)="onConfigureProvider(getProviderId(item))"
        />
        } @empty {
        <div class="col-span-full">
          <div class="text-center py-12">
            <ng-icon
              name="lucideSettings"
              class="mx-auto h-12 w-12 text-muted-foreground"
            />
            <h3 class="mt-4 text-lg font-semibold">No providers found</h3>
            <p class="mt-2 text-muted-foreground">
              @if (hasActiveFilters()) { Try adjusting your search or filter
              criteria. } @else { No cloud providers are available at the
              moment. }
            </p>
            @if (hasActiveFilters()) {
            <button
              (click)="clearFilters()"
              class="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Clear Filters
            </button>
            }
          </div>
        </div>
        }
      </div>
    </div>
  `,
})
export class ProvidersOverviewComponent implements OnInit {
  startConfiguration = output<string>();

  providersService = inject(ProvidersService);
  protected readonly providerManagementService = inject(
    ProviderManagementService
  );

  searchTerm = signal<string>('');
  statusFilter = signal<string>('');
  credentialTypeFilter = signal<string>('');

  ngOnInit(): void {
    this.refreshProviders();
  }

  readonly filteredProviders = computed(() => {
    const availableProviders = this.providersService.availableProviders();
    const configuredProviders = this.providersService.configuredProviders();
    const search = this.searchTerm().toLowerCase();
    const status = this.statusFilter();
    const credType = this.credentialTypeFilter();

    const allProviders: ProviderItem[] = [];

    // First, add all available providers
    availableProviders.forEach(provider => {
      // Check if this provider is already configured
      const existingConfig = configuredProviders.find(c => c.provider === provider.id);

      if (existingConfig) {
        // This provider is configured, add it as a configured item
        allProviders.push({
          type: 'configured',
          data: existingConfig,
          id: `configured-${existingConfig.id}`
        });
      } else {
        // This provider is not configured, add it as an available item
        allProviders.push({
          type: 'available',
          data: provider,
          id: `available-${provider.id}`
        });
      }
    });

    // Filter based on search and filter criteria
    return allProviders.filter((item) => {
      // Get the provider definition for both types
      const providerDefinition = item.type === 'available'
        ? item.data
        : this.providersService.getProviderById(item.data.provider);

      const itemStatus = item.type === 'available' ? 'not_configured' : item.data.status;

      const matchesSearch =
        !search ||
        providerDefinition?.displayName?.toLowerCase().includes(search) ||
        providerDefinition?.description?.toLowerCase().includes(search);

      const matchesStatus = !status || itemStatus === status;

      const matchesCredType =
        !credType || providerDefinition?.capabilities?.credentialType === credType;

      return matchesSearch && matchesStatus && matchesCredType;
    });
  });

  readonly activeProvidersCount = computed(
    () =>
      this.providersService
        .configuredProviders()
        .filter((c) => c.status === ProviderStatus.ACTIVE).length
  );

  readonly configuredProvidersCount = computed(
    () =>
      this.providersService
        .configuredProviders()
        .filter((c) => c.status !== ProviderStatus.NOT_CONFIGURED).length
  );

  readonly totalRegionsCount = computed(() =>
    this.providersService
      .activeProviders()
      .reduce((total, config) => total + config.enabledRegions.length, 0)
  );

  hasActiveFilters(): boolean {
    return (
      this.searchTerm() !== '' ||
      this.statusFilter() !== '' ||
      this.credentialTypeFilter() !== ''
    );
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('');
    this.credentialTypeFilter.set('');
  }

  refreshProviders(): void {
    this.providersService.loadProviders();
    this.providersService.loadConfigurations();
  }

  onConfigureProvider(providerId: string): void {
    this.startConfiguration.emit(providerId);
  }

  getProviderDefinition(item: ProviderItem): ProviderDefinitionDto | undefined {
    if (item.type === 'available') {
      return item.data; // item.data is already ProviderDefinitionDto
    } else {
      // For configured providers, get the full provider definition by ID
      return this.providersService.getProviderById(item.data.provider);
    }
  }

  getProviderId(item: ProviderItem): string {
    if (item.type === 'available') {
      return item.data.id;
    } else {
      return item.data.provider; // This is the provider ID string
    }
  }

  getStatusIndicatorClass(status: ProviderStatus): string {
    const baseClass = 'h-6 w-6 rounded-full flex items-center justify-center';

    switch (status) {
      case ProviderStatus.ACTIVE:
        return `${baseClass} bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400`;
      case ProviderStatus.ERROR:
        return `${baseClass} bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400`;
      case ProviderStatus.CONFIGURING:
      case ProviderStatus.VALIDATING:
        return `${baseClass} bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400`;
      default:
        return `${baseClass} bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400`;
    }
  }

  getStatusIcon(status: ProviderStatus): string {
    switch (status) {
      case ProviderStatus.ACTIVE:
        return 'lucideCheck';
      case ProviderStatus.ERROR:
        return 'lucideTriangleAlert';
      case ProviderStatus.CONFIGURING:
      case ProviderStatus.VALIDATING:
        return 'lucideRefreshCw';
      default:
        return 'lucideSettings';
    }
  }

  getStatusText(status: ProviderStatus): string {
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
  }
}
