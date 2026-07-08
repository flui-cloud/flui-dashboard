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
  lucidePlus,
} from '@ng-icons/lucide';
import { VNetService } from '../../../features/service/vnet.service';
import { VNetInfo, VNetStatus, CreateVNetConfiguration } from '../../../features/model/vnet.models';
import { ProviderWizardService } from '../../services/provider-wizard.service';
import { VNetTopologyDto } from '../../../core/api/model/vNetTopologyDto';

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
      lucidePlus,
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

      @if (!showCreateForm()) {
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
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
          @if (canCreate()) {
            <button
              type="button"
              (click)="openCreateForm()"
              class="inline-flex items-center gap-1.5 px-3 py-2 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors whitespace-nowrap"
            >
              <ng-icon name="lucidePlus" size="16"></ng-icon>
              New VNet
            </button>
          }
        </div>
      }

      <!-- Loading State -->
      <div *ngIf="isLoading() && !showCreateForm()" class="flex items-center justify-center py-12">
        <ng-icon name="lucideLoader" size="32" class="animate-spin text-blue-500"></ng-icon>
      </div>

      <!-- Error State -->
      <div
        *ngIf="error() && !isLoading() && !showCreateForm()"
        class="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg"
      >
        <ng-icon name="lucideCircleAlert" size="20"></ng-icon>
        <span>{{ error() }}</span>
      </div>

      <!-- VNets List -->
      <div *ngIf="!isLoading() && !error() && !showCreateForm()" class="space-y-2 max-h-96 overflow-y-auto">
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
          @if (canCreate() && !searchQuery()) {
            <button
              type="button"
              (click)="openCreateForm()"
              class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ng-icon name="lucidePlus" size="16"></ng-icon>
              Create a VNet for {{ provider() }}
            </button>
          }
        </div>
      </div>

      @if (showCreateForm()) {
        <div class="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/40 dark:bg-blue-900/10 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ng-icon name="lucideNetwork" size="20" class="text-blue-600 dark:text-blue-400"></ng-icon>
              <h3 class="font-semibold text-slate-900 dark:text-white">
                New VNet on <span class="capitalize">{{ provider() }}</span>
              </h3>
            </div>
            <button
              type="button"
              (click)="closeCreateForm()"
              class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <ng-icon name="lucideX" size="18"></ng-icon>
            </button>
          </div>

          <div
            *ngIf="createError()"
            class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm"
          >
            <ng-icon name="lucideCircleAlert" size="18" class="flex-shrink-0 mt-0.5"></ng-icon>
            <span>{{ createError() }}</span>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              VNet Name <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              [(ngModel)]="newVnetName"
              placeholder="e.g., hetzner-vnet"
              class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              IP Range (CIDR) <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              [(ngModel)]="newIpRange"
              [placeholder]="'e.g., 10.0.0.0/' + suggestedVnetPrefix()"
              class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              [class.border-red-500]="newIpRange && !isValidVnetCidr()"
            />
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {{ vnetCidrHint() }} —
              <button
                type="button"
                (click)="newIpRange = '10.0.0.0/' + suggestedVnetPrefix()"
                class="text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
              >Use /{{ suggestedVnetPrefix() }}</button>
            </p>
            @if (newIpRange && !isValidVnetCidr()) {
              <p class="text-xs text-red-600 dark:text-red-400 mt-1">{{ vnetCidrError() }}</p>
            } @else if (newIpRange && cidrOccupied(newIpRange)) {
              <p class="text-xs text-red-600 dark:text-red-400 mt-1">
                This range is already in use on {{ provider() }}.
                <button
                  type="button"
                  (click)="useFreeVnetCidr()"
                  class="text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
                >Use a free range</button>
              </p>
            }
          </div>

          @if (vnetZones().length > 0) {
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Network Zone <span class="text-red-500">*</span>
              </label>
              <select
                [(ngModel)]="newSubnetZone"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                @for (zone of vnetZones(); track zone.id) {
                  <option [value]="zone.id">{{ zone.displayName }}</option>
                }
              </select>
            </div>

            @if (supportsSubnets()) {
              <div>
                <label class="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input type="checkbox" [(ngModel)]="newCreateSubnet" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  Create an initial subnet in this zone
                </label>
                @if (newCreateSubnet) {
                  <div class="mt-2 ml-6">
                    <input
                      type="text"
                      [(ngModel)]="newSubnetIpRange"
                      placeholder="e.g., 10.0.0.0/24"
                      class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      [class.border-red-500]="newSubnetIpRange && !isValidSubnetCidr()"
                    />
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Subnet CIDR within the VNet range (required for this provider).
                    </p>
                    @if (newSubnetIpRange && !isValidSubnetCidr()) {
                      <p class="text-xs text-red-600 dark:text-red-400 mt-1">Enter a valid CIDR (e.g., 10.0.1.0/24)</p>
                    }
                  </div>
                }
              </div>
            }
          }

          <div class="flex gap-2 pt-2">
            <button
              type="button"
              (click)="submitCreateVNet()"
              [disabled]="isCreating() || !isCreateFormValid()"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ isCreating() ? 'Creating…' : 'Create & select' }}
            </button>
            <button
              type="button"
              (click)="closeCreateForm()"
              [disabled]="isCreating()"
              class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      }

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
  private readonly providerWizardService = inject(ProviderWizardService);

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


  showCreateForm = signal<boolean>(false);
  isCreating = signal<boolean>(false);
  createError = signal<string | null>(null);
  // Ranges already in use on this provider (shared-VPC providers only; empty for
  // isolated-network providers). Used to steer the user off an overlapping CIDR.
  occupiedCidrs = signal<string[]>([]);

  newVnetName = '';
  newIpRange = '';
  newSubnetZone = '';
  newCreateSubnet = true;
  newSubnetIpRange = '';

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


  readonly canCreate = computed<boolean>(() => !!this.provider() && !!this.vnetTopology());

  private readonly vnetTopology = computed<VNetTopologyDto | null>(() => {
    const p = this.provider();
    if (!p) return null;
    return this.providerWizardService.getProviderDefinition(p)?.capabilities?.vnetTopology ?? null;
  });

  readonly vnetZones = computed(() => this.vnetTopology()?.zones ?? []);
  readonly supportsSubnets = computed(() => this.vnetTopology()?.supportsSubnets ?? false);

  private readonly vnetIpConstraints = computed(() => this.vnetTopology()?.vnetIpRange ?? null);
  private readonly subnetIpConstraints = computed(() => this.vnetTopology()?.subnetIpRange ?? null);

  readonly suggestedVnetPrefix = computed<number>(() => {
    const c = this.vnetIpConstraints();
    if (!c) return 16;
    if (16 >= c.minPrefix && 16 <= c.maxPrefix) return 16;
    return Math.round((c.minPrefix + c.maxPrefix) / 2);
  });

  readonly vnetCidrHint = computed<string>(() => {
    const c = this.vnetIpConstraints();
    if (!c) return 'Recommended: /16 for production';
    return `Allowed: /${c.minPrefix}–/${c.maxPrefix}`;
  });

  // ===== LIFECYCLE =====

  constructor() {
    effect(() => {
      this.provider();
      this.loadVNets();
    });
  }

  ngOnInit(): void {
    this.loadVNets();
    // Provider definitions carry vnetTopology, needed to drive the inline create form.
    void this.providerWizardService.loadProviders();
  }


  async openCreateForm(): Promise<void> {
    const p = this.provider() ?? '';
    const zones = this.vnetZones();
    this.newSubnetZone = zones[0]?.id ?? '';
    this.newVnetName = this.newSubnetZone ? `${p}-${this.newSubnetZone}` : `${p}-vnet`;
    this.newCreateSubnet = this.supportsSubnets();
    this.createError.set(null);
    this.occupiedCidrs.set([]);
    this.newIpRange = `10.0.0.0/${this.suggestedVnetPrefix()}`;
    this.newSubnetIpRange = this.deriveDefaultSubnetCidr() ?? '';
    this.showCreateForm.set(true);

    // Steer away from ranges already used on shared-VPC providers (empty on
    // isolated providers). Pre-pick a free default so the user rarely hits it.
    if (p) {
      const occupied = await this.vnetService.getOccupiedSubnets(p, this.newSubnetZone || undefined);
      this.occupiedCidrs.set(occupied);
      if (occupied.length && this.cidrOccupied(this.newIpRange)) {
        this.newIpRange = this.firstFreeVnetCidr(this.suggestedVnetPrefix());
        this.newSubnetIpRange = this.deriveDefaultSubnetCidr() ?? '';
      }
    }
  }


  private cidrToRange(cidr: string): [number, number] | null {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(cidr);
    if (!m) return null;
    const prefix = Number.parseInt(m[5], 10);
    if (prefix < 0 || prefix > 32) return null;
    const ip =
      ((+m[1] << 24) | (+m[2] << 16) | (+m[3] << 8) | +m[4]) >>> 0;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    const start = (ip & mask) >>> 0;
    const end = (start | (~mask >>> 0)) >>> 0;
    return [start, end];
  }

  private cidrsOverlap(a: string, b: string): boolean {
    const ra = this.cidrToRange(a);
    const rb = this.cidrToRange(b);
    if (!ra || !rb) return false;
    return ra[0] <= rb[1] && rb[0] <= ra[1];
  }

  /** True if the given CIDR overlaps a range already in use on the provider. */
  cidrOccupied(cidr: string): boolean {
    return this.occupiedCidrs().some((c) => this.cidrsOverlap(c, cidr));
  }

  /** First 10.x.0.0/<prefix> block that doesn't overlap any occupied range. */
  private firstFreeVnetCidr(prefix: number): string {
    for (let second = 0; second < 256; second++) {
      const candidate = `10.${second}.0.0/${prefix}`;
      if (!this.cidrOccupied(candidate)) return candidate;
    }
    return `10.0.0.0/${prefix}`;
  }

  useFreeVnetCidr(): void {
    this.newIpRange = this.firstFreeVnetCidr(this.suggestedVnetPrefix());
    this.newSubnetIpRange = this.deriveDefaultSubnetCidr() ?? '';
  }

  /** Derive a concrete first-subnet CIDR from the VNet range (e.g. 10.0.0.0/16 → 10.0.0.0/24). */
  private deriveDefaultSubnetCidr(): string | undefined {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(this.newIpRange);
    if (!m) return undefined;
    const vnetPrefix = Number.parseInt(m[5], 10);
    const c = this.subnetIpConstraints();
    let prefix = Math.max(24, vnetPrefix);
    if (c) prefix = Math.min(Math.max(prefix, c.minPrefix), c.maxPrefix);
    // Network base of the VNet's first two octets is a valid subnet base for any prefix >= 16.
    return `${m[1]}.${m[2]}.0.0/${prefix}`;
  }

  closeCreateForm(): void {
    this.showCreateForm.set(false);
    this.createError.set(null);
  }

  private cidrMatches(value: string, constraints: { minPrefix: number; maxPrefix: number } | null): boolean {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!cidrRegex.test(value)) return false;
    const prefix = Number.parseInt(value.split('/')[1], 10);
    if (prefix < 0 || prefix > 32) return false;
    if (constraints && (prefix < constraints.minPrefix || prefix > constraints.maxPrefix)) return false;
    return true;
  }

  isValidVnetCidr(): boolean {
    return !!this.newIpRange && this.cidrMatches(this.newIpRange, this.vnetIpConstraints());
  }

  vnetCidrError(): string {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!cidrRegex.test(this.newIpRange)) return 'Enter a valid CIDR (e.g., 10.0.0.0/16)';
    const c = this.vnetIpConstraints();
    if (c) return `Prefix must be /${c.minPrefix}–/${c.maxPrefix} for this provider`;
    return 'Invalid CIDR';
  }

  isValidSubnetCidr(): boolean {
    if (!this.newSubnetIpRange) return true; // optional
    return this.cidrMatches(this.newSubnetIpRange, this.subnetIpConstraints());
  }

  isCreateFormValid(): boolean {
    if (!this.newVnetName || !this.isValidVnetCidr() || !this.isValidSubnetCidr()) return false;
    if (this.vnetZones().length > 0 && !this.newSubnetZone) return false;
    if (this.cidrOccupied(this.newIpRange)) return false;
    return true;
  }

  async submitCreateVNet(): Promise<void> {
    if (!this.isCreateFormValid()) return;
    this.isCreating.set(true);
    this.createError.set(null);

    const includeSubnet = this.newCreateSubnet && this.supportsSubnets() && !!this.newSubnetZone;
    const config: CreateVNetConfiguration = {
      name: this.newVnetName,
      provider: this.provider() ?? '',
      ipRange: this.newIpRange,
      subnet: includeSubnet
        ? {
            networkZone: this.newSubnetZone,
            // Concrete CIDR required — the provider drops subnets without one.
            ipRange: this.newSubnetIpRange || this.deriveDefaultSubnetCidr(),
          }
        : undefined,
    };

    try {
      const vnet = await this.vnetService.createVNet(config);
      this.showCreateForm.set(false);
      this.selectVNet(vnet);
    } catch (error: any) {
      this.createError.set(error?.error?.message || 'Failed to create VNet');
    } finally {
      this.isCreating.set(false);
    }
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
