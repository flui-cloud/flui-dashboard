/**
 * VNet List Component
 *
 * Displays a list of Virtual Networks with filtering and search capabilities.
 * Follows the pattern established in ClusterListComponent.
 */

import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCw,
  lucidePlus,
  lucideNetwork,
  lucideServer,
  lucideSearch,
  lucideFilter
} from '@ng-icons/lucide';

import { VNetService } from '../../service/vnet.service';
import { ProvidersService } from '../../service/providers.service';
import {
  VNetInfo,
  VNetFilterState,
  VNetStatus,
  getAllAttachedServerIds
} from '../../model/vnet.models';

@Component({
  selector: 'vnet-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  providers: [
    provideIcons({
      lucideRefreshCw,
      lucidePlus,
      lucideNetwork,
      lucideServer,
      lucideSearch,
      lucideFilter
    })
  ],
  template: `
    <div class="space-y-6 p-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            Virtual Networks
          </h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage isolated private networks across cloud providers
          </p>
        </div>
        <div class="flex gap-3">
          <button
            (click)="refreshVNets()"
            [disabled]="isLoading()"
            class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-4 w-4"
              [class.animate-spin]="isLoading()"
            />
            Refresh
          </button>
          <button
            (click)="createNewVNet()"
            class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ng-icon name="lucidePlus" class="h-4 w-4" />
            Create VNet
          </button>
        </div>
      </div>

      <!-- Statistics Cards -->
      @if (statistics()) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">Total VNets</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {{ statistics().total }}
            </div>
          </div>
          <div
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">Active</div>
            <div class="text-2xl font-bold text-green-600 mt-1">
              {{ statistics().active }}
            </div>
          </div>
          <div
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">Pending</div>
            <div class="text-2xl font-bold text-yellow-600 mt-1">
              {{ statistics().pending }}
            </div>
          </div>
          <div
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">Total Subnets</div>
            <div class="text-2xl font-bold text-blue-600 mt-1">
              {{ statistics().totalSubnets }}
            </div>
          </div>
          <div
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">Attached Servers</div>
            <div class="text-2xl font-bold text-purple-600 mt-1">
              {{ statistics().totalAttachedServers }}
            </div>
          </div>
        </div>
      }

      <!-- Filters -->
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
      >
        <div class="flex items-center gap-2 mb-4">
          <ng-icon name="lucideFilter" class="h-4 w-4 text-gray-500" />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >Filters</span
          >
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- Search -->
          <div class="relative">
            <ng-icon
              name="lucideSearch"
              class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
            />
            <input
              type="text"
              [ngModel]="filtersState().search"
              (ngModelChange)="updateFilter('search', $event)"
              placeholder="Search VNets..."
              class="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- Provider Filter -->
          <select
            [ngModel]="filtersState().provider"
            (ngModelChange)="updateFilter('provider', $event)"
            class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="DELETING">Deleting</option>
          </select>

          <!-- Clear Filters -->
          <button
            (click)="clearAllFilters()"
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <!-- Error Message -->
      @if (errorMessage()) {
        <div
          class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
        >
          <div class="flex items-start">
            <div class="text-sm text-red-800 dark:text-red-200">
              {{ errorMessage() }}
            </div>
          </div>
        </div>
      }

      <!-- Loading State -->
      @if (isLoading() && !filteredVNets().length) {
        <div
          class="flex items-center justify-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <div class="text-center">
            <ng-icon name="lucideRefreshCw" class="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading VNets...</p>
          </div>
        </div>
      }

      <!-- Empty State -->
      @else if (!filteredVNets().length && !isLoading()) {
        <div
          class="flex flex-col items-center justify-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <ng-icon name="lucideNetwork" class="h-16 w-16 text-gray-400 mb-4" />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No VNets found
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center max-w-md">
            @if (hasActiveFilters()) {
              No VNets match your current filters. Try adjusting your search criteria.
            } @else {
              Get started by creating your first Virtual Network to securely connect your
              cloud resources.
            }
          </p>
          @if (!hasActiveFilters()) {
            <button
              (click)="createNewVNet()"
              class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ng-icon name="lucidePlus" class="h-4 w-4" />
              Create Your First VNet
            </button>
          } @else {
            <button
              (click)="clearAllFilters()"
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Clear Filters
            </button>
          }
        </div>
      }

      <!-- VNet List -->
      @else {
        <div class="space-y-4">
          @for (vnet of filteredVNets(); track vnet.id) {
            <div
              (click)="selectVNet(vnet.id)"
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <ng-icon name="lucideNetwork" class="h-5 w-5 text-blue-600" />
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                      {{ vnet.name }}
                    </h3>
                    <span
                      class="px-2.5 py-0.5 rounded-full text-xs font-medium"
                      [ngClass]="getStatusBadgeClass(vnet.status)"
                    >
                      {{ vnet.status }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Provider</div>
                      <div class="text-sm font-medium text-gray-900 dark:text-white mt-1 capitalize">
                        {{ vnet.provider }}
                      </div>
                    </div>
                    <div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">IP Range</div>
                      <div class="text-sm font-mono text-gray-900 dark:text-white mt-1">
                        {{ vnet.ipRange }}
                      </div>
                    </div>
                    <div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Subnets</div>
                      <div class="text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {{ vnet.subnets.length }}
                      </div>
                    </div>
                  </div>

                  @if (getTotalAttachedServers(vnet) > 0) {
                    <div class="mt-4 flex items-center gap-2">
                      <ng-icon name="lucideServer" class="h-4 w-4 text-gray-400" />
                      <span class="text-xs text-gray-600 dark:text-gray-400">
                        {{ getTotalAttachedServers(vnet) }} server(s) attached
                      </span>
                    </div>
                  }

                  @if (vnet.labels.length > 0) {
                    <div class="mt-3 flex flex-wrap gap-2">
                      @for (label of vnet.labels.slice(0, 3); track label.key) {
                        <span
                          class="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          {{ label.key }}: {{ label.value }}
                        </span>
                      }
                      @if (vnet.labels.length > 3) {
                        <span
                          class="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                        >
                          +{{ vnet.labels.length - 3 }} more
                        </span>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Results Count -->
      @if (filteredVNets().length > 0) {
        <div class="text-sm text-gray-600 dark:text-gray-400 text-center">
          Showing {{ filteredVNets().length }} of {{ vnets().length }} VNet(s)
        </div>
      }
    </div>
  `,
  styles: []
})
export class VNetListComponent implements OnInit {
  private readonly vnetService = inject(VNetService);
  private readonly providersService = inject(ProvidersService);
  private readonly router = inject(Router);

  // Local filter state
  private readonly filtersSignal = signal<VNetFilterState>({
    search: '',
    provider: '',
    status: '',
    clusterId: ''
  });

  readonly filtersState = this.filtersSignal.asReadonly();

  readonly availableProviders = computed(() => this.providersService.availableProviders());

  // Connect to service signals
  readonly vnets = this.vnetService.vnets;
  readonly isLoading = this.vnetService.loading;
  readonly errorMessage = this.vnetService.errorMessage;
  readonly statistics = this.vnetService.statistics;

  // Computed: filtered VNets based on local filters
  readonly filteredVNets = computed(() => {
    const filters = this.filtersState();
    const vnets = this.vnets();

    return vnets.filter((vnet) => {
      const matchSearch =
        !filters.search ||
        vnet.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        vnet.ipRange.toLowerCase().includes(filters.search.toLowerCase()) ||
        vnet.providerResourceId.toLowerCase().includes(filters.search.toLowerCase());

      const matchProvider =
        !filters.provider || vnet.provider === filters.provider;

      const matchStatus = !filters.status || vnet.status === filters.status;

      return matchSearch && matchProvider && matchStatus;
    });
  });

  // Check if any filters are active
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
      // Error is handled by service
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
      [key]: value
    }));
  }

  clearAllFilters() {
    this.filtersSignal.set({
      search: '',
      provider: '',
      status: '',
      clusterId: ''
    });
  }

  getTotalAttachedServers(vnet: VNetInfo): number {
    return getAllAttachedServerIds(vnet).length;
  }

  getStatusBadgeClass(status: VNetStatus): string {
    switch (status) {
      case VNetStatus.ACTIVE:
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case VNetStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case VNetStatus.FAILED:
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case VNetStatus.DELETING:
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case VNetStatus.DELETED:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  }
}
