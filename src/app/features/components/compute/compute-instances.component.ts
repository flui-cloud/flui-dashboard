import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideFilter,
  lucideLoader,
  lucidePause,
  lucideRefreshCw,
  lucideServer,
  lucideSettings,
  lucideTriangleAlert,
  lucideX,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import {
  HlmCardContentDirective,
  HlmCardDirective,
  HlmCardHeaderDirective,
} from '@spartan-ng/ui-card-helm';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
import { HlmLabelDirective } from '@spartan-ng/ui-label-helm';
import {
  InstanceResponseDto,
  ProviderErrorDto,
  VirtualInstancesService,
} from '../../../core/api';
import { InstanceWithLabels } from '../../model/instance.models';
import { ProvidersService } from '../../service/providers.service';
import { InstanceRowComponent } from './instance-row.component';

interface FilterState {
  search: string;
  provider: string;
  status: string;
  region: string;
}

@Component({
  selector: 'app-compute-instances',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmCardHeaderDirective,
    HlmButtonDirective,
    HlmInputDirective,
    HlmLabelDirective,
    InstanceRowComponent,
  ],
  providers: [
    provideIcons({
      lucideServer,
      lucideTriangleAlert,
      lucideLoader,
      lucidePause,
      lucideSettings,
      lucideRefreshCw,
      lucideFilter,
      lucideChevronDown,
      lucideX,
    }),
  ],
  template: `
    <div class="p-6 space-y-6">
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 class="text-3xl font-bold text-foreground">Compute Instances</h1>
          <p class="text-muted-foreground">
            Monitor your auto-managed virtual machines across providers
          </p>
        </div>

        <div class="flex gap-2">
          <button
            hlmBtn
            variant="outline"
            size="sm"
            (click)="refreshInstances()"
            [disabled]="isLoading()"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-4 w-4 mr-2"
              [class.animate-spin]="isLoading()"
            />
            Refresh
          </button>
        </div>
      </div>

      <div hlmCard class="border-border">
        <div hlmCardHeader class="pb-4">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div class="flex-1 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <!-- Search Input -->
              <div class="space-y-2 min-w-0">
                <label hlmLabel class="text-sm font-medium">Search</label>
                <input
                  hlmInput
                  placeholder="Search instances..."
                  [value]="filters().search"
                  (input)="updateSearchFilter($event)"
                />
              </div>

              <!-- Provider Select -->
              <div class="space-y-2 min-w-0">
                <label hlmLabel class="text-sm font-medium">Provider</label>
                <div class="relative w-full">
                  <select
                    class="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none truncate"
                    [value]="filters().provider"
                    (change)="updateProviderFilter($event)"
                  >
                    <option value="">All providers</option>
                    @for (p of activeProviders(); track p.id) {
                    <option [value]="p.id">{{ p.displayName }}</option>
                    }
                  </select>
                  <ng-icon
                    name="lucideChevronDown"
                    class="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none flex-shrink-0"
                  />
                </div>
              </div>

              <!-- Status Select -->
              <div class="space-y-2 min-w-0">
                <label hlmLabel class="text-sm font-medium">Status</label>
                <div class="relative w-full">
                  <select
                    class="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none truncate"
                    [value]="filters().status"
                    (change)="updateStatusFilter($event)"
                  >
                    <option value="">All statuses</option>
                    <option value="running">Running</option>
                    <option value="stopped">Stopped</option>
                    <option value="starting">Starting</option>
                    <option value="stopping">Stopping</option>
                    <option value="error">Error</option>
                  </select>
                  <ng-icon
                    name="lucideChevronDown"
                    class="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none flex-shrink-0"
                  />
                </div>
              </div>

              <!-- Region Select -->
              <div class="space-y-2 min-w-0">
                <label hlmLabel class="text-sm font-medium">Region</label>
                <div class="relative w-full">
                  <select
                    class="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none truncate"
                    [value]="filters().region"
                    (change)="updateRegionFilter($event)"
                  >
                    <option value="">All regions</option>
                    @for (region of uniqueRegions(); track region) {
                    <option [value]="region">{{ region }}</option>
                    }
                  </select>
                  <ng-icon
                    name="lucideChevronDown"
                    class="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none flex-shrink-0"
                  />
                </div>
              </div>
            </div>

            @if (hasActiveFilters()) {
            <button
              hlmBtn
              variant="outline"
              size="sm"
              (click)="clearAllFilters()"
              class="shrink-0"
            >
              <ng-icon name="lucideX" class="h-4 w-4 mr-2" />
              Clear filters
            </button>
            }
          </div>

          <!-- Active Filters Display - Always visible container -->
          <div class="flex flex-wrap gap-2 mt-4 min-h-[28px]">
            @if (filters().search) {
            <span class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md">
              Search: "{{ filters().search }}"
              <button (click)="clearFilter('search')" class="hover:bg-primary/20 rounded p-0.5">
                <ng-icon name="lucideX" class="h-3 w-3" />
              </button>
            </span>
            }
            @if (filters().provider) {
            <span class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md">
              Provider: {{ getProviderLabel(filters().provider) }}
              <button (click)="clearFilter('provider')" class="hover:bg-primary/20 rounded p-0.5">
                <ng-icon name="lucideX" class="h-3 w-3" />
              </button>
            </span>
            }
            @if (filters().status) {
            <span class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md">
              Status: {{ getStatusLabel(filters().status) }}
              <button (click)="clearFilter('status')" class="hover:bg-primary/20 rounded p-0.5">
                <ng-icon name="lucideX" class="h-3 w-3" />
              </button>
            </span>
            }
            @if (filters().region) {
            <span class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md">
              Region: {{ filters().region }}
              <button (click)="clearFilter('region')" class="hover:bg-primary/20 rounded p-0.5">
                <ng-icon name="lucideX" class="h-3 w-3" />
              </button>
            </span>
            }
            @if (!hasActiveFilters()) {
            <span class="text-xs text-muted-foreground italic py-1">
              No active filters
            </span>
            }
          </div>
        </div>

        <div hlmCardContent class="p-0">
          @if (partialErrors().length > 0) {
          <div
            class="mx-6 mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
          >
            <div
              class="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 font-medium mb-2"
            >
              <ng-icon name="lucideTriangleAlert" class="h-4 w-4" />
              Partial Data Warning
            </div>
            <div class="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              @for (error of partialErrors(); track error.provider) {
              <div>{{ error.provider }}: {{ error.message }}</div>
              }
            </div>
          </div>
          }

          @if (isLoading()) {
          <div class="flex items-center justify-center py-12">
            <div class="flex items-center gap-2 text-muted-foreground">
              <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin" />
              Loading instances...
            </div>
          </div>
          } @else if (filteredInstances().length === 0) {
          <div
            class="flex flex-col items-center justify-center py-12 text-center"
          >
            <ng-icon
              name="lucideServer"
              class="h-12 w-12 text-muted-foreground mb-4"
            />
            <h3 class="text-lg font-medium text-foreground mb-2">
              No instances found
            </h3>
            <p class="text-muted-foreground mb-4">
              @if (hasActiveFilters()) {
                Try adjusting your filters to see more instances.
              } @else {
                Instances will appear automatically when your cluster scales up.
              }
            </p>
            <div class="flex gap-2">
              @if (hasActiveFilters()) {
              <button hlmBtn variant="outline" (click)="clearAllFilters()">
                <ng-icon name="lucideX" class="h-4 w-4 mr-2" />
                Clear filters
              </button>
              }
            </div>
          </div>
          } @else {
          <div class="flex flex-col gap-2 p-4">
            @for (instance of filteredInstances(); track instance.id || instance.providerId) {
              <app-instance-row [instance]="instance" />
            }
          </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ComputeInstancesComponent implements OnInit {
  private readonly virtualInstancesService = inject(VirtualInstancesService);
  private readonly providersService = inject(ProvidersService);

  instances = signal<InstanceWithLabels[]>([]);
  partialErrors = signal<ProviderErrorDto[]>([]);
  isLoading = signal(true);
  filters = signal<FilterState>({
    search: '',
    provider: '',
    status: '',
    region: '',
  });

  // Active configured providers for the filter dropdown
  activeProviders = computed(() => this.providersService.availableProviders());

  uniqueRegions = computed(() => {
    const regions = this.instances()
      .map((i) => i.regionName || i.region)
      .filter(Boolean);
    return [...new Set(regions)].sort((a, b) => String(a).localeCompare(String(b)));
  });

  filteredInstances = computed(() => {
    const currentFilters = this.filters();
    return this.instances().filter((instance) => {
      if (currentFilters.search) {
        const searchLower = currentFilters.search.toLowerCase();
        if (
          !instance.name.toLowerCase().includes(searchLower) &&
          !instance.displayName?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      if (
        currentFilters.provider &&
        instance.provider !== currentFilters.provider
      ) {
        return false;
      }

      if (currentFilters.status && instance.status !== currentFilters.status) {
        return false;
      }

      if (currentFilters.region) {
        const instanceRegion = instance.regionName || instance.region;
        if (instanceRegion !== currentFilters.region) {
          return false;
        }
      }

      return true;
    });
  });

  hasActiveFilters = computed(() => {
    const currentFilters = this.filters();
    return !!(
      currentFilters.search ||
      currentFilters.provider ||
      currentFilters.status ||
      currentFilters.region
    );
  });

  ngOnInit() {
    this.providersService.loadProviders();
    this.loadInstances();
  }

  loadInstances() {
    this.isLoading.set(true);

    this.virtualInstancesService.instancesControllerFindAll(undefined, undefined, undefined, undefined, undefined, undefined, undefined, true).subscribe({
      next: (response: InstanceResponseDto) => {
        this.instances.set(response.data || []);
        this.partialErrors.set(response.partialErrors || []);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load instances:', error);
        this.instances.set([]);
        this.partialErrors.set([]);
        this.isLoading.set(false);
      },
    });
  }

  refreshInstances() {
    this.loadInstances();
  }

  updateSearchFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.filters.update((current) => ({ ...current, search: value }));
  }

  updateProviderFilter(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.filters.update((current) => ({ ...current, provider: value }));
  }

  updateStatusFilter(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.filters.update((current) => ({ ...current, status: value }));
  }

  updateRegionFilter(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.filters.update((current) => ({ ...current, region: value }));
  }

  clearAllFilters() {
    this.filters.set({
      search: '',
      provider: '',
      status: '',
      region: '',
    });
  }

  clearFilter(filterKey: keyof FilterState) {
    this.filters.update((current) => ({ ...current, [filterKey]: '' }));
  }

  getProviderLabel(provider: string): string {
    return this.providersService.getProviderById(provider)?.displayName ?? provider;
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'running':
        return 'Running';
      case 'stopped':
        return 'Stopped';
      case 'starting':
        return 'Starting';
      case 'stopping':
        return 'Stopping';
      case 'provisioning':
        return 'Provisioning';
      case 'error':
        return 'Error';
      case 'unknown':
        return 'Unknown';
      case 'rebuilding':
        return 'Rebuilding';
      case 'migrating':
        return 'Migrating';
      case 'deleting':
        return 'Deleting';
      default:
        return status;
    }
  }
}
