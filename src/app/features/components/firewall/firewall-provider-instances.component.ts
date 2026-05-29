import { Component, computed, effect, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideFilter,
  lucideTrash2,
  lucideExternalLink,
  lucideRefreshCw,
  lucideTriangleAlert,
  lucideArrowLeft,
} from '@ng-icons/lucide';

import { FirewallService } from '../../service/firewall.service';
import { ProvidersService } from '../../service/providers.service';
import { ProviderFirewallExtended, ProviderFirewallFilterState } from '../../model/firewall.models';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { HlmCardDirective, HlmCardHeaderDirective, HlmCardTitleDirective, HlmCardContentDirective } from '@spartan-ng/ui-card-helm';
import { ProviderBadgeComponent } from './provider-badge.component';
import { UsageStatusBadgeComponent } from './usage-status-badge.component';
import { BrnSelectModule } from '@spartan-ng/brain/select';
import { HlmSelectModule } from '@spartan-ng/ui-select-helm';
import { DeleteConfirmationDialogComponent, DeleteConfirmationData } from '../../../shared/components/delete-confirmation-dialog.component';

@Component({
  selector: 'app-firewall-provider-instances',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    NgIcon,
    HlmButtonDirective,
    HlmInputDirective,
    HlmBadgeDirective,
    HlmCardDirective,
    HlmCardHeaderDirective,
    HlmCardTitleDirective,
    HlmCardContentDirective,
    ProviderBadgeComponent,
    UsageStatusBadgeComponent,
    BrnSelectModule,
    HlmSelectModule,
    DeleteConfirmationDialogComponent,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideFilter,
      lucideTrash2,
      lucideExternalLink,
      lucideRefreshCw,
      lucideTriangleAlert,
      lucideArrowLeft,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 space-y-6">
      <!-- Back link -->
      <a
        routerLink="/infrastructure/firewall/clusters"
        class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        Back to Cluster Firewalls
      </a>

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">Provider Firewalls</h1>
          <p class="text-muted-foreground mt-1">
            Manage firewalls created on cloud providers
          </p>
        </div>
        <button hlmBtn (click)="refresh()" [disabled]="firewallService.loadingProviderFirewalls()">
          <ng-icon name="lucideRefreshCw" class="mr-2 h-4 w-4" [class.animate-spin]="firewallService.loadingProviderFirewalls()" />
          Refresh
        </button>
      </div>

      <!-- Warning Message -->
      <div class="rounded-lg bg-yellow-50 dark:bg-gray-800/60 border-2 border-yellow-300 dark:border-gray-700/50 p-4 flex items-start gap-3">
        <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-yellow-700 dark:text-yellow-400 mt-0.5" />
        <div class="flex-1">
          <h3 class="font-semibold text-yellow-800 dark:text-yellow-300">⚠️ Emergency Use Only</h3>
          <p class="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
            Direct provider firewall management should only be used for emergency situations.
            For normal firewall operations, please use the <strong>Cluster Firewalls</strong> section
            which provides desired-state management with drift detection and reconciliation.
          </p>
        </div>
      </div>

      <!-- Error Message -->
      @if (firewallService.providerFirewallsErrorMessage()) {
        <div class="rounded-lg bg-destructive/15 p-4 flex items-start gap-3">
          <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-destructive mt-0.5" />
          <div class="flex-1">
            <h3 class="font-semibold text-destructive">Error loading firewalls</h3>
            <p class="text-sm text-destructive/90 mt-1">{{ firewallService.providerFirewallsErrorMessage() }}</p>
          </div>
        </div>
      }

      <!-- Stats Cards -->
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div hlmCard>
          <div hlmCardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 hlmCardTitle class="text-sm font-medium">Total Firewalls</h3>
          </div>
          <div hlmCardContent>
            <div class="text-2xl font-bold">{{ stats().total }}</div>
            <p class="text-xs text-muted-foreground">Across all providers</p>
          </div>
        </div>

        <div hlmCard>
          <div hlmCardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 hlmCardTitle class="text-sm font-medium">In Use</h3>
          </div>
          <div hlmCardContent>
            <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ stats().inUse }}</div>
            <p class="text-xs text-muted-foreground">Attached to clusters</p>
          </div>
        </div>

        <div hlmCard>
          <div hlmCardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 hlmCardTitle class="text-sm font-medium">Unused</h3>
          </div>
          <div hlmCardContent>
            <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">{{ stats().unused }}</div>
            <p class="text-xs text-muted-foreground">Available for deletion</p>
          </div>
        </div>

        <div hlmCard>
          <div hlmCardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 hlmCardTitle class="text-sm font-medium">Providers</h3>
          </div>
          <div hlmCardContent>
            <div class="space-y-1">
              @for (provider of providersWithCount(); track provider.name) {
                <div class="flex items-center justify-between text-sm">
                  <span class="capitalize">{{ provider.name }}</span>
                  <span class="font-semibold">{{ provider.count }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div hlmCard>
        <div hlmCardContent class="pt-6">
          <div class="grid gap-4 md:grid-cols-3">
            <!-- Search -->
            <div class="relative">
              <ng-icon name="lucideSearch" class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                hlmInput
                type="text"
                placeholder="Search firewalls..."
                [(ngModel)]="filters.search"
                class="pl-8"
              />
            </div>

            <!-- Provider Filter -->
            <div class="relative">
              <select
                [(ngModel)]="filters.provider"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none"
              >
                <option value="ALL">All Providers</option>
                @for (p of availableProviders(); track p.id) {
                  <option [value]="p.id">{{ p.displayName }}</option>
                }
              </select>
              <ng-icon name="lucideFilter" class="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            <!-- Usage Filter -->
            <div class="relative">
              <select
                [(ngModel)]="filters.inUse"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none"
              >
                <option [ngValue]="'ALL'">All Status</option>
                <option [ngValue]="true">In Use</option>
                <option [ngValue]="false">Unused</option>
              </select>
              <ng-icon name="lucideFilter" class="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <!-- Firewalls Table -->
      <div hlmCard>
        <div hlmCardContent class="p-0">
          @if (firewallService.loadingProviderFirewalls()) {
            <div class="p-12 text-center">
              <ng-icon name="lucideRefreshCw" class="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p class="mt-4 text-sm text-muted-foreground">Loading provider firewalls...</p>
            </div>
          } @else if (filteredFirewalls().length === 0) {
            <div class="p-12 text-center">
              <ng-icon name="lucideTriangleAlert" class="h-12 w-12 mx-auto text-muted-foreground" />
              <p class="mt-4 text-lg font-semibold">No firewalls found</p>
              <p class="text-sm text-muted-foreground">
                @if (hasActiveFilters()) {
                  Try adjusting your filters
                } @else {
                  No firewalls have been created on any provider
                }
              </p>
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="border-b bg-muted/50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Name</th>
                    <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Provider</th>
                    <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                    <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Cluster</th>
                    <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Servers</th>
                    <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Rules</th>
                    <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  @for (firewall of filteredFirewalls(); track firewall.id) {
                    <tr class="hover:bg-muted/50 transition-colors">
                      <!-- Name -->
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                          <div>
                            <div class="font-medium">{{ firewall.name }}</div>
                            <div class="text-xs text-muted-foreground">{{ firewall.id }}</div>
                          </div>
                          @if (isObservabilityFirewall(firewall)) {
                            <span hlmBadge variant="outline" class="text-xs bg-purple-50 dark:bg-gray-700/50 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-gray-600/50">
                              Control
                            </span>
                          }
                        </div>
                      </td>

                      <!-- Provider -->
                      <td class="px-4 py-3">
                        <app-provider-badge [provider]="firewall.provider" />
                      </td>

                      <!-- Status -->
                      <td class="px-4 py-3">
                        <app-usage-status-badge [inUse]="isObservabilityFirewall(firewall) ? true : firewall.inUse" />
                      </td>

                      <!-- Cluster -->
                      <td class="px-4 py-3">
                        @if (firewall.clusterId) {
                          <a
                            [routerLink]="['/cluster', firewall.clusterId]"
                            class="text-primary hover:underline flex items-center gap-1"
                          >
                            {{ firewall.clusterName || firewall.clusterId }}
                            <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                          </a>
                        } @else {
                          <span class="text-muted-foreground text-sm">—</span>
                        }
                      </td>

                      <!-- Servers -->
                      <td class="px-4 py-3">
                        <span hlmBadge variant="secondary">
                          {{ firewall.appliedServers.length }} servers
                        </span>
                      </td>

                      <!-- Rules -->
                      <td class="px-4 py-3">
                        <span class="text-sm text-muted-foreground">
                          {{ firewall.rules.length }} rules
                        </span>
                      </td>

                      <!-- Actions -->
                      <td class="px-4 py-3 text-right">
                        @if (isObservabilityFirewall(firewall)) {
                          <button
                            hlmBtn
                            variant="ghost"
                            size="sm"
                            disabled
                            class="text-muted-foreground cursor-not-allowed"
                            title="Control-cluster firewalls are managed automatically and cannot be deleted"
                          >
                            <ng-icon name="lucideTrash2" class="h-4 w-4" />
                          </button>
                        } @else {
                          <button
                            hlmBtn
                            variant="ghost"
                            size="sm"
                            (click)="deleteFirewall(firewall)"
                            [disabled]="firewall.inUse || deleting() === firewall.id"
                            class="text-destructive hover:text-destructive hover:bg-destructive/10"
                            [title]="firewall.inUse ? 'Cannot delete a firewall that is currently in use' : 'Delete firewall'"
                          >
                            <ng-icon name="lucideTrash2" class="h-4 w-4" />
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <app-delete-confirmation-dialog
      (confirmed)="confirmDelete()"
      (cancelled)="cancelDelete()"
      [deleting]="deleting() !== null"
    />
  `,
})
export class FirewallProviderInstancesComponent {
  @ViewChild(DeleteConfirmationDialogComponent) deleteDialog!: DeleteConfirmationDialogComponent;

  firewallService = inject(FirewallService);
  private readonly providersService = inject(ProvidersService);

  readonly availableProviders = computed(() => this.providersService.availableProviders());

  filters: ProviderFirewallFilterState = {
    search: '',
    provider: 'ALL',
    inUse: 'ALL',
  };

  deleting = signal<string | null>(null);
  private firewallToDelete: ProviderFirewallExtended | null = null;

  constructor() {
    this.providersService.loadProviders();
    // Load provider firewalls on init
    effect(() => {
      this.firewallService.loadProviderFirewalls();
    }, { allowSignalWrites: true });
  }

  stats = computed(() => this.firewallService.providerFirewallStats());

  providersWithCount = computed(() => {
    const byProvider = this.stats().byProvider;
    return Object.entries(byProvider).map(([name, count]) => ({ name, count }));
  });

  filteredFirewalls = computed(() => {
    const currentFilters = this.filters;
    const all = this.firewallService.allProviderFirewalls();

    return all.filter((fw) => {
      // Search filter
      if (currentFilters.search) {
        const searchLower = currentFilters.search.toLowerCase();
        const matchesName = fw.name.toLowerCase().includes(searchLower);
        const matchesId = fw.id.toLowerCase().includes(searchLower);
        const matchesCluster = fw.clusterName?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesId && !matchesCluster) {
          return false;
        }
      }

      // Provider filter
      if (currentFilters.provider !== 'ALL' && fw.provider !== currentFilters.provider) {
        return false;
      }

      // Usage filter
      if (currentFilters.inUse !== 'ALL' && fw.inUse !== currentFilters.inUse) {
        return false;
      }

      return true;
    });
  });

  hasActiveFilters = computed(() => {
    const currentFilters = this.filters;
    return (
      currentFilters.search !== '' ||
      currentFilters.provider !== 'ALL' ||
      currentFilters.inUse !== 'ALL'
    );
  });

  async refresh(): Promise<void> {
    await this.firewallService.loadProviderFirewalls();
  }

  isObservabilityFirewall(firewall: ProviderFirewallExtended): boolean {
    return firewall.labels?.['flui-cluster-type'] === 'control' || firewall.labels?.['flui-cluster-type'] === 'observability';
  }

  deleteFirewall(firewall: ProviderFirewallExtended): void {
    if (this.isObservabilityFirewall(firewall)) {
      alert('Control-cluster firewalls are managed automatically and cannot be deleted manually.');
      return;
    }

    if (firewall.inUse) {
      alert('Cannot delete a firewall that is currently in use. Detach it from the cluster first.');
      return;
    }

    this.firewallToDelete = firewall;

    const deleteData: DeleteConfirmationData = {
      title: 'Delete Provider Firewall',
      description: 'You are about to delete this firewall from the cloud provider.',
      itemName: firewall.name,
      itemDescription: `Provider: ${firewall.provider.charAt(0).toUpperCase() + firewall.provider.slice(1)} | Rules: ${firewall.rules.length} | Servers: ${firewall.appliedServers.length}`,
      warningMessage: 'This action cannot be undone. The firewall will be permanently deleted from the provider.',
      confirmButtonText: 'Delete Firewall',
    };

    this.deleteDialog.open(deleteData);
  }

  async confirmDelete(): Promise<void> {
    if (!this.firewallToDelete) {
      return;
    }

    const firewall = this.firewallToDelete;
    this.deleting.set(firewall.id);

    try {
      await this.firewallService.deleteProviderFirewall(firewall.provider, firewall.id);
      // Success - close dialog and reset state
      this.deleteDialog.close();
      this.firewallToDelete = null;
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'An unexpected error occurred';
      alert(`Failed to delete firewall: ${errorMessage}`);
      this.deleteDialog.close();
    } finally {
      this.deleting.set(null);
    }
  }

  cancelDelete(): void {
    this.firewallToDelete = null;
    this.deleting.set(null);
  }
}
