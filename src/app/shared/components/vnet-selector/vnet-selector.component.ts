import { Component, OnInit, input, output, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideNetwork,
  lucideSearch,
  lucideLoader,
  lucideCircleAlert,
  lucideCheck,
  lucideX,
  lucideInfo,
} from '@ng-icons/lucide';
import { VNetService } from '../../../features/service/vnet.service';
import { VNetInfo, VNetStatus } from '../../../features/model/vnet.models';

/**
 * VNet Selector Component
 *
 * Reusable component for selecting a VNet from available VNets.
 *
 * Features:
 * - List available VNets filtered by provider
 * - Search/filter VNets by name
 * - Show VNet details (IP range, subnets, attached servers)
 * - Optional "No VNet" selection
 * - Loading states and error handling
 */
@Component({
  selector: 'app-vnet-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideNetwork,
      lucideSearch,
      lucideLoader,
      lucideCircleAlert,
      lucideCheck,
      lucideX,
      lucideInfo,
    }),
  ],
  template: `
    <div class="space-y-4">
      <!-- Description -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Virtual Network {{ required() ? '' : '(Optional)' }}
        </label>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ description() || 'Select a VNet to attach all cluster nodes to a private network.' }}
        </p>
      </div>

      <!-- Search Bar -->
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <ng-icon name="lucideSearch" size="18" class="text-slate-400"></ng-icon>
        </div>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearchChange()"
          placeholder="Search VNets by name..."
          class="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading()" class="flex items-center justify-center py-12">
        <ng-icon name="lucideLoader" size="32" class="animate-spin text-blue-500"></ng-icon>
      </div>

      <!-- Error State -->
      <div
        *ngIf="error() && !isLoading()"
        class="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg"
      >
        <ng-icon name="lucideCircleAlert" size="20"></ng-icon>
        <span>{{ error() }}</span>
      </div>

      <!-- VNets List -->
      <div *ngIf="!isLoading() && !error()" class="space-y-2 max-h-96 overflow-y-auto">
        <!-- No VNet Option (if not required) -->
        <div
          *ngIf="!required()"
          (click)="selectVNet(null)"
          [class]="getVNetCardClass(null)"
          class="p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <ng-icon name="lucideX" size="20" class="text-slate-500 dark:text-slate-400"></ng-icon>
              </div>
              <div>
                <h3 class="font-semibold text-slate-900 dark:text-white">No VNet</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  Skip VNet configuration
                </p>
              </div>
            </div>
            <ng-icon
              *ngIf="!selectedVNet()"
              name="lucideCheck"
              size="24"
              class="text-blue-600 dark:text-blue-400"
            ></ng-icon>
          </div>
        </div>

        <!-- VNet Cards -->
        <div
          *ngFor="let vnet of filteredVNets()"
          (click)="selectVNet(vnet)"
          [class]="getVNetCardClass(vnet)"
          class="p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <!-- VNet Icon -->
              <div class="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ng-icon name="lucideNetwork" size="24" class="text-blue-600 dark:text-blue-400"></ng-icon>
              </div>

              <!-- VNet Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-slate-900 dark:text-white truncate">
                    {{ vnet.name }}
                  </h3>
                  <span
                    [class]="getStatusBadgeClass(vnet.status)"
                    class="px-2 py-0.5 text-xs rounded-full font-medium"
                  >
                    {{ vnet.status }}
                  </span>
                </div>
                <div class="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                  <span class="font-mono">{{ vnet.ipRange }}</span>
                  <span>{{ vnet.subnets.length }} subnet(s)</span>
                  <span class="capitalize">{{ vnet.provider }}</span>
                </div>
              </div>
            </div>

            <!-- Selection Indicator -->
            <ng-icon
              *ngIf="isSelected(vnet)"
              name="lucideCheck"
              size="24"
              class="flex-shrink-0 text-blue-600 dark:text-blue-400 ml-2"
            ></ng-icon>
          </div>

          <!-- Subnet Info (expanded when selected) -->
          <div *ngIf="isSelected(vnet) && vnet.subnets.length > 0" class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
            <div class="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Available Subnets
            </div>
            <div class="grid grid-cols-1 gap-2">
              <div
                *ngFor="let subnet of vnet.subnets"
                class="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs"
              >
                <span class="font-mono text-slate-900 dark:text-white">{{ subnet.ipRange }}</span>
                <span class="text-slate-500 dark:text-slate-400">•</span>
                <span class="text-slate-600 dark:text-slate-400">{{ subnet.networkZone }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          *ngIf="filteredVNets().length === 0"
          class="text-center py-12 text-slate-500 dark:text-slate-400"
        >
          <ng-icon name="lucideNetwork" size="48" class="mx-auto mb-3 opacity-30"></ng-icon>
          <p *ngIf="searchQuery()">No VNets found matching "{{ searchQuery() }}"</p>
          <p *ngIf="!searchQuery() && provider()">No VNets available for {{ provider() }}</p>
          <p *ngIf="!searchQuery() && !provider()">No VNets available</p>
        </div>
      </div>

      <!-- Info Box (if VNet selected with no subnets) -->
      <div
        *ngIf="selectedVNet() && selectedVNet()!.subnets.length === 0"
        class="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
      >
        <ng-icon name="lucideInfo" size="18" class="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"></ng-icon>
        <div class="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Note:</strong> This VNet has no subnets. You'll need to add subnets before attaching servers.
        </div>
      </div>
    </div>
  `,
})
export class VNetSelectorComponent implements OnInit {
  private readonly vnetService = inject(VNetService);

  // ===== INPUTS =====

  /**
   * Filter VNets by provider (required)
   */
  provider = input<string | undefined>(undefined);

  /**
   * Whether VNet selection is required
   */
  required = input<boolean>(false);

  /**
   * Custom description text
   */
  description = input<string | undefined>(undefined);

  // ===== OUTPUTS =====

  /**
   * Emitted when a VNet is selected
   */
  vnetSelected = output<VNetInfo | null>();

  // ===== STATE SIGNALS =====

  selectedVNet = signal<VNetInfo | null>(null);
  searchQuery = signal<string>('');
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  // ===== COMPUTED SIGNALS =====

  filteredVNets = computed(() => {
    const vnets = this.vnetService.vnets();
    const query = this.searchQuery().toLowerCase();

    return vnets.filter(vnet => {
      // Filter by search query
      if (query) {
        const name = vnet.name.toLowerCase();
        const ipRange = vnet.ipRange.toLowerCase();
        return name.includes(query) || ipRange.includes(query);
      }
      return true;
    });
  });

  // ===== LIFECYCLE =====

  constructor() {
    // Reload VNets when provider changes
    effect(() => {
      const currentProvider = this.provider();
      this.loadVNets();
    });
  }

  ngOnInit(): void {
    this.loadVNets();
  }

  // ===== METHODS =====

  async loadVNets(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const provider = this.provider();
      await this.vnetService.loadVNets(provider);
    } catch (error: any) {
      const errorMsg = error?.error?.message || 'Failed to load VNets';
      this.error.set(errorMsg);
      console.error('Failed to load VNets:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectVNet(vnet: VNetInfo | null): void {
    this.selectedVNet.set(vnet);
    this.vnetSelected.emit(vnet);
  }

  isSelected(vnet: VNetInfo): boolean {
    const selected = this.selectedVNet();
    return selected ? selected.id === vnet.id : false;
  }

  onSearchChange(): void {
    // Search is reactive via signal, no action needed
  }

  getVNetCardClass(vnet: VNetInfo | null): string {
    const isSelected = vnet ? this.isSelected(vnet) : !this.selectedVNet();
    return isSelected
      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
      : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600';
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
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  }
}
