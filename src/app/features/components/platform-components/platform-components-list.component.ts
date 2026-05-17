import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCw,
  lucideLoader,
  lucideAlertCircle,
  lucideChevronDown,
  lucideChevronRight,
  lucidePackage,
  lucideSearch,
} from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { PlatformComponentsService } from '../../service/platform-components.service';
import { PlatformComponentResponseDto } from '../../../core/api/model/platformComponentResponseDto';
import { PlatformComponentStatusBadgeComponent } from './platform-component-status-badge.component';
import { PlatformComponentDetailPanelComponent } from './platform-component-detail-panel.component';

@Component({
  selector: 'app-platform-components-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIconComponent,
    PlatformComponentStatusBadgeComponent,
    PlatformComponentDetailPanelComponent,
  ],
  providers: [
    provideIcons({
      lucideRefreshCw,
      lucideLoader,
      lucideAlertCircle,
      lucideChevronDown,
      lucideChevronRight,
      lucidePackage,
      lucideSearch,
    }),
  ],
  template: `
    <div class="space-y-4 p-4 sm:p-6">

      <!-- Header -->
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Platform Components</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Live status of core system components across all clusters</p>
        </div>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          [disabled]="service.globalLoading()"
          (click)="reload()"
        >
          <ng-icon name="lucideRefreshCw" class="h-4 w-4" [class.animate-spin]="service.globalLoading()" />
          Refresh
        </button>
      </div>

      <!-- Stats strip -->
      @if (!service.globalLoading() && service.allComponents().length > 0) {
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Healthy</p>
            <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ service.healthyCount() }}</p>
          </div>
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Degraded</p>
            <p class="text-2xl font-bold" [class]="service.degradedCount() > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'">{{ service.degradedCount() }}</p>
          </div>
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Missing</p>
            <p class="text-2xl font-bold" [class]="service.missingCount() > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'">{{ service.missingCount() }}</p>
          </div>
        </div>
      }

      <!-- Filters -->
      <div class="bg-gray-50/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <div class="flex flex-wrap items-center gap-3">
          <!-- Search -->
          <div class="relative flex-1 min-w-40">
            <ng-icon name="lucideSearch" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search components..."
              [(ngModel)]="searchQuery"
              class="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <!-- Status filter -->
          <select
            [(ngModel)]="statusFilter"
            class="px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="missing">Missing</option>
          </select>
          <!-- Cluster filter -->
          @if (availableClusters().length > 1) {
            <select
              [(ngModel)]="clusterFilter"
              class="px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All clusters</option>
              @for (c of availableClusters(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          }
          @if (searchQuery || statusFilter || clusterFilter) {
            <button class="text-xs text-blue-600 dark:text-blue-400 hover:underline" (click)="clearFilters()">Clear</button>
          }
        </div>
      </div>

      <!-- Skeleton -->
      @if (service.globalLoading() && service.allComponents().length === 0) {

        <!-- Stats skeleton -->
        <div class="grid grid-cols-3 gap-3">
          @for (i of [0,1,2]; track i) {
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-center space-y-2">
              <div class="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto"></div>
              <div class="h-7 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto"></div>
            </div>
          }
        </div>

        <!-- Cluster group skeleton -->
        @for (g of [5,4,6]; track g) {
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">

            <!-- Cluster header skeleton -->
            <div class="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>

            <!-- Row skeletons -->
            @for (r of skeletonRows(g); track r) {
              <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <div class="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex-shrink-0"></div>
                <div class="flex-1 grid grid-cols-4 gap-3 items-center">
                  <div class="space-y-1.5">
                    <div class="h-3.5 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div class="h-3 w-20 bg-gray-100 dark:bg-gray-700/60 rounded animate-pulse"></div>
                  </div>
                  <div class="col-span-2 flex items-center gap-2">
                    <div class="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div class="h-5 w-12 bg-gray-100 dark:bg-gray-700/60 rounded animate-pulse"></div>
                  </div>
                  <div class="flex justify-end">
                    <div class="h-3 w-16 bg-gray-100 dark:bg-gray-700/60 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            }

          </div>
        }
      }

      <!-- No results -->
      @if (!service.globalLoading() && filteredComponents().length === 0 && service.allComponents().length > 0) {
        <div class="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          No components match the current filters.
        </div>
      }

      <!-- No clusters -->
      @if (!service.globalLoading() && service.allComponents().length === 0 && service.entries().length === 0) {
        <div class="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <ng-icon name="lucidePackage" class="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          No clusters available.
        </div>
      }

      <!-- Cluster groups -->
      @for (entry of visibleEntries(); track entry.clusterId) {

        @if (clusterFilter === '' || clusterFilter === entry.clusterId) {
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">

            <!-- Cluster header -->
            <div class="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ entry.clusterName }}</span>
                @if (entry.loading) {
                  <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin text-blue-500" />
                }
              </div>
              @if (entry.error) {
                <span class="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <ng-icon name="lucideAlertCircle" class="h-3.5 w-3.5" />
                  {{ entry.error }}
                </span>
              }
            </div>

            <!-- Component rows -->
            @for (comp of entryFilteredComponents(entry.clusterId); track comp.key) {
              <div>
                <!-- Row -->
                <button
                  class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors border-b border-gray-100 dark:border-gray-700/50"
                  (click)="toggleExpand(entry.clusterId, comp.key)"
                >
                  <ng-icon
                    [name]="isExpanded(entry.clusterId, comp.key) ? 'lucideChevronDown' : 'lucideChevronRight'"
                    class="h-4 w-4 text-gray-400 flex-shrink-0"
                  />
                  <div class="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-3 items-center">
                    <div class="sm:col-span-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ comp.name }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ comp.category }}</p>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap sm:col-span-2">
                      <app-platform-component-status-badge [status]="comp.status" />
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {{ comp.managedBy }}
                      </span>
                      @if (comp.errorCount > 0) {
                        <span class="text-xs text-red-600 dark:text-red-400">{{ comp.errorCount }} error{{ comp.errorCount > 1 ? 's' : '' }}</span>
                      }
                    </div>
                    <div class="text-xs text-gray-400 dark:text-gray-500 text-right hidden sm:block">
                      {{ formatDate(getCreatedAt(comp)) }}
                    </div>
                  </div>
                </button>

                <!-- Detail panel -->
                @if (isExpanded(entry.clusterId, comp.key)) {
                  <app-platform-component-detail-panel
                    #detailPanel
                    [component]="comp"
                    [clusterId]="entry.clusterId"
                    [isRedeploying]="service.isRedeploying(entry.clusterId, comp.key)"
                    (redeployRequested)="onRedeployRequested(entry.clusterId, comp.key, detailPanel)"
                  />
                }
              </div>
            }

            @if (entryFilteredComponents(entry.clusterId).length === 0 && !entry.loading) {
              <p class="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">No components match filters.</p>
            }

          </div>
        }
      }

      <!-- Confirmation modal -->
      @if (confirmModal()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white dark:bg-gray-800 rounded-lg max-w-sm w-full p-5 shadow-xl">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-2">Confirm Redeploy</h3>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
              This will trigger a rolling restart for all workload resources of
              <span class="font-medium">{{ confirmModal()!.componentKey }}</span>.
              The process is non-destructive and does not change config or images.
            </p>
            <div class="flex gap-3 justify-end">
              <button
                class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                (click)="cancelRedeploy()"
              >Cancel</button>
              <button
                class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                (click)="confirmRedeploy()"
              >Redeploy</button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
})
export class PlatformComponentsListComponent implements OnInit {
  readonly service = inject(PlatformComponentsService);
  private readonly clusterService = inject(ClusterService);

  searchQuery = '';
  statusFilter = '';
  clusterFilter = '';

  private readonly expandedKeys = signal<Set<string>>(new Set());
  confirmModal = signal<{ clusterId: string; componentKey: string; panel: PlatformComponentDetailPanelComponent } | null>(null);

  readonly availableClusters = computed(() =>
    this.service.entries().map(e => ({ id: e.clusterId, name: e.clusterName }))
  );

  readonly filteredComponents = computed(() => {
    const q = this.searchQuery.toLowerCase();
    const sf = this.statusFilter;
    const cf = this.clusterFilter;
    return this.service.allComponents().filter(c => {
      if (sf && c.status !== sf) return false;
      if (cf && c.clusterId !== cf) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  readonly visibleEntries = computed(() => {
    const q = this.searchQuery.toLowerCase();
    const sf = this.statusFilter;
    const cf = this.clusterFilter;
    if (!q && !sf && !cf) return this.service.entries();
    return this.service.entries().filter(e => {
      if (cf && e.clusterId !== cf) return false;
      if (!q && !sf) return true;
      return e.components.some(c => {
        if (sf && c.status !== sf) return false;
        if (q && !c.name.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false;
        return true;
      });
    });
  });

  entryFilteredComponents(clusterId: string): (PlatformComponentResponseDto & { clusterId: string; clusterName: string })[] {
    const q = this.searchQuery.toLowerCase();
    const sf = this.statusFilter;
    const entry = this.service.entries().find(e => e.clusterId === clusterId);
    if (!entry) return [];
    const clusterName = entry.clusterName;
    return entry.components
      .filter(c => {
        if (sf && c.status !== sf) return false;
        if (q && !c.name.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false;
        return true;
      })
      .map(c => ({ ...c, clusterId, clusterName }));
  }

  ngOnInit(): void {
    void (async () => {
      if (this.clusterService.clusters().length === 0) {
        await this.clusterService.loadClusters();
      }
      const clusters = this.clusterService.clusters()
        .filter(c => !!c.id)
        .map(c => ({ id: c.id!, name: c.name ?? c.id! }));
      if (clusters.length > 0) {
        await this.service.loadForClusters(clusters);
      }
    })();
  }

  async reload(): Promise<void> {
    const clusters = this.clusterService.clusters()
      .filter(c => !!c.id)
      .map(c => ({ id: c.id!, name: c.name ?? c.id! }));
    if (clusters.length > 0) {
      await this.service.loadForClusters(clusters);
    }
  }

  isExpanded(clusterId: string, key: string): boolean {
    return this.expandedKeys().has(`${clusterId}:${key}`);
  }

  toggleExpand(clusterId: string, key: string): void {
    const k = `${clusterId}:${key}`;
    this.expandedKeys.update(s => {
      const next = new Set(s);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.statusFilter = '';
    this.clusterFilter = '';
  }

  onRedeployRequested(clusterId: string, componentKey: string, panel: PlatformComponentDetailPanelComponent): void {
    this.confirmModal.set({ clusterId, componentKey, panel });
  }

  cancelRedeploy(): void {
    this.confirmModal.set(null);
  }

  async confirmRedeploy(): Promise<void> {
    const modal = this.confirmModal();
    if (!modal) return;
    this.confirmModal.set(null);
    const result = await this.service.redeployComponent(modal.clusterId, modal.componentKey);
    if (result) {
      modal.panel.setRedeployResult(result);
    }
  }

  skeletonRows(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i);
  }

  getCreatedAt(comp: PlatformComponentResponseDto): string | undefined {
    const dates = comp.resources
      .map(r => r.createdAt)
      .filter((d): d is string => !!d)
      .map(d => new Date(d).getTime());
    if (dates.length === 0) return undefined;
    return new Date(Math.min(...dates)).toISOString();
  }

  formatDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
}
