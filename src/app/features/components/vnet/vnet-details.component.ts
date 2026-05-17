/**
 * VNet Details Component
 *
 * Displays detailed information about a Virtual Network including subnets,
 * routes, and attached servers. Provides subnet management capabilities.
 */

import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideRefreshCw,
  lucidePlus,
  lucideTrash2,
  lucideNetwork,
  lucideServer,
  lucideTag,
  lucideActivity,
  lucideMapPin,
  lucideInfo,
  lucideX
} from '@ng-icons/lucide';

import { VNetService } from '../../service/vnet.service';
import {
  SubnetInfo,
  VNetStatus,
  getAllAttachedServerIds
} from '../../model/vnet.models';
import { ServerSelectorComponent } from '../../../shared/components/server-selector/server-selector.component';
import { VirtualInstancesService } from '../../../core/api/api/virtualInstances.service';
import { InstanceWithLabels } from '../../model/instance.models';
import { InstanceStatusBadgeComponent } from '../compute/instance-status-badge.component';
import { firstValueFrom } from 'rxjs';
import { ProviderWizardService } from '../../../shared/services/provider-wizard.service';

@Component({
  selector: 'vnet-details',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, ServerSelectorComponent, InstanceStatusBadgeComponent],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideRefreshCw,
      lucidePlus,
      lucideTrash2,
      lucideNetwork,
      lucideServer,
      lucideTag,
      lucideActivity,
      lucideMapPin,
      lucideInfo,
      lucideX
    })
  ],
  template: `
    <div class="space-y-6 p-6">
      <!-- Header with Back Button -->
      <div class="flex items-center justify-between">
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
              @if (vnet()) {
                {{ vnet()!.name }}
              } @else {
                VNet Details
              }
            </h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Virtual Network details and subnet management
            </p>
          </div>
        </div>
        <div class="flex gap-3">
          <button
            (click)="syncVNet()"
            [disabled]="isLoading()"
            class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-4 w-4"
              [class.animate-spin]="isLoading()"
            />
            Sync
          </button>
          <button
            (click)="showDeleteConfirmation()"
            [disabled]="isLoading()"
            class="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ng-icon name="lucideTrash2" class="h-4 w-4" />
            Delete VNet
          </button>
        </div>
      </div>

      <!-- Loading State -->
      @if (isLoading() && !vnet()) {
        <div
          class="flex items-center justify-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <div class="text-center">
            <ng-icon name="lucideRefreshCw" class="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading VNet details...</p>
          </div>
        </div>
      }

      <!-- Error Message -->
      @if (errorMessage()) {
        <div
          class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
        >
          <div class="text-sm text-red-800 dark:text-red-200">
            {{ errorMessage() }}
          </div>
        </div>
      }

      <!-- VNet Details -->
      @if (vnet()) {
        <!-- Overview Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
              <ng-icon name="lucideActivity" class="h-4 w-4" />
              Status
            </div>
            <span
              class="inline-block px-2.5 py-1 rounded-full text-sm font-medium"
              [ngClass]="getStatusBadgeClass(vnet()!.status)"
            >
              {{ vnet()!.status }}
            </span>
          </div>

          <div
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
              <ng-icon name="lucideMapPin" class="h-4 w-4" />
              Provider
            </div>
            <div class="text-xl font-bold text-gray-900 dark:text-white capitalize">
              {{ vnet()!.provider }}
            </div>
          </div>

          <div
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
              <ng-icon name="lucideNetwork" class="h-4 w-4" />
              Subnets
            </div>
            <div class="text-xl font-bold text-gray-900 dark:text-white">
              {{ vnet()!.subnets.length }}
            </div>
          </div>

          <div
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
              <ng-icon name="lucideServer" class="h-4 w-4" />
              Attached Servers
            </div>
            <div class="text-xl font-bold text-gray-900 dark:text-white">
              {{ getAllAttachedServers() }}
            </div>
          </div>
        </div>

        <!-- VNet Information -->
        <div
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
        >
          <div class="flex items-center gap-2 mb-4">
            <ng-icon name="lucideInfo" class="h-5 w-5 text-gray-500" />
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              Network Information
            </h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">VNet ID</div>
              <div class="text-sm font-mono text-gray-900 dark:text-white">
                {{ vnet()!.id }}
              </div>
            </div>

            <div>
              <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Provider Resource ID
              </div>
              <div class="text-sm font-mono text-gray-900 dark:text-white">
                {{ vnet()!.providerResourceId }}
              </div>
            </div>

            <div>
              <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">IP Range</div>
              <div class="text-sm font-mono text-gray-900 dark:text-white">
                {{ vnet()!.ipRange }}
              </div>
            </div>

            <div>
              <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Created At</div>
              <div class="text-sm text-gray-900 dark:text-white">
                {{ vnet()!.createdAt | date: 'medium' }}
              </div>
            </div>
          </div>

          @if (vnet()!.labels.length > 0) {
            <div class="mt-6">
              <div class="flex items-center gap-2 mb-3">
                <ng-icon name="lucideTag" class="h-4 w-4 text-gray-500" />
                <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Labels</div>
              </div>
              <div class="flex flex-wrap gap-2">
                @for (label of vnet()!.labels; track label.key) {
                  <span
                    class="px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    <span class="font-medium">{{ label.key }}:</span> {{ label.value }}
                  </span>
                }
              </div>
            </div>
          }
        </div>

        <!-- Subnets Section -->
        <div
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
        >
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-2">
              <ng-icon name="lucideNetwork" class="h-5 w-5 text-gray-500" />
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Subnets</h2>
            </div>
            @if (supportsSubnets()) {
              <button
                (click)="showAddSubnetForm()"
                [disabled]="isLoading()"
                class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ng-icon name="lucidePlus" class="h-4 w-4" />
                Add Subnet
              </button>
            }
          </div>

          @if (vnet()!.subnets.length === 0) {
            <div class="text-center py-8">
              <ng-icon name="lucideNetwork" class="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p class="text-sm text-gray-600 dark:text-gray-400">
                No subnets configured yet
              </p>
            </div>
          } @else {
            <div class="space-y-3">
              @for (subnet of vnet()!.subnets; track subnet.id) {
                <div
                  class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-3 mb-2">
                        <span class="text-base font-mono font-semibold text-gray-900 dark:text-white">
                          {{ subnet.ipRange }}
                        </span>
                        <span
                          class="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        >
                          {{ subnet.attachedServerIds.length }} server(s)
                        </span>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                        <div>
                          <div class="text-xs text-gray-500 dark:text-gray-400">Network Zone</div>
                          <div class="text-sm text-gray-900 dark:text-white mt-1">
                            {{ subnet.networkZone }}
                          </div>
                        </div>

                        @if (subnet.gateway) {
                          <div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Gateway</div>
                            <div class="text-sm font-mono text-gray-900 dark:text-white mt-1">
                              {{ subnet.gateway }}
                            </div>
                          </div>
                        }

                        @if (subnet.providerSubnetId) {
                          <div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">
                              Provider Subnet ID
                            </div>
                            <div class="text-sm font-mono text-gray-900 dark:text-white mt-1">
                              {{ subnet.providerSubnetId }}
                            </div>
                          </div>
                        }
                      </div>

                      <!-- Attached Servers Section -->
                      @if (subnet.attachedServerIds.length > 0) {
                        <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Attached Servers
                          </div>
                          <div class="space-y-2">
                            @for (serverId of subnet.attachedServerIds; track serverId) {
                              <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div class="flex items-center gap-2">
                                  <ng-icon name="lucideServer" size="16" class="text-gray-500" />
                                  <span class="text-sm font-mono text-gray-900 dark:text-white">
                                    {{ getServerName(serverId) || serverId }}
                                  </span>
                                  @if (getServer(serverId)) {
                                    <app-instance-status-badge [status]="getServer(serverId)!.status || 'unknown'" />
                                  }
                                </div>
                                <button
                                  (click)="detachServer(subnet, serverId)"
                                  [disabled]="isLoading()"
                                  class="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  title="Detach server"
                                >
                                  <ng-icon name="lucideX" size="16" />
                                </button>
                              </div>
                            }
                          </div>
                        </div>
                      }

                      <!-- Attach Server Form -->
                      @if (showAttachServerForm() === subnet.id) {
                        <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div class="flex items-center justify-between mb-3">
                            <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                              Attach Server to Subnet
                            </h4>
                            <button
                              (click)="cancelAttachServer()"
                              class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                          <app-server-selector
                            [provider]="vnet()!.provider"
                            [excludeServerIds]="subnet.attachedServerIds"
                            [multiSelect]="false"
                            (serverSelected)="onServerSelected(subnet, $event)"
                          />
                        </div>
                      } @else {
                        <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <button
                            (click)="showAttachServerToSubnet(subnet)"
                            [disabled]="isLoading()"
                            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ng-icon name="lucidePlus" size="16" />
                            Attach Server
                          </button>
                        </div>
                      }
                    </div>

                    <button
                      (click)="confirmDeleteSubnet(subnet)"
                      [disabled]="isLoading()"
                      class="ml-4 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Delete subnet"
                    >
                      <ng-icon name="lucideTrash2" class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Add Subnet Modal -->
        @if (showSubnetForm() && supportsSubnets()) {
          <div
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            (click)="cancelAddSubnet()"
          >
            <div
              class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
              (click)="$event.stopPropagation()"
            >
              <div class="flex items-center justify-between mb-5">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Subnet</h3>
                <button
                  (click)="cancelAddSubnet()"
                  class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
                >
                  <ng-icon name="lucideX" class="h-5 w-5" />
                </button>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Region
                  </label>
                  @if (vnetTopologyZones().length > 0) {
                    <select
                      [(ngModel)]="newSubnetZone"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      @for (zone of vnetTopologyZones(); track zone.id) {
                        <option [value]="zone.id">{{ zone.displayName || zone.id }}</option>
                      }
                    </select>
                  } @else {
                    <input
                      type="text"
                      [(ngModel)]="newSubnetZone"
                      placeholder="e.g., eu-central"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  }
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    IP Range
                  </label>
                  <input
                    type="text"
                    [ngModel]="newSubnetIpRange()"
                    (ngModelChange)="newSubnetIpRange.set($event)"
                    [placeholder]="'e.g., 10.0.1.0/' + suggestedSubnetPrefix()"
                    [class.border-red-500]="newSubnetIpRange() && !isSubnetCidrValid()"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {{ subnetCidrHint() }} —
                    <button type="button"
                      (click)="newSubnetIpRange.set('10.0.1.0/' + suggestedSubnetPrefix())"
                      class="text-blue-600 hover:text-blue-700 dark:text-blue-400 underline">
                      Use /{{ suggestedSubnetPrefix() }}
                    </button>
                    @if (subnetIpAddressLabel()) {
                      <span class="ml-2 text-gray-400 dark:text-gray-500">· {{ subnetIpAddressLabel() }}</span>
                    }
                  </p>
                  @if (subnetCidrError()) {
                    <p class="text-xs text-red-600 dark:text-red-400 mt-1">{{ subnetCidrError() }}</p>
                  }
                </div>
              </div>

              <div class="flex gap-3 justify-end mt-6">
                <button
                  (click)="cancelAddSubnet()"
                  [disabled]="isLoading()"
                  class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  (click)="addSubnet()"
                  [disabled]="isLoading() || !newSubnetZone"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  @if (isLoading()) { Adding… } @else { Add Subnet }
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Delete Confirmation Modal (Simple) -->
        @if (showDeleteModal()) {
          <div
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            (click)="cancelDelete()"
          >
            <div
              class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
              (click)="$event.stopPropagation()"
            >
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Confirm Deletion
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {{ deleteConfirmMessage() }}
              </p>
              <div class="flex gap-3 justify-end">
                <button
                  (click)="cancelDelete()"
                  class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  (click)="confirmDelete()"
                  [disabled]="isLoading()"
                  class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: []
})
export class VNetDetailsComponent implements OnInit {
  private readonly vnetService = inject(VNetService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly instancesApi = inject(VirtualInstancesService);
  private readonly providerWizardService = inject(ProviderWizardService);

  readonly vnet = this.vnetService.selectedVNet;
  readonly isLoading = this.vnetService.loading;
  readonly errorMessage = this.vnetService.errorMessage;

  readonly vnetTopology = computed(() => {
    const provider = this.vnet()?.provider;
    if (!provider) return null;
    return this.providerWizardService.getProviderDefinition(provider)?.capabilities?.vnetTopology ?? null;
  });

  readonly supportsSubnets = computed(() => this.vnetTopology()?.supportsSubnets ?? false);

  readonly vnetTopologyZones = computed(() => this.vnetTopology()?.zones ?? []);

  readonly subnetIpConstraints = computed(() => this.vnetTopology()?.subnetIpRange ?? null);

  readonly suggestedSubnetPrefix = computed(() => {
    const c = this.subnetIpConstraints();
    if (!c) return 28;
    if (28 >= c.minPrefix && 28 <= c.maxPrefix) return 28;
    return Math.round((c.minPrefix + c.maxPrefix) / 2);
  });

  readonly subnetCidrHint = computed(() => {
    const c = this.subnetIpConstraints();
    if (!c) return 'Leave empty for auto /28 allocation';
    return `Allowed: /${c.minPrefix}–/${c.maxPrefix}`;
  });

  readonly subnetIpAddressLabel = computed(() => {
    const val = this.newSubnetIpRange();
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!val || !cidrRegex.test(val)) return null;
    const [ipPart, prefixStr] = val.split('/');
    const prefix = Number.parseInt(prefixStr, 10);
    if (prefix < 0 || prefix > 32) return null;
    const count = Math.pow(2, 32 - prefix);
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

  readonly isSubnetCidrValid = computed(() => {
    const val = this.newSubnetIpRange();
    if (!val) return true; // optional
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!cidrRegex.test(val)) return false;
    const prefix = Number.parseInt(val.split('/')[1], 10);
    const c = this.subnetIpConstraints();
    if (c && (prefix < c.minPrefix || prefix > c.maxPrefix)) return false;
    return true;
  });

  readonly subnetCidrError = computed(() => {
    const val = this.newSubnetIpRange();
    if (!val) return '';
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!cidrRegex.test(val)) return 'Enter a valid CIDR (e.g., 10.0.1.0/28)';
    const prefix = Number.parseInt(val.split('/')[1], 10);
    const c = this.subnetIpConstraints();
    if (c && (prefix < c.minPrefix || prefix > c.maxPrefix)) {
      return `Prefix must be /${c.minPrefix}–/${c.maxPrefix} for this provider`;
    }
    return '';
  });

  // Local state for forms and modals
  showSubnetForm = signal(false);
  showDeleteModal = signal(false);
  deleteTarget = signal<'vnet' | 'subnet'>('vnet');
  deleteTargetSubnet = signal<SubnetInfo | null>(null);
  showAttachServerForm = signal<string | null>(null); // subnet ID
  serversCache = signal<Map<string, InstanceWithLabels>>(new Map());

  // Subnet form fields
  newSubnetZone = '';
  newSubnetIpRange = signal<string>('');

  deleteConfirmMessage = computed(() => {
    if (this.deleteTarget() === 'vnet') {
      const vnet = this.vnet();
      if (!vnet) return '';
      const totalServers = getAllAttachedServerIds(vnet).length;
      return `Are you sure you want to delete VNet "${vnet.name}"? This action cannot be undone. ${
        totalServers > 0
          ? `\n\nWarning: ${totalServers} server(s) are currently attached and will be detached.`
          : ''
      }`;
    } else {
      const subnet = this.deleteTargetSubnet();
      if (!subnet) return '';
      const serverCount = subnet.attachedServerIds.length;
      return `Are you sure you want to delete subnet ${subnet.ipRange}? This action cannot be undone.${
        serverCount > 0
          ? `\n\nWarning: ${serverCount} server(s) are currently attached and will be detached.`
          : ''
      }`;
    }
  });

  ngOnInit() {
    const vnetId = this.route.snapshot.paramMap.get('id');
    if (vnetId) {
      this.loadVNet(vnetId);
    } else {
      this.router.navigate(['/infrastructure/vnet']);
    }
  }

  async loadVNet(id: string) {
    try {
      await Promise.all([
        this.vnetService.getVNet(id),
        this.providerWizardService.loadProviders()
      ]);
      await this.loadServers();
    } catch (error) {
      console.error('Failed to load VNet:', error);
    }
  }

  async loadServers() {
    const vnet = this.vnet();
    if (!vnet) return;

    try {
      const allServerIds = getAllAttachedServerIds(vnet);
      if (allServerIds.length === 0) return;

      // Load all servers for this provider
      const response = await firstValueFrom(
        this.instancesApi.instancesControllerFindAll(
          undefined,
          undefined,
          undefined,
          vnet.provider,
          undefined,
          undefined,
          undefined
        )
      );

      const servers = (response.data || []) as InstanceWithLabels[];
      const cache = new Map<string, InstanceWithLabels>();
      servers.forEach(server => {
        if (server.id) {
          cache.set(server.id, server);
        }
      });
      this.serversCache.set(cache);
    } catch (error) {
      console.error('Failed to load servers:', error);
    }
  }

  async syncVNet() {
    const vnet = this.vnet();
    if (!vnet) return;

    try {
      await this.vnetService.syncVNet(vnet.id);
    } catch (error) {
      console.error('Failed to sync VNet:', error);
    }
  }

  goBack() {
    this.router.navigate(['/infrastructure/vnet']);
  }

  // Subnet management
  showAddSubnetForm() {
    this.showSubnetForm.set(true);
    this.resetSubnetForm();
  }

  cancelAddSubnet() {
    this.showSubnetForm.set(false);
    this.resetSubnetForm();
  }

  resetSubnetForm() {
    const zones = this.vnetTopologyZones();
    this.newSubnetZone = zones.length > 0 ? zones[0].id : '';
    this.newSubnetIpRange.set('');
  }

  async addSubnet() {
    const vnet = this.vnet();
    if (!vnet || !this.newSubnetZone) return;

    try {
      await this.vnetService.addSubnet(vnet.id, {
        networkZone: this.newSubnetZone,
        ipRange: this.newSubnetIpRange() || undefined
      });

      this.showSubnetForm.set(false);
      this.resetSubnetForm();
    } catch (error) {
      console.error('Failed to add subnet:', error);
    }
  }

  confirmDeleteSubnet(subnet: SubnetInfo) {
    this.deleteTarget.set('subnet');
    this.deleteTargetSubnet.set(subnet);
    this.showDeleteModal.set(true);
  }

  showDeleteConfirmation() {
    this.deleteTarget.set('vnet');
    this.deleteTargetSubnet.set(null);
    this.showDeleteModal.set(true);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.deleteTarget.set('vnet');
    this.deleteTargetSubnet.set(null);
  }

  async confirmDelete() {
    if (this.deleteTarget() === 'vnet') {
      await this.deleteVNet();
    } else {
      await this.deleteSubnet();
    }
  }

  async deleteVNet() {
    const vnet = this.vnet();
    if (!vnet) return;

    try {
      await this.vnetService.deleteVNet(vnet.id);
      this.showDeleteModal.set(false);
      this.router.navigate(['/infrastructure/vnet']);
    } catch (error) {
      console.error('Failed to delete VNet:', error);
      this.showDeleteModal.set(false);
    }
  }

  async deleteSubnet() {
    const vnet = this.vnet();
    const subnet = this.deleteTargetSubnet();
    if (!vnet || !subnet?.providerSubnetId) return;

    try {
      await this.vnetService.deleteSubnet(vnet.id, subnet.providerSubnetId);
      this.showDeleteModal.set(false);
      this.deleteTargetSubnet.set(null);
    } catch (error) {
      console.error('Failed to delete subnet:', error);
      this.showDeleteModal.set(false);
    }
  }

  // Server management methods

  showAttachServerToSubnet(subnet: SubnetInfo) {
    this.showAttachServerForm.set(subnet.id);
  }

  cancelAttachServer() {
    this.showAttachServerForm.set(null);
  }

  async onServerSelected(subnet: SubnetInfo, server: InstanceWithLabels) {
    if (!server.id) return;

    try {
      await this.vnetService.attachServerToSubnet(subnet.id, {
        serverId: server.id
      });

      // Refresh servers cache
      await this.loadServers();

      // Hide the form
      this.showAttachServerForm.set(null);
    } catch (error) {
      console.error('Failed to attach server:', error);
    }
  }

  async detachServer(subnet: SubnetInfo, serverId: string) {
    try {
      await this.vnetService.detachServerFromSubnet(subnet.id, {
        serverId
      });

      // Refresh servers cache
      await this.loadServers();
    } catch (error) {
      console.error('Failed to detach server:', error);
    }
  }

  getServer(serverId: string): InstanceWithLabels | null {
    return this.serversCache().get(serverId) || null;
  }

  getServerName(serverId: string): string | null {
    const server = this.getServer(serverId);
    return server ? (server.displayName || server.name || null) : null;
  }

  getAllAttachedServers(): number {
    const vnet = this.vnet();
    return vnet ? getAllAttachedServerIds(vnet).length : 0;
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
