import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideSearch } from '@ng-icons/lucide';
import { ProviderCardComponent } from './provider-card.component';
import { ProviderStatus } from '../../model/provider.models';
import { ProvidersService } from '../../service/providers.service';
import { ClusterService } from '../../service/cluster.service';
import { ProviderConfigurationDto, ProviderDefinitionDto } from '../../../core/api';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { credentialKind } from './provider-presentation';
import { ProvidersConnectMenu } from './providers-connect-menu';

export type ProviderItem =
  | { type: 'available'; data: ProviderDefinitionDto; id: string }
  | { type: 'configured'; data: ProviderConfigurationDto; id: string };

@Component({
  selector: 'providers-overview',
  imports: [
    ProviderCardComponent,
    ProvidersConnectMenu,
    FlPageHeader,
    FlPanel,
    FlTable,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
  ],
  providers: [provideIcons({ lucideSearch, lucideRefreshCw })],
  template: `
    <fl-page-header [title]="'Providers (' + providersService.availableProviders().length + ')'">
      <span headerMeta>The accounts Flui creates your machines on</span>
      <span headerMeta data-testid="provider-tiles">{{ summary() }}</span>
      <ng-container headerActions>
        <button
          flButton
          type="button"
          [iconOnly]="true"
          aria-label="Refresh"
          title="Refresh"
          [disabled]="providersService.isLoading()"
          (click)="refreshProviders()"
        >
          <fl-icon name="lucideRefreshCw" />
        </button>
        <app-providers-connect-menu
          [providers]="connectable()"
          (connect)="onConfigureProvider($event)"
        />
      </ng-container>
    </fl-page-header>

    <fl-panel [flush]="true">
      <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
        <div class="fl-toolbar__group">
          <label class="fl-input">
            <fl-icon name="lucideSearch" [size]="14" />
            <span class="fl-sr">Search</span>
            <input
              type="search"
              placeholder="Search providers"
              aria-label="Search providers"
              [value]="searchTerm()"
              (input)="searchTerm.set($any($event.target).value)"
            />
          </label>
          <span class="fl-select-wrap">
            <select
              class="fl-select fl-select--sm"
              aria-label="Status"
              [value]="statusFilter()"
              (change)="statusFilter.set($any($event.target).value)"
            >
              <option value="">Status: All</option>
              <option value="active">Connected</option>
              <option value="not_configured">Not connected</option>
              <option value="error">Needs attention</option>
              <option value="disabled">Disabled</option>
            </select>
          </span>
          <span class="fl-select-wrap">
            <select
              class="fl-select fl-select--sm"
              aria-label="Sign-in"
              [value]="credentialTypeFilter()"
              (change)="credentialTypeFilter.set($any($event.target).value)"
            >
              <option value="">Sign-in: All</option>
              <option value="api_key">API token</option>
              <option value="access_key_secret">Key and secret</option>
              <option value="bearer_token">Bearer token</option>
              <option value="user_password">User and password</option>
            </select>
          </span>
        </div>
        <div class="fl-toolbar__group">
          <span class="fl-toolbar__info"
            >{{ filteredProviders().length }}
            {{ filteredProviders().length === 1 ? 'provider' : 'providers' }}</span
          >
        </div>
      </div>

      @if (isInitialLoading()) {
        <fl-loading-state [rows]="4" />
      } @else if (filteredProviders().length === 0) {
        <fl-empty-state
          title="No providers found"
          [body]="
            hasActiveFilters() ? 'Nothing matches these filters.' : 'No provider is available yet.'
          "
        >
          @if (hasActiveFilters()) {
            <button flButton size="sm" type="button" (click)="clearFilters()">Clear filters</button>
          }
        </fl-empty-state>
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense" data-testid="providers-table">
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Account</th>
                <th scope="col">Credentials</th>
                <th scope="col">Sign-in</th>
                <th scope="col" class="is-num">Regions</th>
                <th scope="col" class="is-num">Clusters</th>
                <th scope="col" class="is-num">From</th>
                <th scope="col" class="is-num">Last checked</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredProviders(); track item.id) {
                <tr
                  provider-card
                  [configuration]="configurationOf(item)"
                  [provider]="getProviderDefinition(item)"
                  [clusters]="clustersOf(item)"
                  (configure)="onConfigureProvider($event)"
                ></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class ProvidersOverviewComponent implements OnInit {
  startConfiguration = output<string>();

  providersService = inject(ProvidersService);
  private readonly clusterService = inject(ClusterService);

  searchTerm = signal<string>('');
  statusFilter = signal<string>('');
  credentialTypeFilter = signal<string>('');

  ngOnInit(): void {
    this.refreshProviders();
    if (this.clusterService.clusters().length === 0) {
      this.clusterService.loadClusters().catch(() => undefined);
    }
  }

  readonly filteredProviders = computed(() => {
    const availableProviders = this.providersService.availableProviders();
    const configuredProviders = this.providersService.configuredProviders();
    const search = this.searchTerm().toLowerCase();
    const status = this.statusFilter();
    const credType = this.credentialTypeFilter();

    const allProviders: ProviderItem[] = [];
    availableProviders.forEach((provider) => {
      const existingConfig = configuredProviders.find((c) => c.provider === provider.id);

      if (existingConfig) {
        allProviders.push({
          type: 'configured',
          data: existingConfig,
          id: `configured-${existingConfig.id}`,
        });
      } else {
        allProviders.push({
          type: 'available',
          data: provider,
          id: `available-${provider.id}`,
        });
      }
    });
    return allProviders.filter((item) => {
      const providerDefinition = this.getProviderDefinition(item);

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
      this.providersService.configuredProviders().filter((c) => c.status === ProviderStatus.ACTIVE)
        .length,
  );

  readonly totalRegionsCount = computed(() =>
    this.providersService
      .activeProviders()
      .reduce((total, config) => total + config.enabledRegions.length, 0),
  );

  readonly attentionCount = computed(
    () =>
      this.providersService.configuredProviders().filter((c) => c.status === ProviderStatus.ERROR)
        .length,
  );

  readonly summary = computed(() => {
    const parts = [`${this.activeProvidersCount()} connected`];
    const attention = this.attentionCount();
    if (attention > 0) parts.push(`${attention} needs attention`);
    parts.push(`${this.totalRegionsCount()} regions enabled`);
    return parts.join(' · ');
  });

  readonly connectable = computed(() => {
    const configured = new Set(this.providersService.configuredProviders().map((c) => c.provider));
    return this.providersService.availableProviders().filter((p) => !configured.has(p.id));
  });

  private readonly clustersByProvider = computed(() => {
    const counts = new Map<string, number>();
    for (const c of this.clusterService.clusters()) {
      if (!c.provider) continue;
      counts.set(c.provider, (counts.get(c.provider) ?? 0) + 1);
    }
    return counts;
  });

  readonly isInitialLoading = computed(
    () =>
      this.providersService.isLoading() && this.providersService.availableProviders().length === 0,
  );

  protected clustersOf(item: ProviderItem): number {
    return this.clustersByProvider().get(this.getProviderId(item)) ?? 0;
  }

  hasActiveFilters(): boolean {
    return (
      this.searchTerm() !== '' || this.statusFilter() !== '' || this.credentialTypeFilter() !== ''
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
    return item.type === 'available'
      ? item.data
      : this.providersService.getProviderById(item.data.provider);
  }

  getProviderId(item: ProviderItem): string {
    return item.type === 'available' ? item.data.id : item.data.provider;
  }

  protected configurationOf(item: ProviderItem): ProviderConfigurationDto | undefined {
    return item.type === 'configured' ? item.data : undefined;
  }
}
