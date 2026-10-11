import {
  Component,
  computed,
  inject,
  OnInit,
  output,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideRefreshCw } from '@ng-icons/lucide';
import { ProviderCardComponent } from './provider-card.component';
import { ProviderStatus } from '../../model/provider.models';
import { ProvidersService } from '../../service/providers.service';
import { ProviderDefinitionDto } from '../../../core/api';
import { StatTileComponent, StatTileData } from '../../../shared/components/charts';
import { credentialKind } from './provider-presentation';

export interface ProviderItem {
  type: 'available' | 'configured';
  data: any;
  id: string;
}

@Component({
  selector: 'providers-overview',
  standalone: true,
  imports: [NgIcon, ProviderCardComponent, StatTileComponent],
  providers: [provideIcons({ lucideSearch, lucideRefreshCw })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="space-y-6">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-foreground">Cloud providers</h1>
          <p class="text-sm text-muted-foreground">The accounts Flui creates your machines on.</p>
        </div>
        <button
          type="button"
          (click)="refreshProviders()"
          [disabled]="providersService.isLoading()"
          class="inline-flex items-center justify-center self-start rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors md:self-auto"
        >
          <ng-icon
            name="lucideRefreshCw"
            [class]="providersService.isLoading() ? 'h-4 w-4 mr-2 text-muted-foreground animate-spin' : 'h-4 w-4 mr-2 text-muted-foreground'"
          />
          Refresh
        </button>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="provider-tiles">
        @for (tile of tiles(); track tile.label) {
          <app-stat-tile [data]="tile" />
        }
      </div>

      <div class="flex flex-col gap-3 md:flex-row md:items-center">
        <div class="relative flex-1">
          <ng-icon
            name="lucideSearch"
            class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search providers"
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
            class="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div class="grid grid-cols-2 gap-2 md:flex md:items-center">
          <select
            [value]="statusFilter()"
            (change)="statusFilter.set($any($event.target).value)"
            aria-label="Status"
            class="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Any status</option>
            <option value="active">Connected</option>
            <option value="not_configured">Not connected</option>
            <option value="error">Needs attention</option>
            <option value="disabled">Disabled</option>
          </select>
          <select
            [value]="credentialTypeFilter()"
            (change)="credentialTypeFilter.set($any($event.target).value)"
            aria-label="Sign-in"
            class="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Any sign-in</option>
            <option value="api_key">API token</option>
            <option value="access_key_secret">Key and secret</option>
            <option value="bearer_token">Bearer token</option>
            <option value="user_password">User and password</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        @for (item of filteredProviders(); track item.id) {
          <provider-card
            [configuration]="item.type === 'configured' ? item.data : undefined"
            [provider]="getProviderDefinition(item)"
            (configure)="onConfigureProvider(getProviderId(item))"
          />
        } @empty {
          <div class="col-span-full card-surface px-5 py-10 text-center">
            <p class="text-sm font-medium text-foreground">No providers found</p>
            <p class="mt-1 text-sm text-muted-foreground">
              @if (hasActiveFilters()) { Nothing matches these filters. } @else { No provider is available yet. }
            </p>
            @if (hasActiveFilters()) {
              <button
                type="button"
                (click)="clearFilters()"
                class="mt-3 text-xs font-medium text-primary hover:underline"
              >
                Clear filters
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ProvidersOverviewComponent implements OnInit {
  startConfiguration = output<string>();

  providersService = inject(ProvidersService);

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
        !credType || (!!providerDefinition && credentialKind(providerDefinition) === credType);

      return matchesSearch && matchesStatus && matchesCredType;
    });
  });

  readonly activeProvidersCount = computed(
    () =>
      this.providersService
        .configuredProviders()
        .filter((c) => c.status === ProviderStatus.ACTIVE).length
  );

  readonly totalRegionsCount = computed(() =>
    this.providersService
      .activeProviders()
      .reduce((total, config) => total + config.enabledRegions.length, 0)
  );

  readonly attentionCount = computed(
    () =>
      this.providersService
        .configuredProviders()
        .filter((c) => c.status === ProviderStatus.ERROR).length
  );

  readonly tiles = computed<StatTileData[]>(() => {
    const attention = this.attentionCount();
    return [
      {
        label: 'Providers',
        value: String(this.providersService.availableProviders().length),
        hint: 'Every provider this installation can connect to.',
      },
      {
        label: 'Connected',
        value: String(this.activeProvidersCount()),
        hint: 'Providers whose account is connected and working.',
        notes: attention > 0 ? [{ text: `${attention} needs attention`, tone: 'bad' }] : undefined,
      },
      {
        label: 'Regions enabled',
        value: String(this.totalRegionsCount()),
        hint: 'Regions new machines can be placed in, across connected providers.',
      },
    ];
  });

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
}
