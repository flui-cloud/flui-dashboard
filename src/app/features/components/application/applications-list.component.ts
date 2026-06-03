import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCw,
  lucideSearch,
  lucidePackage,
  lucideLoader,
  lucideCircleAlert,
  lucideTrash2,
  lucideRocket,
  lucideCircleCheck,
  lucideCircleX,
  lucideShield,
} from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import { ClusterService } from '../../service/cluster.service';
import {
  Application,
  AppGroupView,
  ApplicationKind,
  ApplicationKindEnum,
  getKindLabel,
} from '../../model/application.models';
import { ApplicationGroupRowComponent } from './application-group-row.component';

interface FilterState {
  search: string;
  category: string;
  status: string;
  cluster: string;
}

@Component({
  selector: 'app-applications-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, ApplicationGroupRowComponent],
  providers: [
    provideIcons({
      lucideRefreshCw,
      lucideSearch,
      lucidePackage,
      lucideLoader,
      lucideCircleAlert,
      lucideTrash2,
      lucideRocket,
      lucideCircleCheck,
      lucideCircleX,
      lucideShield,
    }),
  ],
  template: `
    <div class="space-y-6 p-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ pageTitle() }}</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ pageSubtitle() }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          @if (isBackgroundRefreshing()) {
            <span class="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
              <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
              Syncing...
            </span>
          }
          <button
            (click)="refreshApplications()"
            [disabled]="isLoading()"
            class="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm"
          >
            <ng-icon name="lucideRefreshCw" class="h-4 w-4" [class.animate-spin]="isLoading()" />
            Refresh
          </button>
          @if (canDeploy()) {
            <button
              (click)="deployNewApp()"
              class="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <ng-icon name="lucideRocket" class="h-4 w-4" />
              {{ ctaLabel() }}
            </button>
          }
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 rounded-lg px-4 py-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">Total</p>
          <p class="text-xl font-bold text-gray-900 dark:text-white">{{ kindScopedGroups().length }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800/60 border border-green-200 dark:border-gray-700/50 rounded-lg px-4 py-3">
          <p class="text-xs text-green-600 dark:text-green-400">Running</p>
          <p class="text-xl font-bold text-green-700 dark:text-green-400">{{ kindRunningCount() }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800/60 border border-red-200 dark:border-gray-700/50 rounded-lg px-4 py-3">
          <p class="text-xs text-red-600 dark:text-red-400">Failed</p>
          <p class="text-xl font-bold text-red-700 dark:text-red-400">{{ kindFailedCount() }}</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-col md:flex-row gap-3">
        <div class="relative flex-1">
          <ng-icon name="lucideSearch" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            [ngModel]="filtersState().search"
            (ngModelChange)="updateFilter('search', $event)"
            placeholder="Search applications..."
            class="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          [ngModel]="filtersState().category"
          (ngModelChange)="updateFilter('category', $event)"
          class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
        >
          <option value="">All Categories</option>
          <option value="system">System</option>
          <option value="user">User</option>
        </select>
        <select
          [ngModel]="filtersState().status"
          (ngModelChange)="updateFilter('status', $event)"
          class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
        >
          <option value="">All Statuses</option>
          <option value="running">Running</option>
          <option value="provisioning">Provisioning</option>
          <option value="pending">Pending</option>
          <option value="degraded">Degraded</option>
          <option value="stopped">Stopped</option>
          <option value="failed">Failed</option>
          <option value="updating">Updating</option>
        </select>
        <select
          [ngModel]="filtersState().cluster"
          (ngModelChange)="updateFilter('cluster', $event)"
          class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
        >
          <option value="">All Clusters</option>
          @for (cluster of clusterNames(); track cluster.id) {
            <option [value]="cluster.id">{{ cluster.name }}</option>
          }
        </select>
      </div>

      @if (activeFiltersCount() > 0) {
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-500 dark:text-gray-400">{{ activeFiltersCount() }} filter(s) active</span>
          <button (click)="clearFilters()" class="text-blue-600 hover:text-blue-700 dark:text-blue-400">Clear all</button>
        </div>
      }

      <!-- Error -->
      @if (errorMessage() && !isLoading()) {
        <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideCircleAlert" class="h-4 w-4 text-red-600 dark:text-red-400" />
            <p class="text-sm text-red-900 dark:text-red-200">{{ errorMessage() }}</p>
          </div>
        </div>
      }

      <!-- Application rows -->
      <div class="flex flex-col gap-0.5">
        @if (isInitialLoading()) {
          @for (i of skeletonRows; track i) {
            <div class="animate-pulse bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg h-14"></div>
          }
        } @else if (filteredGroups().length === 0) {
          <div class="flex flex-col items-center justify-center py-16">
            <ng-icon name="lucidePackage" class="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ emptyTitle() }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
              @if (activeFiltersCount() > 0) {
                Try adjusting your filters
              } @else {
                {{ emptySubtitle() }}
              }
            </p>
            @if (activeFiltersCount() === 0 && canDeploy()) {
              <button
                (click)="deployNewApp()"
                class="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <ng-icon name="lucideRocket" class="h-4 w-4" />
                {{ ctaLabel() }}
              </button>
            }
          </div>
        } @else {
          @for (group of filteredGroups(); track group.id) {
            <app-application-group-row
              [group]="group"
              [refreshing]="isRefreshing()"
              (view)="viewApplication($event)"
              (delete)="confirmDelete($event)"
              (openBundle)="openBundleDetail($event)"
            />
          }
        }
      </div>

      @if (filteredGroups().length > 0) {
        <p class="text-center text-xs text-gray-500 dark:text-gray-400">
          Showing {{ filteredGroups().length }} of {{ kindScopedGroups().length }} application(s)
        </p>
      }
    </div>

    <!-- Delete Modal -->
    @if (showDeleteModal()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg max-w-sm w-full p-5 shadow-xl">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div class="flex-1">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">Delete Application</h3>
              <p class="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Delete <strong>{{ appToDelete()?.name }}</strong>? This removes the deployment and all related resources.
              </p>
              <div class="flex items-center gap-2">
                <button
                  (click)="cancelDelete()"
                  [disabled]="false"
                  class="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  (click)="executeDelete()"
                  [disabled]="false"
                  class="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ApplicationsListComponent implements OnInit {
  private readonly appService = inject(ApplicationService);
  private readonly clusterService = inject(ClusterService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  skeletonRows = [1, 2, 3, 4, 5];

  // State
  kind = signal<ApplicationKind>(
    (this.route.snapshot.data['kind'] as ApplicationKind | undefined) ??
      ApplicationKindEnum.Application,
  );
  filtersState = signal<FilterState>({ search: '', category: '', status: '', cluster: '' });
  showDeleteModal = signal(false);
  appToDelete = signal<Application | null>(null);

  // Service signals
  allApplications = this.appService.applications;
  isLoading = this.appService.loading;
  isBackgroundRefreshing = this.appService.backgroundRefreshing;
  errorMessage = this.appService.errorMessage;

  pageTitle = computed(() => getKindLabel(this.kind()));
  pageSubtitle = computed(() => {
    switch (this.kind()) {
      case ApplicationKindEnum.Database:
        return 'Manage database workloads across your clusters';
      case ApplicationKindEnum.Tool:
        return 'Manage tools and utilities across your clusters';
      case ApplicationKindEnum.System:
        return 'Platform-managed system applications';
      default:
        return 'Manage your applications across your clusters';
    }
  });

  canDeploy = computed(() => this.kind() !== ApplicationKindEnum.System);

  ctaLabel = computed(() => {
    switch (this.kind()) {
      case ApplicationKindEnum.Database:
        return 'Add Database';
      case ApplicationKindEnum.Tool:
        return 'Add Tool';
      case ApplicationKindEnum.System:
        return 'Add System App';
      default:
        return 'Add Application';
    }
  });

  emptyTitle = computed(() => {
    switch (this.kind()) {
      case ApplicationKindEnum.Database:
        return 'No databases found';
      case ApplicationKindEnum.Tool:
        return 'No tools found';
      case ApplicationKindEnum.System:
        return 'No system applications found';
      default:
        return 'No applications found';
    }
  });

  emptySubtitle = computed(() => {
    switch (this.kind()) {
      case ApplicationKindEnum.Database:
        return 'Deploy your first database to get started';
      case ApplicationKindEnum.Tool:
        return 'Deploy your first tool to get started';
      case ApplicationKindEnum.System:
        return 'No system applications are currently deployed';
      default:
        return 'Deploy your first application to get started';
    }
  });

  allGroups = this.appService.applicationGroups;

  kindScopedGroups = computed(() =>
    this.allGroups().filter((g) => this.groupKind(g) === this.kind()),
  );
  kindRunningCount = computed(
    () => this.kindScopedGroups().filter((g) => g.status === 'running').length,
  );
  kindFailedCount = computed(
    () => this.kindScopedGroups().filter((g) => g.status === 'failed').length,
  );

  clusterNames = computed(() =>
    this.clusterService.clusters().map((c) => ({ id: c.id, name: c.name }))
  );

  isInitialLoading = computed(() => this.isLoading() && this.allApplications().length === 0);
  isRefreshing = computed(() => this.isLoading() && this.allApplications().length > 0);

  filteredGroups = computed(() => {
    const groups = this.kindScopedGroups();
    const f = this.filtersState();
    return groups.filter((g) => {
      if (f.search && !g.name.toLowerCase().includes(f.search.toLowerCase())) return false;
      if (f.category && g.category !== f.category) return false;
      if (f.status && g.status !== f.status) return false;
      if (f.cluster && g.clusterId !== f.cluster) return false;
      return true;
    });
  });

  private groupKind(g: AppGroupView): ApplicationKind {
    const primary =
      g.components.find((c) => c.id === g.primaryComponentId) ?? g.components[0];
    return primary?.kind ?? ApplicationKindEnum.Application;
  }

  activeFiltersCount = computed(() => {
    const f = this.filtersState();
    return (f.search ? 1 : 0) + (f.category ? 1 : 0) + (f.status ? 1 : 0) + (f.cluster ? 1 : 0);
  });

  ngOnInit(): void {
    void (async () => {
      try {
        await this.appService.loadApplications();
      } catch (error) {
        console.error('Failed to load applications:', error);
      }
    })();
  }

  async refreshApplications() {
    try {
      await this.appService.loadApplications();
    } catch (error) {
      console.error('Failed to refresh applications:', error);
    }
  }

  updateFilter(field: keyof FilterState, value: string) {
    this.filtersState.update((current) => ({ ...current, [field]: value }));
  }

  clearFilters() {
    this.filtersState.set({ search: '', category: '', status: '', cluster: '' });
  }

  viewApplication(appId: string) {
    this.router.navigate(['/apps/applications', appId]);
  }

  openBundleDetail(installId: string) {
    this.router.navigate(['/apps/catalog/installs', installId], {
      queryParams: { from: 'applications' },
    });
  }

  confirmDelete(app: Application) {
    if (app.systemProtected) return;
    this.appToDelete.set(app);
    this.showDeleteModal.set(true);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.appToDelete.set(null);
  }

  executeDelete() {
    const app = this.appToDelete();
    if (!app?.id) return;

    // Close modal immediately — don't wait for API response
    this.showDeleteModal.set(false);
    this.appToDelete.set(null);

    // Fire-and-forget: service handles status update, WS, polling, and removal
    this.appService.deleteApplication(app.id).catch(err => {
      console.error('Failed to initiate deletion:', err);
    });
  }

  deployNewApp() {
    this.router.navigate(['/apps/deploy/new'], { queryParams: { appKind: this.kind() } });
  }
}
