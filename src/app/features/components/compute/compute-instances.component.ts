import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideSearch, lucideServer } from '@ng-icons/lucide';
import { InstanceResponseDto, ProviderErrorDto, VirtualInstancesService } from '../../../core/api';
import { InstanceWithLabels } from '../../model/instance.models';
import { ProvidersService } from '../../service/providers.service';
import { InstanceRowComponent } from './instance-row.component';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { INSTANCE_STATUS_FILTERS } from './instance-status';
import {
  ComputeInstancesSurfaceInput,
  ComputeInstancesSurfaceRevision,
  buildComputeInstancesSurface,
  presentedContent,
} from './compute-instances-surface';

interface FilterState {
  search: string;
  provider: string;
  status: string;
  region: string;
}

@Component({
  selector: 'app-compute-instances',
  imports: [
    InstanceRowComponent,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlTable,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideSearch, lucideServer })],
  template: `
    <div class="fl-page">
      <fl-page-header [title]="'Compute instances (' + instances().length + ')'">
        <span headerMeta>Virtual machines across your providers</span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            title="Refresh"
            [disabled]="isLoading()"
            (click)="refreshInstances()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </fl-page-header>

      @if (loadError() && !isLoading()) {
        <fl-alert tone="error" title="Could not load the instances">{{ loadError() }}</fl-alert>
      }

      @if (partialErrors().length > 0) {
        <fl-alert tone="warning" title="Some providers did not answer">
          @for (error of partialErrors(); track error.provider) {
            <span class="block">{{ error.provider }}: {{ error.message }}</span>
          }
        </fl-alert>
      }

      <fl-panel [flush]="true">
        <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
          <div class="fl-toolbar__group">
            <label class="fl-input">
              <fl-icon name="lucideSearch" [size]="14" />
              <span class="fl-sr">Search</span>
              <input
                type="search"
                placeholder="Search by name"
                aria-label="Search instances"
                [value]="filters().search"
                (input)="updateSearchFilter($event)"
              />
            </label>
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Provider"
                [value]="filters().provider"
                (change)="updateProviderFilter($event)"
              >
                <option value="">Provider: All</option>
                @for (p of activeProviders(); track p.id) {
                  <option [value]="p.id">{{ p.displayName }}</option>
                }
              </select>
            </span>
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Status"
                [value]="filters().status"
                (change)="updateStatusFilter($event)"
              >
                <option value="">Status: All</option>
                @for (o of statusOptions; track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
            </span>
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Region"
                [value]="filters().region"
                (change)="updateRegionFilter($event)"
              >
                <option value="">Region: All</option>
                @for (region of uniqueRegions(); track region) {
                  <option [value]="region">{{ region }}</option>
                }
              </select>
            </span>
            @if (hasActiveFilters()) {
              <button flButton="ghost" size="sm" type="button" (click)="clearAllFilters()">
                Clear filters
              </button>
            }
          </div>
          <div class="fl-toolbar__group">
            <span class="fl-toolbar__info"
              >{{ filteredInstances().length }}
              {{ filteredInstances().length === 1 ? 'instance' : 'instances' }}</span
            >
          </div>
        </div>

        @if (isLoading() && instances().length === 0) {
          <fl-loading-state [rows]="5" />
        } @else if (filteredInstances().length === 0) {
          <fl-empty-state
            icon="lucideServer"
            [title]="hasActiveFilters() ? 'No matching instances' : 'No instances yet'"
            [body]="
              hasActiveFilters()
                ? 'Nothing matches these filters.'
                : 'Instances appear here when your clusters scale up.'
            "
          >
            @if (hasActiveFilters()) {
              <button flButton size="sm" type="button" (click)="clearAllFilters()">
                Clear filters
              </button>
            }
          </fl-empty-state>
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense" aria-label="Compute instances">
              <thead>
                <tr>
                  <th scope="col">Instance</th>
                  <th scope="col">Status</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Region</th>
                  <th scope="col" class="is-num">CPU</th>
                  <th scope="col" class="is-num">Memory</th>
                  <th scope="col" class="is-num">Disk</th>
                  <th scope="col">IPv4</th>
                  <th scope="col">Ownership</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (instance of filteredInstances(); track instance.id || instance.providerId) {
                  <tr app-instance-row [instance]="instance"></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    </div>
  `,
})
export class ComputeInstancesComponent implements OnInit, OnDestroy {
  private readonly virtualInstancesService = inject(VirtualInstancesService);
  private readonly providersService = inject(ProvidersService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new ComputeInstancesSurfaceRevision();

  readonly surface = computed(() => {
    const input: ComputeInstancesSurfaceInput = {
      visibleInstances: this.filteredInstances(),
      totalCount: this.instances().length,
      isLoading: this.isLoading(),
      filters: this.filters(),
    };
    const content = presentedContent(input);
    return buildComputeInstancesSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  instances = signal<InstanceWithLabels[]>([]);
  partialErrors = signal<ProviderErrorDto[]>([]);
  isLoading = signal(true);
  loadError = signal<string | null>(null);
  filters = signal<FilterState>({
    search: '',
    provider: '',
    status: '',
    region: '',
  });

  protected readonly statusOptions = INSTANCE_STATUS_FILTERS;

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

      if (currentFilters.provider && instance.provider !== currentFilters.provider) {
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
    this.loadError.set(null);

    this.virtualInstancesService
      .instancesControllerFindAll(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      )
      .subscribe({
        next: (response: InstanceResponseDto) => {
          this.instances.set(response.data || []);
          this.partialErrors.set(response.partialErrors || []);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load instances:', error);
          this.loadError.set(error?.error?.message ?? error?.message ?? 'Unknown error');
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
}
