import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideNetwork, lucidePlus, lucideRefreshCw, lucideSearch } from '@ng-icons/lucide';

import { VNetService } from '../../service/vnet.service';
import { ProvidersService } from '../../service/providers.service';
import {
  VNetInfo,
  VNetFilterState,
  VNetStatus,
  getAllAttachedServerIds,
} from '../../model/vnet.models';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { ManagementNetworkCardComponent } from './management-network-card.component';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import {
  VNetListSurfaceInput,
  VNetListSurfaceRevision,
  buildVNetListSurface,
  presentedContent,
} from './vnet-list-surface';
import { vnetProviderLabel, vnetStatus } from './vnet-status';

const STATUS_FILTERS = [
  VNetStatus.ACTIVE,
  VNetStatus.PENDING,
  VNetStatus.FAILED,
  VNetStatus.DELETING,
].map((value) => ({ value, label: vnetStatus(value).label }));

@Component({
  selector: 'vnet-list',
  imports: [
    ReadOnlySectionDirective,
    FormsModule,
    RouterLink,
    ManagementNetworkCardComponent,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlTable,
    FlEmptyState,
    FlLoadingState,
    FlStatus,
    FlTag,
    FlButton,
    FlIcon,
  ],
  providers: [provideIcons({ lucideNetwork, lucidePlus, lucideRefreshCw, lucideSearch })],
  template: `
    <div class="fl-page">
      <fl-page-header [title]="'Networks (' + vnets().length + ')'">
        <span headerMeta>{{ summary() }}</span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            title="Refresh"
            [disabled]="isLoading()"
            (click)="refreshVNets()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
          <button
            flButton="primary"
            type="button"
            appReadOnlySection="infrastructure"
            (click)="createNewVNet()"
          >
            <fl-icon name="lucidePlus" />
            Create network
          </button>
        </ng-container>
      </fl-page-header>

      <app-management-network-card />

      @if (errorMessage() && !isLoading()) {
        <fl-alert tone="error" title="Could not load the networks">{{ errorMessage() }}</fl-alert>
      }

      <fl-panel [flush]="true">
        <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
          <div class="fl-toolbar__group">
            <label class="fl-input">
              <fl-icon name="lucideSearch" [size]="14" />
              <span class="fl-sr">Search</span>
              <input
                type="search"
                placeholder="Search by name, range or provider ID"
                aria-label="Search networks"
                [ngModel]="filtersState().search"
                (ngModelChange)="updateFilter('search', $event)"
              />
            </label>
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Provider"
                [ngModel]="filtersState().provider"
                (ngModelChange)="updateFilter('provider', $event)"
              >
                <option value="">Provider: All</option>
                @for (p of availableProviders(); track p.id) {
                  <option [value]="p.id">{{ p.displayName }}</option>
                }
              </select>
            </span>
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Status"
                [ngModel]="filtersState().status"
                (ngModelChange)="updateFilter('status', $event)"
              >
                <option value="">Status: All</option>
                @for (o of statusOptions; track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
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
              >{{ filteredVNets().length }}
              {{ filteredVNets().length === 1 ? 'network' : 'networks' }}</span
            >
          </div>
        </div>

        @if (isLoading() && !filteredVNets().length) {
          <fl-loading-state [rows]="4" />
        } @else if (!filteredVNets().length) {
          <fl-empty-state
            icon="lucideNetwork"
            [title]="hasActiveFilters() ? 'No matching networks' : 'No networks yet'"
            [body]="
              hasActiveFilters()
                ? 'Nothing matches these filters.'
                : 'Create a private network to connect your servers and clusters.'
            "
          >
            @if (hasActiveFilters()) {
              <button flButton size="sm" type="button" (click)="clearAllFilters()">
                Clear filters
              </button>
            } @else {
              <button
                flButton="primary"
                size="sm"
                type="button"
                appReadOnlySection="infrastructure"
                (click)="createNewVNet()"
              >
                Create network
              </button>
            }
          </fl-empty-state>
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense" data-testid="vnet-table">
              <thead>
                <tr>
                  <th scope="col">Network</th>
                  <th scope="col">Status</th>
                  <th scope="col">Provider</th>
                  <th scope="col">IP range</th>
                  <th scope="col" class="is-num">Subnets</th>
                  <th scope="col" class="is-num">Servers</th>
                  <th scope="col">Labels</th>
                </tr>
              </thead>
              <tbody>
                @for (vnet of filteredVNets(); track vnet.id) {
                  @let st = statusOf(vnet);
                  <tr>
                    <td class="fl-cell-name">
                      <a class="fl-link" [routerLink]="['/infrastructure/vnet', vnet.id]">{{
                        vnet.name
                      }}</a>
                    </td>
                    <td><fl-status [tone]="st.tone" [label]="st.label" /></td>
                    <td>{{ providerLabel(vnet) }}</td>
                    <td class="fl-mono">{{ vnet.ipRange }}</td>
                    <td class="is-num">{{ vnet.subnets.length }}</td>
                    <td class="is-num">{{ getTotalAttachedServers(vnet) }}</td>
                    <td>
                      @if (vnet.labels.length) {
                        <span class="fl-row">
                          @for (label of vnet.labels.slice(0, 2); track label.key) {
                            <fl-tag>{{ label.key }}: {{ label.value }}</fl-tag>
                          }
                          @if (vnet.labels.length > 2) {
                            <span class="fl-muted">+{{ vnet.labels.length - 2 }}</span>
                          }
                        </span>
                      } @else {
                        <span class="fl-muted">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    </div>
  `,
})
export class VNetListComponent implements OnInit, OnDestroy {
  private readonly vnetService = inject(VNetService);
  private readonly providersService = inject(ProvidersService);
  private readonly router = inject(Router);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new VNetListSurfaceRevision();

  readonly surface = computed(() => {
    const input: VNetListSurfaceInput = {
      visibleVNets: this.filteredVNets(),
      totalCount: this.vnets().length,
      isLoading: this.isLoading(),
      filters: this.filtersState(),
      attachedServerCountOf: (v) => this.getTotalAttachedServers(v),
    };
    const content = presentedContent(input);
    return buildVNetListSurface(input, {
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

  private readonly filtersSignal = signal<VNetFilterState>({
    search: '',
    provider: '',
    status: '',
    clusterId: '',
  });

  readonly filtersState = this.filtersSignal.asReadonly();

  readonly availableProviders = computed(() => this.providersService.availableProviders());

  readonly vnets = this.vnetService.vnets;
  readonly isLoading = this.vnetService.loading;
  readonly errorMessage = this.vnetService.errorMessage;
  readonly statistics = this.vnetService.statistics;

  protected readonly statusOptions = STATUS_FILTERS;

  readonly summary = computed(() => {
    const s = this.statistics();
    const servers = s.totalAttachedServers === 1 ? 'server' : 'servers';
    const subnets = s.totalSubnets === 1 ? 'subnet' : 'subnets';
    return `${s.active} active · ${s.pending} pending · ${s.totalSubnets} ${subnets} · ${s.totalAttachedServers} ${servers} attached`;
  });

  readonly filteredVNets = computed(() => {
    const filters = this.filtersState();
    const vnets = this.vnets();

    return vnets.filter((vnet) => {
      const matchSearch =
        !filters.search ||
        vnet.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        vnet.ipRange.toLowerCase().includes(filters.search.toLowerCase()) ||
        vnet.providerResourceId.toLowerCase().includes(filters.search.toLowerCase());

      const matchProvider = !filters.provider || vnet.provider === filters.provider;

      const matchStatus = !filters.status || vnet.status === filters.status;

      return matchSearch && matchProvider && matchStatus;
    });
  });

  readonly hasActiveFilters = computed(() => {
    const filters = this.filtersState();
    return !!(filters.search || filters.provider || filters.status);
  });

  ngOnInit() {
    this.providersService.loadProviders();
    this.loadVNets();
  }

  async loadVNets() {
    try {
      await this.vnetService.loadVNets();
    } catch (error) {
      console.error('Failed to load VNets:', error);
    }
  }

  async refreshVNets() {
    await this.loadVNets();
  }

  createNewVNet() {
    this.router.navigate(['/infrastructure/vnet/new']);
  }

  selectVNet(id: string) {
    this.router.navigate(['/infrastructure/vnet', id]);
  }

  updateFilter(key: keyof VNetFilterState, value: string) {
    this.filtersSignal.update((current) => ({
      ...current,
      [key]: value,
    }));
  }

  clearAllFilters() {
    this.filtersSignal.set({
      search: '',
      provider: '',
      status: '',
      clusterId: '',
    });
  }

  getTotalAttachedServers(vnet: VNetInfo): number {
    return getAllAttachedServerIds(vnet).length;
  }

  protected statusOf(vnet: VNetInfo) {
    return vnetStatus(vnet.status);
  }

  protected providerLabel(vnet: VNetInfo): string {
    return vnetProviderLabel(vnet, (id) => this.providersService.getProviderById(id)?.displayName);
  }
}
