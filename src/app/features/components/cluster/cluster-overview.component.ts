import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCloud,
  lucideServer,
  lucideSettings,
  lucideArrowRight,
  lucideCircleAlert,
  lucideLoader,
  lucideActivity,
  lucideZap,
  lucideCheck
} from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { ClusterViewMode } from '../../model/cluster.models';
import { ClusterListComponent } from './cluster-list.component';

@Component({
  selector: 'cluster-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIcon, ClusterListComponent],
  providers: [
    provideIcons({
      lucideCloud,
      lucideServer,
      lucideSettings,
      lucideArrowRight,
      lucideCircleAlert,
      lucideLoader,
      lucideActivity,
      lucideZap,
      lucideCheck
    })
  ],
  template: `
    <div class="space-y-6">
      @switch (currentView()) {

        @case (ClusterViewMode.LOADING) {
          <!-- Loading State with Pulse Effect -->
          <div class="space-y-6 p-6">
            <!-- Header Skeleton -->
            <div class="flex items-center justify-between">
              <div class="space-y-2">
                <div class="skeleton h-8 w-32"></div>
                <div class="skeleton h-4 w-48"></div>
              </div>
              <div class="skeleton h-10 w-40"></div>
            </div>

            <!-- Search and Filters Skeleton -->
            <div class="flex items-center gap-4">
              <div class="skeleton h-10 flex-1"></div>
              <div class="skeleton h-10 w-32"></div>
              <div class="skeleton h-10 w-32"></div>
            </div>

            <!-- Cluster Cards Grid Skeleton -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <!-- Skeleton Card 1 -->
              <div class="animate-pulse card-surface overflow-hidden">
                <div class="p-6 space-y-4">
                  <div class="flex items-start justify-between">
                    <div class="skeleton h-6 w-32"></div>
                    <div class="skeleton h-6 w-20"></div>
                  </div>
                  <div class="skeleton h-4 w-24"></div>
                  <div class="space-y-2">
                    <div class="skeleton h-3 w-full"></div>
                    <div class="skeleton h-3 w-3/4"></div>
                  </div>
                  <div class="flex gap-3 pt-2">
                    <div class="skeleton h-10 flex-1"></div>
                    <div class="skeleton h-10 w-10"></div>
                    <div class="skeleton h-10 w-10"></div>
                  </div>
                </div>
              </div>

              <!-- Skeleton Card 2 -->
              <div class="animate-pulse card-surface overflow-hidden">
                <div class="p-6 space-y-4">
                  <div class="flex items-start justify-between">
                    <div class="skeleton h-6 w-32"></div>
                    <div class="skeleton h-6 w-20"></div>
                  </div>
                  <div class="skeleton h-4 w-24"></div>
                  <div class="space-y-2">
                    <div class="skeleton h-3 w-full"></div>
                    <div class="skeleton h-3 w-3/4"></div>
                  </div>
                  <div class="flex gap-3 pt-2">
                    <div class="skeleton h-10 flex-1"></div>
                    <div class="skeleton h-10 w-10"></div>
                    <div class="skeleton h-10 w-10"></div>
                  </div>
                </div>
              </div>

              <!-- Skeleton Card 3 -->
              <div class="animate-pulse card-surface overflow-hidden">
                <div class="p-6 space-y-4">
                  <div class="flex items-start justify-between">
                    <div class="skeleton h-6 w-32"></div>
                    <div class="skeleton h-6 w-20"></div>
                  </div>
                  <div class="skeleton h-4 w-24"></div>
                  <div class="space-y-2">
                    <div class="skeleton h-3 w-full"></div>
                    <div class="skeleton h-3 w-3/4"></div>
                  </div>
                  <div class="flex gap-3 pt-2">
                    <div class="skeleton h-10 flex-1"></div>
                    <div class="skeleton h-10 w-10"></div>
                    <div class="skeleton h-10 w-10"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }

        @case (ClusterViewMode.LIST) {
          <!-- Cluster List View -->
          <cluster-list />
        }

        @case (ClusterViewMode.NO_PROVIDER) {
          <!-- Header -->
          <div class="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div>
              <h1 class="text-3xl font-bold tracking-tight">Cluster</h1>
              <p class="text-muted-foreground">
                Manage your cloud cluster and scaling configuration
              </p>
            </div>
          </div>

          <!-- No Provider Configured -->
          <div class="rounded-lg border border-border bg-card p-8 text-center">
            <div class="mx-auto mb-4 h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <ng-icon name="lucideSettings" class="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h2 class="text-xl font-semibold mb-2">No Cloud Provider Configured</h2>
            <p class="text-muted-foreground mb-6 max-w-md mx-auto">
              Before creating your cluster, you need to configure at least one cloud provider.
              This allows us to deploy servers on your preferred infrastructure.
            </p>
            <a
              routerLink="/management/providers"
              class="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ng-icon name="lucideSettings" class="h-4 w-4 mr-2" />
              Configure Providers
              <ng-icon name="lucideArrowRight" class="h-4 w-4 ml-2" />
            </a>
          </div>
        }

        @case (ClusterViewMode.NO_CLUSTER) {
          <!-- Header -->
          <div class="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div>
              <h1 class="text-3xl font-bold tracking-tight">Cluster</h1>
              <p class="text-muted-foreground">
                Manage your cloud cluster and scaling configuration
              </p>
            </div>
          </div>

          <!-- No Cluster Created -->
          <div class="rounded-lg border border-border bg-card p-8 text-center">
            <div class="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <ng-icon name="lucideCloud" class="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 class="text-xl font-semibold mb-2">Ready to Create Your Cluster</h2>
            <p class="text-muted-foreground mb-6 max-w-md mx-auto">
              You have {{ configuredProvidersCount() }} provider(s) configured.
              Now let's create your cloud cluster to start deploying applications.
            </p>
            <button
              (click)="startClusterCreation()"
              class="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ng-icon name="lucideCloud" class="h-4 w-4 mr-2" />
              Create Cluster
              <ng-icon name="lucideArrowRight" class="h-4 w-4 ml-2" />
            </button>
          </div>
        }
      }

      <!-- Success Message Toast -->
      @if (showSuccessMessage()) {
        <div class="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg transition-all z-50">
          <div class="flex items-center space-x-2">
            <ng-icon name="lucideCheck" class="h-5 w-5" />
            <span>{{ successMessage() }}</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class ClusterOverviewComponent implements OnInit {

  private readonly clusterService = inject(ClusterService);
  private readonly router = inject(Router);

  // Expose enum to template
  ClusterViewMode = ClusterViewMode;

  readonly clusterInfo = this.clusterService.cluster;
  readonly isLoading = this.clusterService.loading;
  readonly errorMessage = this.clusterService.errorMessage;
  readonly allClusters = this.clusterService.clusters;

  // Combined loading state for all API calls
  readonly isAnyLoading = computed(() =>
    this.clusterService.loading() ||
    this.clusterService.listIsLoading() ||
    this.clusterService.providersIsLoading()
  );

  // View management
  currentView = signal<ClusterViewMode>(ClusterViewMode.LOADING);
  showSuccessMessage = signal<boolean>(false);
  successMessage = signal<string>('');

  readonly configuredProvidersCount = computed(() => {
    return this.clusterService.getConfiguredProvidersCount();
  });

  ngOnInit(): void {
    void (async () => {
      await this.loadClustersData();
    })();
  }

  private async loadClustersData(): Promise<void> {
    try {
      // Load providers first
      await this.clusterService.loadProviders();

      // Load all clusters
      await this.clusterService.loadClusters();

      // Update view mode based on data
      this.updateViewMode();
    } catch (error) {
      console.error('Failed to load clusters:', error);
    }
  }

  private updateViewMode(): void {
    // Check providers first
    if (!this.clusterService.hasConfiguredProviders()) {
      this.currentView.set(ClusterViewMode.NO_PROVIDER);
      return;
    }

    const clusters = this.allClusters();

    // If there are clusters, show list (includes creating, active, etc.)
    if (clusters.length > 0) {
      this.currentView.set(ClusterViewMode.LIST);
      return;
    }

    // No clusters at all
    this.currentView.set(ClusterViewMode.NO_CLUSTER);
  }

  startClusterCreation(): void {
    this.router.navigate(['/cluster/new']);
  }

  async retryClusterCreation(): Promise<void> {
    try {
      this.clusterService.clearError();
      await this.loadClustersData();
    } catch (error) {
      console.error('Failed to retry cluster creation:', error);
    }
  }

  getProviderDisplayName(): string {
    const provider = this.clusterInfo()?.provider;
    return this.clusterService.getProviderDisplayName(provider);
  }

  getFormattedTime(date?: Date): string {
    if (!date) return 'Unknown';

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return date.toLocaleDateString();
  }

  private showSuccess(message: string): void {
    this.successMessage.set(message);
    this.showSuccessMessage.set(true);

    setTimeout(() => {
      this.showSuccessMessage.set(false);
    }, 3000);
  }

  private showError(message: string): void {
    console.error(message);
    // You can add a toast notification for errors here
  }
}
