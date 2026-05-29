import { Component, OnInit, input, output, signal, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCloud,
  lucideMapPin,
  lucideServer,
  lucideLoader,
  lucideCircleAlert,
  lucideShield,
  lucideShieldOff,
} from '@ng-icons/lucide';
import {
  ProviderWizardService,
  ProviderOption,
  ProviderRegion,
  ServerTypeOption,
} from '../../services/provider-wizard.service';
import { PricingService } from '../../services/pricing.service';

/**
 * Provider Region Selector Component
 *
 * Reusable component for selecting cloud provider, region, and server type.
 * Handles Steps 1-3 of provider-based wizards.
 *
 * Used by:
 * - Cluster Creation Wizard
 * - Build Agent Wizard
 * - Future wizards (Load Balancer, Database, etc.)
 *
 * Features:
 * - Provider selection with region count
 * - Region selection with country flags
 * - Server type selection with CPU type filtering (All | Shared | Dedicated)
 * - Loading states and error handling
 * - Auto-loading of dependent data
 */
@Component({
  selector: 'app-provider-region-selector',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideCloud,
      lucideMapPin,
      lucideServer,
      lucideLoader,
      lucideCircleAlert,
      lucideShield,
      lucideShieldOff,
    }),
  ],
  template: `
    <div class="space-y-4">
      <!-- Step 1: Provider Selection -->
      <div *ngIf="currentStep() === 1">
        <!-- Loading State -->
        <div *ngIf="wizardService.isProviderLoading()" class="flex items-center justify-center py-8">
          <ng-icon name="lucideLoader" size="24" class="animate-spin text-blue-500"></ng-icon>
        </div>

        <!-- Error State -->
        <div
          *ngIf="wizardService.providerError() && !wizardService.isProviderLoading()"
          class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm"
        >
          <ng-icon name="lucideCircleAlert" size="16"></ng-icon>
          <span>{{ wizardService.providerError() }}</span>
        </div>

        <!-- Provider lock note -->
        <div
          *ngIf="lockedProvider()"
          class="flex items-center gap-2 mb-3 p-3 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-lg text-sm"
        >
          <ng-icon name="lucideShield" size="16"></ng-icon>
          <span>Workloads must run on the same provider as the control cluster.</span>
        </div>

        <!-- Provider Grid -->
        <div
          *ngIf="!wizardService.isProviderLoading() && !wizardService.providerError()"
          class="grid grid-cols-2 md:grid-cols-3 gap-3"
        >
          <div
            *ngFor="let provider of wizardService.providersData()"
            (click)="!isProviderDisabled(provider) && selectProvider(provider.id)"
            [class]="getProviderCardClass(provider)"
            class="relative p-3 border-2 rounded-lg transition-all"
            [class.cursor-pointer]="!isProviderDisabled(provider)"
            [class.cursor-not-allowed]="isProviderDisabled(provider)"
          >
            <div class="flex flex-col items-center gap-2 text-center">
              <!-- Provider Logo -->
              <div class="h-10 w-10 flex items-center justify-center">
                <img
                  *ngIf="provider.logoUrl"
                  [src]="provider.logoUrl"
                  [alt]="provider.name"
                  class="h-8 w-8 object-contain"
                  (error)="onLogoError($event)"
                />
                <ng-icon
                  *ngIf="!provider.logoUrl"
                  name="lucideCloud"
                  size="28"
                  class="text-blue-500 dark:text-blue-400"
                ></ng-icon>
              </div>
              <div>
                <p class="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{{ provider.name }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ provider.regions }} regions</p>
              </div>
              <span
                *ngIf="provider.comingSoon"
                class="px-1.5 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded"
              >
                Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Region Selection -->
      <div *ngIf="currentStep() === 2">
        <!-- Loading State -->
        <div *ngIf="wizardService.isRegionLoading()" class="flex items-center justify-center py-8">
          <ng-icon name="lucideLoader" size="24" class="animate-spin text-blue-500"></ng-icon>
        </div>

        <!-- Error State -->
        <div
          *ngIf="wizardService.regionError() && !wizardService.isRegionLoading()"
          class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm"
        >
          <ng-icon name="lucideCircleAlert" size="16"></ng-icon>
          <span>{{ wizardService.regionError() }}</span>
        </div>

        <!-- Region Grid -->
        <div
          *ngIf="!wizardService.isRegionLoading() && !wizardService.regionError()"
          class="grid grid-cols-2 md:grid-cols-3 gap-2"
        >
          <div
            *ngFor="let region of regions()"
            (click)="region.available && selectRegion(region.id)"
            [class]="getRegionCardClass(region)"
            class="p-3 border-2 rounded-lg transition-all"
            [class.cursor-pointer]="region.available"
            [class.cursor-not-allowed]="!region.available"
            [class.opacity-50]="!region.available"
          >
            <div class="flex items-center gap-2">
              <span class="text-xl leading-none">{{ region.flagEmoji }}</span>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ region.name }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 truncate">{{ region.country }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: Server Type Selection -->
      <div *ngIf="currentStep() === 3">
        <!-- CPU Type Filter -->
        <div class="mb-3 flex items-center gap-2">
          <label class="text-xs font-medium text-slate-700 dark:text-slate-300">CPU:</label>
          <select
            [value]="cpuTypeFilter()"
            (change)="setCpuTypeFilter($any($event.target).value)"
            class="h-7 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-900 dark:text-white"
          >
            <option value="all">All</option>
            <option value="shared">Shared (VPS)</option>
            <option value="dedicated">Dedicated</option>
          </select>
          <span class="text-xs text-slate-500 dark:text-slate-400">({{ filteredServerTypes().length }})</span>
        </div>

        <!-- Loading State -->
        <div *ngIf="wizardService.isServerTypeLoading()" class="flex items-center justify-center py-8">
          <ng-icon name="lucideLoader" size="24" class="animate-spin text-blue-500"></ng-icon>
        </div>

        <!-- Error State -->
        <div
          *ngIf="wizardService.serverTypeError() && !wizardService.isServerTypeLoading()"
          class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm"
        >
          <ng-icon name="lucideCircleAlert" size="16"></ng-icon>
          <span>{{ wizardService.serverTypeError() }}</span>
        </div>

        <!-- Server Type Grid -->
        <div
          *ngIf="!wizardService.isServerTypeLoading() && !wizardService.serverTypeError()"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1"
        >
          <div
            *ngFor="let serverType of filteredServerTypes()"
            (click)="serverType.managedFirewall && selectServerType(serverType.id)"
            [class]="getServerTypeCardClass(serverType)"
            [class.opacity-50]="!serverType.managedFirewall"
            [class.cursor-not-allowed]="!serverType.managedFirewall"
            [class.cursor-pointer]="serverType.managedFirewall"
            class="p-3 border-2 rounded-lg transition-all"
          >
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ serverType.name }}</p>
              <div class="flex items-center gap-1">
                <ng-icon
                  *ngIf="serverType.managedFirewall"
                  name="lucideShield"
                  size="12"
                  class="text-green-600 dark:text-green-400"
                  title="Managed firewall supported"
                ></ng-icon>
                <ng-icon
                  *ngIf="!serverType.managedFirewall"
                  name="lucideShieldOff"
                  size="12"
                  class="text-slate-400"
                  title="No managed firewall"
                ></ng-icon>
                <span
                  [class]="getCpuTypeBadgeClass(serverType.cpuType)"
                  class="px-1.5 py-0.5 text-xs font-medium rounded"
                >
                  {{ serverType.cpuType === 'dedicated' ? 'Ded' : 'VPS' }}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-1 text-xs mb-2">
              <div class="text-center">
                <p class="text-slate-500 dark:text-slate-400">vCPU</p>
                <p class="font-medium text-slate-900 dark:text-white">{{ serverType.vcpu }}</p>
              </div>
              <div class="text-center">
                <p class="text-slate-500 dark:text-slate-400">RAM</p>
                <p class="font-medium text-slate-900 dark:text-white">{{ serverType.ram }}GB</p>
              </div>
              <div class="text-center">
                <p class="text-slate-500 dark:text-slate-400">Disk</p>
                <p class="font-medium text-slate-900 dark:text-white">
                  {{ serverType.storageType === 'local' ? serverType.disk + 'G' : 'Net' }}
                </p>
              </div>
            </div>

            <div class="flex justify-between items-center text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
              <span class="text-slate-500 dark:text-slate-400">~€{{ pricingService.formatMonthlyPrice(serverType.pricePerHour) }}/mo</span>
              <span class="text-slate-400 dark:text-slate-500">€{{ serverType.pricePerHour.toFixed(4) }}/h</span>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          *ngIf="!wizardService.isServerTypeLoading() && filteredServerTypes().length === 0"
          class="text-center py-8"
        >
          <p class="text-sm text-slate-500 dark:text-slate-400">No server types match the selected filter.</p>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class ProviderRegionSelectorComponent implements OnInit {
  readonly wizardService = inject(ProviderWizardService);
  readonly pricingService = inject(PricingService);

  // === Inputs ===
  readonly currentStep = input.required<number>(); // 1, 2, or 3
  readonly selectedProvider = input<string>('');
  readonly selectedRegion = input<string>('');
  readonly selectedServerTypeId = input<string>('');
  readonly lockedProvider = input<string | null>(null);

  // === Outputs ===
  readonly providerSelected = output<string>();
  readonly regionSelected = output<string>();
  readonly serverTypeSelected = output<string>();

  // === State ===
  readonly cpuTypeFilter = signal<'all' | 'shared' | 'dedicated'>('all');
  readonly regions = signal<ProviderRegion[]>([]);
  readonly serverTypes = signal<ServerTypeOption[]>([]);

  // === Computed ===
  readonly filteredServerTypes = computed<ServerTypeOption[]>(() => {
    const filter = this.cpuTypeFilter();
    const types = this.serverTypes();

    if (filter === 'all') return types;
    return types.filter((type) => type.cpuType === filter);
  });

  // === Effects ===

  /**
   * Load regions when provider changes
   */
  constructor() {
    effect(() => {
      const provider = this.selectedProvider();
      if (provider && this.currentStep() === 2) {
        untracked(() =>
          this.wizardService.loadRegions(provider).then(
            (regions) => this.regions.set(regions),
            (error) => console.error('Failed to load regions:', error)
          )
        );
      }
    });

    /**
     * Load server types when region changes
     */
    effect(() => {
      const provider = this.selectedProvider();
      const region = this.selectedRegion();
      if (provider && region && this.currentStep() === 3) {
        untracked(() =>
          this.wizardService.loadServerTypes(provider, region).then(
            (serverTypes) => this.serverTypes.set(serverTypes),
            (error) => console.error('Failed to load server types:', error)
          )
        );
      }
    });
  }

  ngOnInit(): void {
    void (async () => {
      // Load providers on init
      if (this.currentStep() === 1) {
        try {
          await this.wizardService.loadProviders();
        } catch (error) {
          console.error('Failed to load providers:', error);
        }
      }
    })();
  }

  // === Methods ===

  selectProvider(providerId: string): void {
    const locked = this.lockedProvider();
    if (locked && providerId !== locked) return;
    this.providerSelected.emit(providerId);
  }

  isProviderDisabled(provider: ProviderOption): boolean {
    if (provider.comingSoon) return true;
    const locked = this.lockedProvider();
    return !!locked && provider.id !== locked;
  }

  selectRegion(regionId: string): void {
    this.regionSelected.emit(regionId);
  }

  selectServerType(serverTypeId: string): void {
    this.serverTypeSelected.emit(serverTypeId);
  }

  onLogoError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  setCpuTypeFilter(value: string): void {
    this.cpuTypeFilter.set(value as 'all' | 'shared' | 'dedicated');
  }

  // === Styling Methods ===

  getProviderCardClass(provider: ProviderOption): string {
    if (this.isProviderDisabled(provider)) {
      return 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed opacity-60';
    }

    const isSelected = this.selectedProvider() === provider.id;

    if (isSelected) {
      return 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20';
    }

    return 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800/50';
  }

  getRegionCardClass(region: ProviderRegion): string {
    if (!region.available) {
      return 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50';
    }

    const isSelected = this.selectedRegion() === region.id;

    if (isSelected) {
      return 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20';
    }

    return 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800/50';
  }

  getServerTypeCardClass(serverType: ServerTypeOption): string {
    if (!serverType.managedFirewall) {
      return 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30';
    }

    const isSelected = this.selectedServerTypeId() === serverType.id;

    if (isSelected) {
      return 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20';
    }

    return 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800/50';
  }

  getCpuTypeBadgeClass(cpuType: 'shared' | 'dedicated'): string {
    if (cpuType === 'dedicated') {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
  }
}
