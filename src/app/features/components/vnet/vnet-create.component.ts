/**
 * VNet Create Component
 *
 * Form for creating a new Virtual Network with initial subnet configuration.
 */

import { Component, signal, inject, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideNetwork,
  lucideInfo,
  lucideCircleAlert
} from '@ng-icons/lucide';

import { VNetService } from '../../service/vnet.service';
import {
  CreateVNetConfiguration
} from '../../model/vnet.models';
import { ProviderWizardService } from '../../../shared/services/provider-wizard.service';
import { VNetTopologyDto } from '../../../core/api/model/vNetTopologyDto';

@Component({
  selector: 'vnet-create',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideNetwork,
      lucideInfo,
      lucideCircleAlert
    })
  ],
  template: `
    <div class="space-y-6 p-6 max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <button
          (click)="goBack()"
          class="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
          Back
        </button>
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            Create Virtual Network
          </h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Create a new VNet with automatic subnet provisioning
          </p>
        </div>
      </div>

      <!-- Error Message -->
      @if (errorMessage()) {
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div class="flex items-start gap-2">
            <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div class="text-sm text-red-800 dark:text-red-200">{{ errorMessage() }}</div>
          </div>
        </div>
      }

      <!-- Form -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div class="space-y-6">

          <!-- Basic Information -->
          <div>
            <div class="flex items-center gap-2 mb-4">
              <ng-icon name="lucideNetwork" class="h-5 w-5 text-gray-500" />
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Network Configuration</h2>
            </div>

            <div class="space-y-4">
              <!-- Provider -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cloud Provider <span class="text-red-500">*</span>
                </label>
                @if (isLoadingProviders()) {
                  <div class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-400 text-sm">
                    Loading providers...
                  </div>
                } @else {
                  <select
                    [ngModel]="providerSignal()"
                    (ngModelChange)="onProviderChange($event)"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    @for (p of enabledProviders(); track p.id) {
                      <option [value]="p.id">{{ p.name }}</option>
                    }
                  </select>
                }
              </div>

              <!-- IP Range -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  IP Range (CIDR) <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  [ngModel]="ipRange()"
                  (ngModelChange)="ipRange.set($event)"
                  [placeholder]="'e.g., 10.0.0.0/' + suggestedVnetPrefix()"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  [class.border-red-500]="ipRange() && !isValidCIDR()"
                />
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ vnetCidrHint() }} —
                  <button
                    type="button"
                    (click)="ipRange.set('10.0.0.0/' + suggestedVnetPrefix())"
                    class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                  >Use /{{ suggestedVnetPrefix() }}</button>
                  @if (ipRangeAddressLabel()) {
                    <span class="ml-2 text-gray-400 dark:text-gray-500">· {{ ipRangeAddressLabel() }}</span>
                  }
                </p>
                @if (ipRange() && !isValidCIDR()) {
                  <p class="text-xs text-red-600 dark:text-red-400 mt-1">
                    {{ cidrErrorMessage() }}
                  </p>
                }
              </div>
            </div>
          </div>

          <!-- Network Zone — shown whenever provider has vnetTopology with zones -->
          @if (vnetTopology() && vnetZones().length > 0) {
            <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div class="space-y-4">
                <!-- Network Zone selector -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Network Zone <span class="text-red-500">*</span>
                  </label>
                  <select
                    [(ngModel)]="subnetZone"
                    (ngModelChange)="onZoneChange($event)"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    @for (zone of vnetZones(); track zone.id) {
                      <option [value]="zone.id">{{ zone.displayName }}</option>
                    }
                  </select>
                  @if (selectedZoneCoveredRegions.length > 0) {
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Covers: {{ selectedZoneCoveredRegions.join(', ') }}
                    </p>
                  }
                </div>

                <!-- Initial Subnet — only for providers that support subnets -->
                @if (supportsSubnets()) {
                  <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div class="flex items-center gap-2 mb-3">
                      <ng-icon name="lucideInfo" class="h-4 w-4 text-gray-500" />
                      <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Initial Subnet (Optional)</h2>
                    </div>
                    <div class="space-y-3">
                      <div class="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="createSubnet"
                          [(ngModel)]="createInitialSubnet"
                          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label for="createSubnet" class="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Create initial subnet in this zone
                        </label>
                      </div>
                      @if (createInitialSubnet) {
                        <div class="ml-6">
                          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Subnet IP Range (Optional)
                          </label>
                          <input
                            type="text"
                            [(ngModel)]="subnetIpRange"
                            placeholder="Leave empty for auto-allocation"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            [class.border-red-500]="subnetIpRange && !isValidSubnetCIDR()"
                          />
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {{ subnetCidrHint() }}
                          </p>
                          @if (subnetIpRange && !isValidSubnetCIDR()) {
                            <p class="text-xs text-red-600 dark:text-red-400 mt-1">
                              {{ subnetCidrErrorMessage() }}
                            </p>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- VNet Name -->
          <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              VNet Name <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              [(ngModel)]="vnetName"
              (input)="onNameInput()"
              placeholder="e.g., production-network"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              [class.border-red-500]="showValidation() && !vnetName"
            />
            @if (!nameCustomized && vnetName) {
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Auto-suggested — edit to customize
              </p>
            }
            @if (showValidation() && !vnetName) {
              <p class="text-xs text-red-600 dark:text-red-400 mt-1">VNet name is required</p>
            }
          </div>

          <!-- Labels (Optional) -->
          <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Labels (Optional)</h2>
              <button
                (click)="addLabel()"
                type="button"
                class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                + Add Label
              </button>
            </div>

            @if (labels().length > 0) {
              <div class="space-y-2">
                @for (label of labels(); track $index; let i = $index) {
                  <div class="flex gap-2">
                    <input
                      type="text"
                      [(ngModel)]="label.key"
                      placeholder="Key"
                      class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      [(ngModel)]="label.value"
                      placeholder="Value"
                      class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      (click)="removeLabel(i)"
                      type="button"
                      class="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              (click)="createVNet()"
              [disabled]="isLoading() || !isFormValid()"
              class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              @if (isLoading()) {
                <span>Creating...</span>
              } @else {
                <span>Create VNet</span>
              }
            </button>
            <button
              (click)="goBack()"
              [disabled]="isLoading()"
              class="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class VNetCreateComponent implements OnInit {
  private readonly vnetService = inject(VNetService);
  private readonly router = inject(Router);
  private readonly providerWizardService = inject(ProviderWizardService);

  readonly isLoading = this.vnetService.loading;
  readonly errorMessage = this.vnetService.errorMessage;
  readonly isLoadingProviders = this.providerWizardService.isProviderLoading;

  readonly enabledProviders = () =>
    this.providerWizardService.providersData().filter(p => !p.comingSoon);

  /** VNet topology of the selected provider (null = no VNet support) */
  readonly vnetTopology = computed((): VNetTopologyDto | null => {
    const def = this.providerWizardService.getProviderDefinition(this.providerSignal());
    return def?.capabilities?.vnetTopology ?? null;
  });

  /** Network zones from topology */
  readonly vnetZones = computed(() => this.vnetTopology()?.zones ?? []);

  /** Whether the provider supports subnets inside a VNet at all (Scaleway = false) */
  readonly supportsSubnets = computed(() => this.vnetTopology()?.supportsSubnets ?? false);

  /** Whether subnets can target individual zones for this provider */
  readonly subnetPerZone = computed(() => this.vnetTopology()?.subnetPerZone ?? false);

  /** VNet IP range constraints from topology (null = no constraint) */
  readonly vnetIpConstraints = computed(() => this.vnetTopology()?.vnetIpRange ?? null);

  /** Subnet IP range constraints from topology (null = no constraint) */
  readonly subnetIpConstraints = computed(() => this.vnetTopology()?.subnetIpRange ?? null);

  /** Suggested prefix: prefer /16 if valid, otherwise pick the midpoint of the allowed range */
  readonly suggestedVnetPrefix = computed(() => {
    const c = this.vnetIpConstraints();
    if (!c) return 16;
    if (16 >= c.minPrefix && 16 <= c.maxPrefix) return 16;
    return Math.round((c.minPrefix + c.maxPrefix) / 2);
  });

  /** Human-readable VNet CIDR constraint hint */
  readonly vnetCidrHint = computed(() => {
    const c = this.vnetIpConstraints();
    if (!c) return 'Recommended: /16 for production';
    return `Allowed: /${c.minPrefix}–/${c.maxPrefix}`;
  });

  /** Number of IP addresses for the current ipRange value (null if invalid) */
  readonly ipRangeAddressCount = computed(() => {
    const val = this.ipRange();
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!val || !cidrRegex.test(val)) return null;
    const prefix = Number.parseInt(val.split('/')[1], 10);
    if (prefix < 0 || prefix > 32) return null;
    return Math.pow(2, 32 - prefix);
  });

  /** Human-readable address count + range (e.g. "1,048,576 addresses · 10.0.0.0–10.15.255.255") */
  readonly ipRangeAddressLabel = computed(() => {
    const val = this.ipRange();
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!val || !cidrRegex.test(val)) return null;
    const count = this.ipRangeAddressCount();
    if (count === null) return null;

    const [ipPart, prefixStr] = val.split('/');
    const prefix = Number.parseInt(prefixStr, 10);
    const parts = ipPart.split('.').map(Number);
    const base = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    const first = (base & mask) >>> 0;
    const last = (first | (~mask >>> 0)) >>> 0;

    const toIp = (n: number) =>
      `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;

    const countLabel = count >= 1_000_000
      ? `${(count / 1_000_000).toFixed(1)}M`
      : count.toLocaleString();

    return `${countLabel} addresses · ${toIp(first)}–${toIp(last)}`;
  });

  /** Human-readable subnet CIDR constraint hint */
  readonly subnetCidrHint = computed(() => {
    const c = this.subnetIpConstraints();
    if (!c) return 'Leave empty to automatically allocate a /28 subnet (16 IPs)';
    return `Allowed range: /${c.minPrefix} to /${c.maxPrefix}. Leave empty for auto-allocation.`;
  });

  /** Covered regions of the currently selected zone */
  get selectedZoneCoveredRegions(): string[] {
    return this.vnetZones().find(z => z.id === this.subnetZone)?.coveredRegions ?? [];
  }

  // Form fields
  vnetName = '';
  nameCustomized = false;
  providerSignal = signal<string>('');
  ipRange = signal<string>('');

  // Subnet fields
  createInitialSubnet = true;
  subnetZone = '';
  subnetIpRange = '';

  // Labels
  labels = signal<{ key: string; value: string }[]>([]);

  // Validation
  showValidation = signal(false);

  constructor() {
    // Auto-select first zone and suggest name when topology/provider changes
    effect(() => {
      const zones = this.vnetZones();
      if (zones.length > 0) {
        this.subnetZone = zones[0].id;
      } else {
        this.subnetZone = '';
      }
      // Update suggested name if user hasn't customized it
      if (!this.nameCustomized) {
        const p = this.providerSignal();
        const z = this.subnetZone;
        this.vnetName = z ? `${p}-${z}` : p;
      }
    });
  }

  ngOnInit(): void {
    void (async () => {
      await this.providerWizardService.loadProviders();
      const first = this.enabledProviders()[0];
      if (first) {
        this.providerSignal.set(first.id);
      }
    })();
  }

  onProviderChange(value: string) {
    this.nameCustomized = false; // reset so name re-suggests on provider change
    this.providerSignal.set(value);
  }

  onZoneChange(value: string) {
    this.subnetZone = value;
    if (!this.nameCustomized) {
      this.vnetName = `${this.providerSignal()}-${value}`;
    }
  }

  onNameInput() {
    this.nameCustomized = true;
  }

  addLabel() {
    this.labels.update(current => [...current, { key: '', value: '' }]);
  }

  removeLabel(index: number) {
    this.labels.update(current => current.filter((_, i) => i !== index));
  }

  isValidCIDR(): boolean {
    const val = this.ipRange();
    if (!val) return false;
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!cidrRegex.test(val)) return false;
    const prefix = Number.parseInt(val.split('/')[1], 10);
    const c = this.vnetIpConstraints();
    if (c && (prefix < c.minPrefix || prefix > c.maxPrefix)) return false;
    return true;
  }

  cidrErrorMessage(): string {
    const val = this.ipRange();
    if (!val) return '';
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!cidrRegex.test(val)) return 'Enter a valid CIDR (e.g., 10.0.0.0/16)';
    const prefix = Number.parseInt(val.split('/')[1], 10);
    const c = this.vnetIpConstraints();
    if (c && (prefix < c.minPrefix || prefix > c.maxPrefix)) {
      return `Prefix must be /${c.minPrefix}–/${c.maxPrefix} for this provider`;
    }
    return '';
  }

  isValidSubnetCIDR(): boolean {
    if (!this.subnetIpRange) return true; // optional field
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!cidrRegex.test(this.subnetIpRange)) return false;
    const prefix = Number.parseInt(this.subnetIpRange.split('/')[1], 10);
    const c = this.subnetIpConstraints();
    if (c && (prefix < c.minPrefix || prefix > c.maxPrefix)) return false;
    return true;
  }

  subnetCidrErrorMessage(): string {
    if (!this.subnetIpRange) return '';
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!cidrRegex.test(this.subnetIpRange)) return 'Please enter a valid CIDR notation (e.g., 10.0.0.0/24)';
    const prefix = Number.parseInt(this.subnetIpRange.split('/')[1], 10);
    const c = this.subnetIpConstraints();
    if (c && (prefix < c.minPrefix || prefix > c.maxPrefix)) {
      return `Prefix must be between /${c.minPrefix} and /${c.maxPrefix} for this provider`;
    }
    return '';
  }

  isFormValid(): boolean {
    return !!(this.vnetName && this.ipRange() && this.isValidCIDR() && this.isValidSubnetCIDR());
  }

  async createVNet() {
    this.showValidation.set(true);

    if (!this.isFormValid()) {
      return;
    }

    const hasSubnet = this.createInitialSubnet && this.supportsSubnets() && this.subnetZone;

    const config: CreateVNetConfiguration = {
      name: this.vnetName,
      provider: this.providerSignal(),
      ipRange: this.ipRange(),
      labels: this.labels()
        .filter(l => l.key && l.value)
        .map(l => ({ key: l.key, value: l.value })),
      subnet: hasSubnet
        ? {
            networkZone: this.subnetZone,
            ipRange: this.subnetIpRange || undefined
          }
        : undefined
    };

    try {
      const vnet = await this.vnetService.createVNet(config);
      this.router.navigate(['/infrastructure/vnet', vnet.id]);
    } catch (error) {
      console.error('Failed to create VNet:', error);
    }
  }

  goBack() {
    this.router.navigate(['/infrastructure/vnet']);
  }
}
