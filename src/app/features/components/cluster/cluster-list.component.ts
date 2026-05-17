import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCw,
  lucideSearch,
  lucideServer,
  lucideTrash2,
  lucideDownload,
  lucideEye,
  lucideX,
  lucideCircleAlert,
  lucideLoader,
  lucidePlus,
  lucideMapPin,
  lucideTag,
  lucideZap,
  lucideCalendar,
  lucideCloud,
  lucideCircleCheck,
  lucideCircle,
  lucidePause,
  lucidePlay
} from '@ng-icons/lucide';

import { ClusterService } from '../../service/cluster.service';
import { ProvidersService } from '../../service/providers.service';
import { ClusterInfo, ClusterStatus, ClusterType, ProviderType } from '../../model/cluster.models';

interface FilterState {
  search: string;
  provider: string;
  status: string;
  region: string;
}

@Component({
  selector: 'cluster-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideRefreshCw,
      lucideSearch,
      lucideServer,
      lucideTrash2,
      lucideDownload,
      lucideEye,
      lucideX,
      lucideCircleAlert,
      lucideLoader,
      lucidePlus,
      lucideMapPin,
      lucideTag,
      lucideZap,
      lucideCalendar,
      lucideCloud,
      lucideCircleCheck,
      lucideCircle,
      lucidePause,
      lucidePlay
    }),
  ],
  template: `
    <div class="space-y-6 p-6">
      <!-- Header with Actions -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-foreground">
            Kubernetes Clusters
          </h1>
          <p class="mt-2 text-sm text-sub">
            Manage your K3s clusters across multiple providers
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            (click)="refreshClusters()"
            [disabled]="isLoading()"
            title="Refresh"
            class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ng-icon name="lucideRefreshCw" class="h-4 w-4" [class.animate-spin]="isLoading()" />
          </button>
          <button
            (click)="createNewCluster()"
            class="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 dark:bg-blue-500/20 text-white dark:text-blue-400 border border-transparent dark:border-blue-500/40 rounded-md hover:bg-blue-700 dark:hover:bg-blue-500/30 transition-colors text-sm font-medium"
          >
            <ng-icon name="lucidePlus" class="h-4 w-4" />
            <span>Create Cluster</span>
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="card-inner border border-border rounded-lg p-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <!-- Search -->
          <div class="relative">
            <ng-icon
              name="lucideSearch"
              class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            />
            <input
              type="text"
              [ngModel]="filtersState().search"
              (ngModelChange)="updateFilter('search', $event)"
              placeholder="Search clusters..."
              class="w-full h-9 pl-10 pr-3 border border-border rounded-md bg-background text-sm text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
          </div>

          <!-- Provider Filter -->
          <select
            [ngModel]="filtersState().provider"
            (ngModelChange)="updateFilter('provider', $event)"
            class="h-9 px-3 border border-border rounded-md bg-background text-sm text-foreground focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 appearance-none"
          >
            <option value="">All Providers</option>
            @for (p of availableProviders(); track p.id) {
              <option [value]="p.id">{{ p.displayName }}</option>
            }
          </select>

          <!-- Status Filter -->
          <select
            [ngModel]="filtersState().status"
            (ngModelChange)="updateFilter('status', $event)"
            class="h-9 px-3 border border-border rounded-md bg-background text-sm text-foreground focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="creating">Creating</option>
            <option value="scaling">Scaling</option>
            <option value="updating">Updating</option>
            <option value="error">Error</option>
          </select>

          <!-- Region Filter -->
          <input
            type="text"
            [ngModel]="filtersState().region"
            (ngModelChange)="updateFilter('region', $event)"
            placeholder="Filter by region..."
            class="h-9 px-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
        </div>

        <!-- Active Filters Count -->
        @if (activeFiltersCount() > 0) {
          <div class="mt-3 flex items-center justify-between">
            <span class="text-sm text-sub">
              {{ activeFiltersCount() }} filter(s) active
            </span>
            <button
              (click)="clearFilters()"
              class="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          </div>
        }
      </div>

      <!-- Loading State -->
      @if (isLoading()) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (i of [1,2,3]; track i) {
            <div class="animate-pulse card-surface overflow-hidden border-l-4 border-l-border">
              <div class="p-6 space-y-4">
                <div class="flex items-start justify-between">
                  <div class="skeleton h-6 w-36"></div>
                  <div class="skeleton h-5 w-16 ml-2"></div>
                </div>
                <div class="flex items-center gap-2">
                  <div class="skeleton h-4 w-4"></div>
                  <div class="skeleton h-4 w-20"></div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="skeleton h-3 w-24"></div>
                  <div class="skeleton h-3 w-16"></div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="skeleton h-3 w-16"></div>
                  <div class="skeleton h-3 w-20"></div>
                </div>
              </div>
              <div class="px-6 pb-6 flex items-center gap-3">
                <div class="skeleton h-10 flex-1"></div>
                <div class="skeleton h-10 w-10"></div>
                <div class="skeleton h-10 w-10"></div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Error State -->
      @if (errorMessage() && !isLoading()) {
        <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div class="flex items-center gap-3">
            <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-red-600 dark:text-red-400" />
            <div class="flex-1">
              <p class="text-sm font-medium text-red-900 dark:text-red-200">Failed to load clusters</p>
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ errorMessage() }}</p>
            </div>
          </div>
        </div>
      }

      <!-- Clusters Grid -->
      @if (!isLoading() && !errorMessage()) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (cluster of filteredClusters(); track cluster.id) {
            <div class="relative card-surface overflow-hidden hover:shadow-lg dark:hover:shadow-black/40 transition-all duration-300 border-l-4"
                 [class]="getStatusBorderClass(cluster.status)">

              <!-- Deleting overlay -->
              @if (cluster.status === ClusterStatus.DELETING) {
                <div class="absolute inset-0 bg-background/70 dark:bg-background/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-2 rounded-lg">
                  <ng-icon name="lucideLoader" class="h-8 w-8 text-muted-foreground animate-spin" />
                  <span class="text-sm font-medium text-muted-foreground">
                    Deleting
                    @if (deletionProgress()[cluster.id!] !== undefined) {
                      <span>{{ deletionProgress()[cluster.id!] }}%</span>
                    }
                    …
                  </span>
                </div>
              }

              <!-- Body -->
              <div class="p-6">
                <!-- Cluster name with status badge -->
                <div class="flex items-start justify-between mb-3">
                  <h3 class="text-xl font-bold text-foreground truncate flex-1">
                    {{ cluster.name }}
                  </h3>
                  <span [class]="getStatusBadgeClass(cluster.status)" class="flex items-center gap-1 ml-2 flex-shrink-0">
                    <ng-icon
                      [name]="getStatusIcon(cluster.status)"
                      class="h-3 w-3"
                      [class.animate-spin]="cluster.status === ClusterStatus.CREATING || cluster.status === ClusterStatus.SCALING || cluster.status === ClusterStatus.UPDATING || cluster.status === ClusterStatus.DELETING"
                    />
                    {{ getStatusLabel(cluster.status) }}
                    @if (cluster.status === ClusterStatus.DELETING && deletionProgress()[cluster.id!] !== undefined) {
                      <span class="opacity-75 text-xs">{{ deletionProgress()[cluster.id!] }}%</span>
                    }
                  </span>
                </div>

                <!-- Provider info -->
                <div class="flex items-center gap-2 text-muted-foreground mb-4">
                  <ng-icon [name]="getProviderIcon(cluster.provider)" class="h-4 w-4" />
                  <span class="text-sm font-medium">{{ getProviderLabel(cluster.provider) }}</span>
                </div>

                <!-- Info con icone - Riga 1 -->
                <div class="flex items-center flex-wrap gap-3 text-sm text-sub mb-2">
                  <span class="flex items-center gap-1">
                    <ng-icon name="lucideMapPin" class="h-4 w-4" />
                    {{ cluster.region }}
                  </span>
                  <span class="text-border">•</span>
                  <span class="flex items-center gap-1">
                    <ng-icon name="lucideServer" class="h-4 w-4" />
                    {{ cluster.nodeCount }} nodes
                  </span>
                  @if (cluster.autoScalingEnabled) {
                    <span class="text-border">•</span>
                    <span class="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                      <ng-icon name="lucideZap" class="h-4 w-4" />
                      Auto
                    </span>
                  }
                </div>

                <!-- Info con icone - Riga 2 -->
                <div class="flex items-center flex-wrap gap-3 text-sm text-sub">
                  <span class="flex items-center gap-1">
                    <ng-icon name="lucideTag" class="h-4 w-4" />
                    {{ cluster.version || 'N/A' }}
                  </span>
                  @if (cluster.createdAt) {
                    <span class="text-border">•</span>
                    <span class="flex items-center gap-1">
                      <ng-icon name="lucideCalendar" class="h-4 w-4" />
                      {{ formatDate(cluster.createdAt) }}
                    </span>
                  }
                </div>
              </div>

              <!-- Actions -->
              <div class="px-6 pb-6 flex items-center gap-3">
                <button
                  (click)="viewCluster(cluster.id!)"
                  [disabled]="cluster.status === ClusterStatus.DELETING"
                  class="flex-1 flex items-center justify-center gap-2 h-10 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <ng-icon name="lucideEye" class="h-4 w-4" />
                  View
                </button>
                <button
                  (click)="downloadKubeconfig(cluster.id!, cluster.name!)"
                  [disabled]="cluster.status !== ClusterStatus.ACTIVE"
                  class="h-10 w-10 inline-flex items-center justify-center border border-border text-muted-foreground rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download Kubeconfig"
                >
                  <ng-icon name="lucideDownload" class="h-4 w-4" />
                </button>
                <button
                  (click)="confirmDelete(cluster)"
                  [disabled]="cluster.status === ClusterStatus.DELETING || cluster.clusterType === ClusterType.OBSERVABILITY"
                  class="h-10 w-10 inline-flex items-center justify-center border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  [title]="cluster.clusterType === ClusterType.OBSERVABILITY ? 'Observability cluster can only be managed via CLI' : 'Delete Cluster'"
                >
                  <ng-icon name="lucideTrash2" class="h-4 w-4" />
                </button>
              </div>
            </div>
          }

          <!-- Create Cluster Card - Sempre visibile quando ci sono cluster -->
          @if (filteredClusters().length > 0) {
            <div
              (click)="createNewCluster()"
              class="card-surface border-2 border-dashed rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all duration-300 cursor-pointer group flex flex-col items-center justify-center p-8 min-h-full"
            >
              <div class="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                <ng-icon name="lucidePlus" class="h-10 w-10 text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              </div>

              <h3 class="text-lg font-semibold text-foreground mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Create New Cluster
              </h3>

              <p class="text-sm text-sub text-center max-w-xs">
                Click to configure and deploy a new Kubernetes cluster
              </p>
            </div>
          }

          @if (filteredClusters().length === 0) {
            <!-- Empty State -->
            <div class="col-span-full flex flex-col items-center justify-center py-12">
              <ng-icon name="lucideServer" class="h-16 w-16 text-muted-foreground mb-4" />
              <h3 class="text-lg font-semibold text-foreground mb-2">
                No clusters found
              </h3>
              <p class="text-sm text-sub mb-6">
                @if (activeFiltersCount() > 0) {
                  Try adjusting your filters or clear them to see all clusters
                } @else {
                  Get started by creating your first Kubernetes cluster
                }
              </p>
              @if (activeFiltersCount() > 0) {
                <button
                  (click)="clearFilters()"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Clear Filters
                </button>
              } @else {
                <button
                  (click)="createNewCluster()"
                  class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ng-icon name="lucidePlus" class="h-4 w-4" />
                  Create Your First Cluster
                </button>
              }
            </div>
          }
        </div>
      }

      <!-- Results Count -->
      @if (filteredClusters().length > 0) {
        <div class="text-center text-sm text-sub">
          Showing {{ filteredClusters().length }} of {{ allClusters().length }} cluster(s)
        </div>
      }
    </div>

    <!-- Delete Confirmation Modal -->
    @if (showDeleteModal()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="card-surface rounded-lg max-w-md w-full p-6 shadow-xl">
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0">
              <div class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <ng-icon name="lucideCircleAlert" class="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-foreground mb-2">
                Delete Cluster
              </h3>
              <p class="text-sm text-sub mb-4">
                Are you sure you want to delete <strong>{{ clusterToDelete()?.name }}</strong>?
                This action cannot be undone and will permanently remove all cluster resources.
              </p>

              <!-- Force Delete Option -->
              <label class="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  [(ngModel)]="forceDelete"
                  class="rounded border-border text-blue-600 focus:ring-blue-500"
                />
                <span class="text-sm text-foreground">
                  Force delete (skip cleanup)
                </span>
              </label>

              <div class="flex items-center gap-3">
                <button
                  (click)="cancelDelete()"
                  [disabled]="isDeleting()"
                  class="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  (click)="executeDelete()"
                  [disabled]="isDeleting()"
                  class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  @if (isDeleting()) {
                    <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                    Deleting...
                  } @else {
                    <ng-icon name="lucideTrash2" class="h-4 w-4" />
                    Delete Cluster
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ClusterListComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly providersService = inject(ProvidersService);
  private readonly router = inject(Router);

  readonly availableProviders = computed(() => this.providersService.availableProviders());

  // Expose enums to template
  ClusterStatus = ClusterStatus;
  ClusterType = ClusterType;

  // State signals
  filtersState = signal<FilterState>({
    search: '',
    provider: '',
    status: '',
    region: '',
  });
  showDeleteModal = signal<boolean>(false);
  clusterToDelete = signal<ClusterInfo | null>(null);
  forceDelete = false;
  isDeleting = signal<boolean>(false);

  // Data from service
  allClusters = this.clusterService.clusters;
  isLoading = this.clusterService.listIsLoading;
  errorMessage = this.clusterService.listErrorMessage;
  deletionProgress = this.clusterService.deletionProgress;

  // Computed signals
  filteredClusters = computed(() => {
    const clusters = this.allClusters();
    const filters = this.filtersState();

    return clusters.filter((cluster) => {
      // Search filter
      if (
        filters.search &&
        !cluster.name?.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      // Provider filter
      if (filters.provider && cluster.provider !== filters.provider) {
        return false;
      }

      // Status filter
      if (filters.status && cluster.status !== filters.status) {
        return false;
      }

      // Region filter
      if (
        filters.region &&
        !cluster.region?.toLowerCase().includes(filters.region.toLowerCase())
      ) {
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

  ngOnInit(): void {
    void (async () => {
      this.providersService.loadProviders();
      await this.loadClusters();
    })();
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
    this.filtersState.update(current => ({
      ...current,
      [field]: value
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

  async downloadKubeconfig(clusterId: string, clusterName: string) {
    try {
      const kubeconfig = await this.clusterService.downloadKubeconfig(clusterId);
      this.clusterService.downloadKubeconfigFile(kubeconfig, clusterName);
    } catch (error) {
      console.error('Failed to download kubeconfig:', error);
    }
  }

  confirmDelete(cluster: ClusterInfo) {
    this.clusterToDelete.set(cluster);
    this.forceDelete = false;
    this.showDeleteModal.set(true);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.clusterToDelete.set(null);
    this.forceDelete = false;
  }

  async executeDelete() {
    const cluster = this.clusterToDelete();
    if (!cluster?.id) return;

    this.isDeleting.set(true);

    try {
      await this.clusterService.deleteCluster(cluster.id, this.forceDelete);
      this.showDeleteModal.set(false);
      this.clusterToDelete.set(null);
      this.forceDelete = false;
      // Cluster will be removed from list automatically by ClusterService
      // when socket/polling confirms completion
    } catch (error) {
      console.error('Failed to delete cluster:', error);
    } finally {
      this.isDeleting.set(false);
    }
  }

  createNewCluster() {
    this.router.navigate(['/cluster/new']);
  }

  // Helper methods
  getStatusBadgeClass(status?: ClusterStatus): string {
    const baseClasses = 'text-xs px-2 py-1 rounded font-medium';

    switch (status) {
      case ClusterStatus.ACTIVE:
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
      case ClusterStatus.CREATING:
        return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400`;
      case ClusterStatus.SCALING:
      case ClusterStatus.UPDATING:
      case ClusterStatus.STOPPING:
      case ClusterStatus.STARTING:
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`;
      case ClusterStatus.STOPPED:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`;
      case ClusterStatus.ERROR:
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      case ClusterStatus.DELETING:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`;
    }
  }

  getStatusLabel(status?: ClusterStatus): string {
    switch (status) {
      case ClusterStatus.ACTIVE:
        return 'Active';
      case ClusterStatus.CREATING:
        return 'Creating';
      case ClusterStatus.SCALING:
        return 'Scaling';
      case ClusterStatus.UPDATING:
        return 'Updating';
      case ClusterStatus.ERROR:
        return 'Error';
      case ClusterStatus.DELETING:
        return 'Deleting';
      case ClusterStatus.STOPPED:
        return 'Stopped';
      case ClusterStatus.STOPPING:
        return 'Stopping...';
      case ClusterStatus.STARTING:
        return 'Starting...';
      default:
        return 'Unknown';
    }
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

  // Provider styling helpers
  getProviderIcon(provider?: ProviderType): string {
    return 'lucideCloud'; // Using same icon for all providers
  }

  getStatusBorderClass(status?: ClusterStatus): string {
    switch (status) {
      case ClusterStatus.ACTIVE:
        return 'border-l-green-500';
      case ClusterStatus.CREATING:
        return 'border-l-blue-500';
      case ClusterStatus.ERROR:
        return 'border-l-red-500';
      case ClusterStatus.SCALING:
      case ClusterStatus.UPDATING:
        return 'border-l-yellow-500';
      case ClusterStatus.DELETING:
        return 'border-l-gray-500';
      default:
        return 'border-l-gray-300';
    }
  }

  getStatusIcon(status?: ClusterStatus): string {
    switch (status) {
      case ClusterStatus.ACTIVE:
        return 'lucideCircleCheck';
      case ClusterStatus.CREATING:
        return 'lucideLoader';
      case ClusterStatus.SCALING:
      case ClusterStatus.UPDATING:
        return 'lucideLoader';
      case ClusterStatus.STOPPING:
        return 'lucidePause';
      case ClusterStatus.STARTING:
        return 'lucidePlay';
      case ClusterStatus.STOPPED:
        return 'lucideCircle';
      case ClusterStatus.ERROR:
        return 'lucideCircleAlert';
      case ClusterStatus.DELETING:
        return 'lucideCircle';
      default:
        return 'lucideCircle';
    }
  }
}
