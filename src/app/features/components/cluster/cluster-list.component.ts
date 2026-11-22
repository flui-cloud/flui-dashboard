import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRefreshCw, lucideSearch } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { ProvidersService } from '../../service/providers.service';
import {
  ClusterInfo,
  ClusterStatus,
  isControlClusterType,
  ProviderType,
} from '../../model/cluster.models';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { CanDirective } from '../../../core/directives/can.directive';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { CLUSTER_STATUS, statusToneOf } from '../dashboard/home-state';
import { ClusterDeleteDialog } from './cluster-delete-dialog';
import {
  ClusterListSurfaceInput,
  ClusterListSurfaceRevision,
  buildClusterListSurface,
  presentedContent,
} from './cluster-list-surface';

interface FilterState {
  search: string;
  provider: string;
  status: string;
  region: string;
}

const STATUS_FILTERS = [
  ClusterStatus.ACTIVE,
  ClusterStatus.CREATING,
  ClusterStatus.SCALING,
  ClusterStatus.UPDATING,
  ClusterStatus.STOPPED,
  ClusterStatus.ERROR,
].map((value) => ({ value, label: CLUSTER_STATUS[value]?.label ?? value }));

@Component({
  selector: 'cluster-list',
  imports: [
    ReadOnlySectionDirective,
    CanDirective,
    FormsModule,
    RouterLink,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlTable,
    FlEmptyState,
    FlLoadingState,
    FlActionsMenu,
    FlStatus,
    FlTag,
    FlButton,
    FlIcon,
    ClusterDeleteDialog,
  ],
  providers: [provideIcons({ lucidePlus, lucideRefreshCw, lucideSearch })],
  template: `
    <div class="fl-page">
      <fl-page-header [title]="'Clusters (' + allClusters().length + ')'">
        <span headerMeta>Kubernetes clusters across your providers</span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            title="Refresh"
            [disabled]="isLoading()"
            (click)="refreshClusters()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
          <button
            flButton="primary"
            type="button"
            [appReadOnlySection]="CLUSTER_SECTION_KEYS"
            data-testid="cluster-create"
            (click)="createNewCluster()"
          >
            <fl-icon name="lucidePlus" />
            Create cluster
          </button>
        </ng-container>
      </fl-page-header>

      @if (errorMessage() && !isLoading()) {
        <fl-alert tone="error" title="Could not load the clusters">{{ errorMessage() }}</fl-alert>
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
                aria-label="Search clusters"
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
            <label class="fl-input">
              <span class="fl-sr">Region</span>
              <input
                type="search"
                placeholder="Region"
                aria-label="Filter by region"
                [ngModel]="filtersState().region"
                (ngModelChange)="updateFilter('region', $event)"
              />
            </label>
          </div>
          <div class="fl-toolbar__group">
            <span class="fl-toolbar__info"
              >{{ filteredClusters().length }}
              {{ filteredClusters().length === 1 ? 'cluster' : 'clusters' }}</span
            >
          </div>
        </div>

        @if (isLoading() && allClusters().length === 0) {
          <fl-loading-state [rows]="4" />
        } @else if (filteredClusters().length === 0) {
          <fl-empty-state
            [title]="activeFiltersCount() > 0 ? 'No matching clusters' : 'No clusters yet'"
            [body]="
              activeFiltersCount() > 0
                ? 'Nothing matches these filters.'
                : 'Create a cluster on one of your providers to start deploying.'
            "
          >
            @if (activeFiltersCount() > 0) {
              <button flButton size="sm" type="button" (click)="clearFilters()">
                Clear filters
              </button>
            } @else {
              <button
                flButton="primary"
                size="sm"
                type="button"
                [appReadOnlySection]="CLUSTER_SECTION_KEYS"
                (click)="createNewCluster()"
              >
                Create cluster
              </button>
            }
          </fl-empty-state>
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense" data-testid="cluster-table">
              <thead>
                <tr>
                  <th scope="col">Cluster</th>
                  <th scope="col">Status</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Region</th>
                  <th scope="col" class="is-num">Nodes</th>
                  <th scope="col">Version</th>
                  <th scope="col" class="is-num">Created</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (cluster of filteredClusters(); track cluster.id) {
                  @let st = statusOf(cluster);
                  @let deleting = cluster.status === ClusterStatus.DELETING;
                  <tr [attr.data-testid]="'cluster-row-' + cluster.id">
                    <td class="fl-cell-name">
                      @if (deleting) {
                        <span>{{ cluster.name }}</span>
                      } @else {
                        <a class="fl-link" [routerLink]="['/cluster', cluster.id]">{{
                          cluster.name
                        }}</a>
                      }
                      @if (managedByCli(cluster)) {
                        <fl-tag class="ml-2">{{
                          cluster.clusterType === 'observability' ? 'observability' : 'control'
                        }}</fl-tag>
                      }
                    </td>
                    <td>
                      <fl-status
                        [tone]="st.tone"
                        [label]="
                          deletionProgress()[cluster.id!] !== undefined
                            ? st.label + ' ' + deletionProgress()[cluster.id!] + '%'
                            : st.label
                        "
                      />
                    </td>
                    <td>{{ getProviderLabel(cluster.provider) }}</td>
                    <td class="fl-mono">{{ cluster.region || '—' }}</td>
                    <td class="is-num">{{ cluster.nodeCount ?? '—' }}</td>
                    <td class="fl-mono">{{ cluster.version || '—' }}</td>
                    <td class="is-num">
                      {{ cluster.createdAt ? formatDate(cluster.createdAt) : '—' }}
                    </td>
                    <td class="is-fit">
                      <fl-actions-menu
                        *fluiCan="'cluster:destroy'"
                        label="Cluster actions"
                        [compact]="true"
                        [items]="rowActions"
                        [appReadOnlySection]="CLUSTER_SECTION_KEYS"
                        [class.hidden]="deleting || managedByCli(cluster)"
                        [attr.data-testid]="'cluster-actions-' + cluster.id"
                        (action)="confirmDelete(cluster)"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    </div>

    @if (showDeleteModal()) {
      <app-cluster-delete-dialog
        [name]="clusterToDelete()?.name ?? 'cluster'"
        [deleting]="isDeleting()"
        [(force)]="forceDelete"
        (cancelled)="cancelDelete()"
        (confirmed)="executeDelete()"
      />
    }
  `,
})
export class ClusterListComponent implements OnInit, OnDestroy {
  private readonly clusterService = inject(ClusterService);
  private readonly providersService = inject(ProvidersService);
  private readonly router = inject(Router);
  private readonly currentSurface = inject(CurrentSurfaceService);

  readonly availableProviders = computed(() => this.providersService.availableProviders());

  ClusterStatus = ClusterStatus;

  protected readonly statusOptions = STATUS_FILTERS;

  protected readonly rowActions: MenuAction[] = [
    { id: 'delete', label: 'Delete cluster', danger: true },
  ];

  protected statusOf(cluster: ClusterInfo): { label: string; tone: StatusTone } {
    const s = CLUSTER_STATUS[cluster.status];
    return {
      label: s?.label ?? cluster.status ?? 'Unknown',
      tone: statusToneOf(s?.tone ?? 'muted'),
    };
  }

  protected managedByCli(cluster: ClusterInfo): boolean {
    return isControlClusterType(cluster.clusterType);
  }

  protected readonly CLUSTER_SECTION_KEYS = ['clusters', 'cluster'] as const;

  filtersState = signal<FilterState>({
    search: '',
    provider: '',
    status: '',
    region: '',
  });
  showDeleteModal = signal<boolean>(false);
  clusterToDelete = signal<ClusterInfo | null>(null);
  protected readonly forceDelete = signal(false);
  isDeleting = signal<boolean>(false);

  allClusters = this.clusterService.clusters;
  isLoading = this.clusterService.listIsLoading;
  errorMessage = this.clusterService.listErrorMessage;
  deletionProgress = this.clusterService.deletionProgress;

  filteredClusters = computed(() => {
    const clusters = this.allClusters();
    const filters = this.filtersState();

    return clusters.filter((cluster) => {
      if (filters.search && !cluster.name?.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      if (filters.provider && cluster.provider !== filters.provider) {
        return false;
      }

      if (filters.status && cluster.status !== filters.status) {
        return false;
      }

      if (filters.region && !cluster.region?.toLowerCase().includes(filters.region.toLowerCase())) {
        return false;
      }

      return true;
    });
  });

  activeFiltersCount = computed(() => {
    const filters = this.filtersState();
    let count = 0;
    if (filters.search) count++;
    if (filters.provider) count++;
    if (filters.status) count++;
    if (filters.region) count++;
    return count;
  });

  private readonly surfaceRevision = new ClusterListSurfaceRevision();

  readonly surface = computed(() => {
    const input: ClusterListSurfaceInput = {
      allClusters: this.allClusters(),
      filteredClusters: this.filteredClusters(),
      filters: this.filtersState(),
      loading: this.isLoading(),
    };
    const content = presentedContent(input);
    return buildClusterListSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    // Publish this page's own Semantic Surface snapshot into the shared registry
    // whenever it changes. ngOnDestroy clears it, so the snapshot never outlives this
    // page — same discipline as ApplicationDetailComponent/ClusterDashboardComponent.
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnInit(): void {
    void (async () => {
      this.providersService.loadProviders();
      await this.loadClusters();
    })();
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  async loadClusters() {
    try {
      await this.clusterService.loadClusters();
    } catch (error) {
      console.error('Failed to load clusters:', error);
    }
  }

  async refreshClusters() {
    await this.loadClusters();
  }

  updateFilter(field: keyof FilterState, value: string) {
    this.filtersState.update((current) => ({
      ...current,
      [field]: value,
    }));
  }

  clearFilters() {
    this.filtersState.set({
      search: '',
      provider: '',
      status: '',
      region: '',
    });
  }

  viewCluster(clusterId: string) {
    this.router.navigate(['/cluster', clusterId]);
  }

  confirmDelete(cluster: ClusterInfo) {
    this.clusterToDelete.set(cluster);
    this.forceDelete.set(false);
    this.showDeleteModal.set(true);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.clusterToDelete.set(null);
    this.forceDelete.set(false);
  }

  async executeDelete() {
    const cluster = this.clusterToDelete();
    if (!cluster?.id) return;

    this.isDeleting.set(true);

    try {
      await this.clusterService.deleteCluster(cluster.id, this.forceDelete());
      this.showDeleteModal.set(false);
      this.clusterToDelete.set(null);
      this.forceDelete.set(false);
    } catch (error) {
      console.error('Failed to delete cluster:', error);
    } finally {
      this.isDeleting.set(false);
    }
  }

  createNewCluster() {
    this.router.navigate(['/cluster/new']);
  }

  getProviderLabel(provider?: ProviderType): string {
    if (!provider) return 'Unknown';
    return this.providersService.getProviderById(provider)?.displayName ?? provider;
  }

  formatDate(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - new Date(date).getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return new Date(date).toLocaleDateString();
  }
}
