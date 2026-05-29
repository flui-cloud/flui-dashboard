import {
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  Validators,
  AsyncValidatorFn,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideSettings,
  lucideMapPin,
  lucideServer,
  lucideKey,
  lucideCheck,
  lucideZap,
  lucideEuro,
  lucidePlay,
  lucideLoader,
  lucideShield,
  lucideRefreshCw,
  lucideInfo,
  lucideWand,
  lucideNetwork,
  lucideHardDrive,
} from '@ng-icons/lucide';
import { WizardStep, NodeSizeOption, ClusterConfiguration, ProviderType, ClusterType as ClusterEntityType, isControlClusterType } from '../../model/cluster.models';
import { ClusterService } from '../../service/cluster.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { AutoscaleDefaults } from '../../model/autoscale.models';
import { AccessManagementService } from '../../../core/api/api/accessManagement.service';
import { VNetInfo } from '../../model/vnet.models';
import { firstValueFrom } from 'rxjs';

// Import shared components
import { WizardShellComponent } from '../../../shared/components/wizard-shell/wizard-shell.component';
import { ProviderRegionSelectorComponent } from '../../../shared/components/provider-region-selector/provider-region-selector.component';
import { SshKeySelectorComponent } from '../../../shared/components/ssh-key-selector/ssh-key-selector.component';
import { VNetSelectorComponent } from '../../../shared/components/vnet-selector/vnet-selector.component';
import { ProviderWizardService } from '../../../shared/services/provider-wizard.service';
import { PricingService } from '../../../shared/services/pricing.service';

// Import firewall components and utilities
import { IpDetectionService } from '../../../shared/services/ip-detection.service';
import { cidrListValidator } from '../../../shared/utils/cidr-validator';
import {
  ClusterType,
  getDefaultRulesForClusterType,
  isValidCidr
} from '../../model/firewall-v2.models';

/**
 * Cluster Creation Wizard - Refactored
 *
 * Now uses shared components:
 * - WizardShellComponent for wizard UI wrapper
 * - ProviderRegionSelectorComponent for provider/region/server selection
 * - SshKeySelectorComponent for SSH key management
 * - ProviderWizardService for API calls and state
 *
 * Reduced from ~1500 lines to ~450 lines (-70%)
 */
@Component({
  selector: 'cluster-creation-wizard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgIcon,
    WizardShellComponent,
    ProviderRegionSelectorComponent,
    SshKeySelectorComponent,
    VNetSelectorComponent,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideSettings,
      lucideMapPin,
      lucideServer,
      lucideKey,
      lucideCheck,
      lucideZap,
      lucideEuro,
      lucidePlay,
      lucideLoader,
      lucideShield,
      lucideRefreshCw,
      lucideInfo,
      lucideWand,
      lucideNetwork,
      lucideHardDrive,
    }),
  ],
  template: `
    <!-- Back Button -->
    <div class="mb-6">
      <button
        (click)="navigateBack()"
        class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ng-icon name="lucideArrowLeft" class="h-4 w-4 mr-2" />
        Back to Overview
      </button>
    </div>

    <!-- Wizard Shell -->
    <app-wizard-shell
      [wizardTitle]="'Create Your Cluster'"
      [wizardDescription]="'Set up your cloud cluster in a few simple steps'"
      [steps]="wizardSteps()"
      [currentStepIndex]="currentStepIndex()"
      [createButtonText]="isCreating() ? 'Creating...' : 'Create Cluster'"
      (next)="nextStep()"
      (previous)="previousStep()"
      (cancelled)="navigateBack()"
      (create)="createCluster()"
    >
      <!-- Selection Summary Bar -->
      @if (selectedProvider() || selectedRegion() || selectedServerTypeId()) {
        <div class="flex items-center gap-2 flex-wrap mb-6 px-1 py-2 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground">
          <span class="font-medium text-foreground/60 mr-1">Selected:</span>
          @if (selectedProvider()) {
            <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background border border-border font-medium text-foreground">
              <ng-icon name="lucideSettings" class="h-3 w-3 opacity-60" />
              {{ getSelectedProviderName() }}
            </span>
          }
          @if (selectedRegion()) {
            <span class="text-muted-foreground/40">›</span>
            <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background border border-border font-medium text-foreground">
              <ng-icon name="lucideMapPin" class="h-3 w-3 opacity-60" />
              {{ getSelectedRegionName() }}
            </span>
          }
          @if (selectedServerType()) {
            <span class="text-muted-foreground/40">›</span>
            <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background border border-border font-medium text-foreground">
              <ng-icon name="lucideServer" class="h-3 w-3 opacity-60" />
              {{ selectedServerType()!.name }}
            </span>
            <span class="ml-auto text-muted-foreground">€{{ selectedServerType()!.pricePerHour }}/h</span>
          }
        </div>
      }

      <!-- Step Content -->
      @switch (currentStepIndex()) {
        <!-- Step 0: Infrastructure (Name + Provider + Region) -->
        @case (0) {
          <div class="space-y-8">
            <!-- Cluster Name (compact inline with auto-generate button) -->
            <form [formGroup]="basicConfigForm">
              <div class="flex items-center gap-4">
                <label class="text-sm font-bold w-40 flex-shrink-0">
                  Cluster Name <span class="text-red-500">*</span>
                </label>
                <div class="flex-1 max-w-md">
                  <div class="flex items-center gap-2">
                    <input
                      type="text"
                      formControlName="name"
                      placeholder="workload-cluster-1"
                      class="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    <button
                      type="button"
                      (click)="generateUniqueClusterName()"
                      class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors whitespace-nowrap"
                      title="Auto-generate unique name"
                    >
                      <ng-icon name="lucideWand" class="h-4 w-4" />
                      Generate
                    </button>
                  </div>
                  @if (basicConfigForm.get('name')?.errors && basicConfigForm.get('name')?.touched) {
                    @if (basicConfigForm.get('name')?.errors?.['required']) {
                      <p class="text-sm text-red-500 mt-1">Cluster name is required</p>
                    }
                    @if (basicConfigForm.get('name')?.errors?.['minlength']) {
                      <p class="text-sm text-red-500 mt-1">Cluster name must be at least 3 characters</p>
                    }
                    @if (basicConfigForm.get('name')?.errors?.['nameExists']) {
                      <p class="text-sm text-red-500 mt-1">A cluster with this name already exists. Please choose a different name.</p>
                    }
                  }
                  @if (!basicConfigForm.get('name')?.errors && basicConfigForm.get('name')?.value) {
                    <p class="text-sm text-green-600 mt-1">✓ Name available</p>
                  }
                </div>
              </div>
            </form>

            <!-- Cloud Provider -->
            <div>
              <label class="text-sm font-bold mb-4 block">
                Cloud Provider <span class="text-red-500">*</span>
              </label>
              <div class="max-w-4xl">
                <app-provider-region-selector
                  [currentStep]="1"
                  [selectedProvider]="selectedProvider()"
                  [selectedRegion]="selectedRegion()"
                  [selectedServerTypeId]="selectedServerTypeId()"
                  [lockedProvider]="lockedProvider()"
                  (providerSelected)="onProviderSelected($event)"
                  (regionSelected)="onRegionSelected($event)"
                  (serverTypeSelected)="onServerTypeSelected($event)"
                />
              </div>
            </div>

            <!-- Region (only shown after provider selected) -->
            @if (selectedProvider()) {
              <div>
                <label class="text-sm font-bold mb-4 block">
                  Region <span class="text-red-500">*</span>
                </label>
                <div class="max-w-4xl">
                  <app-provider-region-selector
                    [currentStep]="2"
                    [selectedProvider]="selectedProvider()"
                    [selectedRegion]="selectedRegion()"
                    [selectedServerTypeId]="selectedServerTypeId()"
                    (providerSelected)="onProviderSelected($event)"
                    (regionSelected)="onRegionSelected($event)"
                    (serverTypeSelected)="onServerTypeSelected($event)"
                  />
                </div>
              </div>
            }
          </div>
        }

        <!-- Step 1: Resources (Server Type + Auto-scaling) -->
        @case (1) {
          <div class="space-y-6">
            <!-- Server Type Selection -->
            <app-provider-region-selector
              [currentStep]="3"
              [selectedProvider]="selectedProvider()"
              [selectedRegion]="selectedRegion()"
              [selectedServerTypeId]="selectedServerTypeId()"
              (providerSelected)="onProviderSelected($event)"
              (regionSelected)="onRegionSelected($event)"
              (serverTypeSelected)="onServerTypeSelected($event)"
            />

            <!-- Disk Size (only for network storage types) -->
            @if (needsDiskConfig()) {
              <div class="border-t pt-6">
                <h3 class="font-medium mb-1 flex items-center">
                  <ng-icon name="lucideServer" class="h-5 w-5 mr-2" />
                  Boot Disk Size
                </h3>
                <p class="text-sm text-muted-foreground mb-4">
                  This node type uses network block storage (SBS). Choose the root disk size for each node.
                </p>
                <div class="flex items-center gap-6">
                  <div class="flex items-center gap-3">
                    <input
                      type="range"
                      [min]="5"
                      [max]="500"
                      [step]="5"
                      [value]="diskSizeGb()"
                      (input)="setDiskSizeGb(+$any($event.target).value)"
                      class="w-48 accent-primary"
                    />
                    <div class="flex items-center gap-1 w-28">
                      <input
                        type="number"
                        [min]="5"
                        [max]="500"
                        [value]="diskSizeGb()"
                        (change)="setDiskSizeGb(+$any($event.target).value)"
                        class="flex h-9 w-20 rounded-md border border-input bg-background px-3 py-1 text-sm text-right"
                      />
                      <span class="text-sm text-muted-foreground">GB</span>
                    </div>
                  </div>
                  <div class="text-sm space-y-0.5">
                    <div class="text-muted-foreground">
                      Storage: <span class="font-medium text-foreground">€{{ (selectedServerType()!.blockStoragePricePerGbMonthly! * diskSizeGb()).toFixed(2) }}/mo per node</span>
                    </div>
                    <div class="text-muted-foreground">
                      Total per node: <span class="font-semibold text-foreground">€{{ (totalCostPerNodePerHour()).toFixed(4) }}/h</span>
                      <span class="text-xs ml-1">(~€{{ (totalCostPerNodePerHour() * 730).toFixed(2) }}/mo)</span>
                    </div>
                  </div>
                </div>
                <p class="text-xs text-muted-foreground mt-2">Minimum 5 GB · Maximum 500 GB</p>
              </div>
            }

            <!-- Flui shared storage (NFS+fscache) -->
            <div class="border-t pt-6">
              <h3 class="font-medium mb-1 flex items-center">
                <ng-icon name="lucideHardDrive" class="h-5 w-5 mr-2" />
                Flui shared storage
              </h3>
              <p class="text-sm text-muted-foreground mb-4">
                Pods can move between nodes without losing data. Required for scale-down without
                data loss. Adds a cloud Volume to the master, exported via NFS to the workers
                with fscache. When disabled, PVCs fall back to <span class="font-mono">flui-local</span>
                (per-node bundled disk, not portable).
              </p>
              <div class="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="sharedStorageEnabled"
                  [checked]="sharedStorageEnabled()"
                  (change)="setSharedStorageEnabled($any($event.target).checked)"
                  class="h-4 w-4 rounded border-input"
                />
                <label for="sharedStorageEnabled" class="text-sm font-medium select-none cursor-pointer">
                  Enable flui-shared storage class (recommended)
                </label>
              </div>
              @if (sharedStorageEnabled()) {
                <div class="flex items-center gap-6 ml-6">
                  <div class="flex items-center gap-3">
                    <input
                      type="range"
                      [min]="10"
                      [max]="1000"
                      [step]="10"
                      [value]="sharedStorageVolumeSizeGb()"
                      (input)="setSharedStorageVolumeSizeGb(+$any($event.target).value)"
                      class="w-48 accent-primary"
                    />
                    <div class="flex items-center gap-1 w-28">
                      <input
                        type="number"
                        [min]="10"
                        [max]="1000"
                        [value]="sharedStorageVolumeSizeGb()"
                        (change)="setSharedStorageVolumeSizeGb(+$any($event.target).value)"
                        class="flex h-9 w-20 rounded-md border border-input bg-background px-3 py-1 text-sm text-right"
                      />
                      <span class="text-sm text-muted-foreground">GB</span>
                    </div>
                  </div>
                  <p class="text-xs text-muted-foreground">
                    Master volume size. Holds all flui-shared PVCs and snapshots.
                  </p>
                </div>
              }
            </div>

            <!-- Auto-scaling Configuration -->
            <div class="border-t pt-6">
              <h3 class="font-medium mb-4 flex items-center">
                <ng-icon name="lucideZap" class="h-5 w-5 mr-2" />
                Auto-scaling Configuration
              </h3>

              <div class="space-y-4">
                <div class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="autoScaling"
                    [checked]="autoScalingEnabled()"
                    (change)="toggleAutoScaling()"
                    class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label for="autoScaling" class="text-sm font-medium">
                    Enable Auto-scaling
                  </label>
                </div>

                @if (autoScalingEnabled()) {
                  <div class="grid grid-cols-2 gap-4 pl-6">
                    <div>
                      <label class="text-sm font-medium block mb-2">Minimum Nodes</label>
                      <select
                        [value]="minNodes()"
                        (change)="setMinNodes(+$any($event.target).value)"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        @for (num of [1,2,3]; track num) {
                          <option [value]="num">{{ num }}</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label class="text-sm font-medium block mb-2">Maximum Nodes</label>
                      <select
                        [value]="maxNodes()"
                        (change)="setMaxNodes(+$any($event.target).value)"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        @for (num of [3,5,10,20]; track num) {
                          <option [value]="num">{{ num }}</option>
                        }
                      </select>
                    </div>
                  </div>

                  <!-- Auto-create VNet info banner -->
                  <div class="ml-6 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-3 flex items-start gap-2">
                    <ng-icon name="lucideInfo" class="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p class="text-xs text-blue-900 dark:text-blue-200">
                      A dedicated VNet will be created automatically so future auto-scaled
                      nodes can communicate over a private network. You can still pick an
                      existing VNet in the Network step.
                    </p>
                  </div>

                  <!-- Advanced thresholds (collapsible) -->
                  <div class="pl-6">
                    <button
                      type="button"
                      (click)="advancedThresholdsOpen.set(!advancedThresholdsOpen())"
                      class="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-blue-600"
                    >
                      <ng-icon name="lucideInfo" class="h-3.5 w-3.5" />
                      Advanced thresholds (optional)
                    </button>

                    @if (advancedThresholdsOpen()) {
                      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 p-3 rounded-lg border border-border bg-muted/40">
                        <div>
                          <label class="text-xs font-medium text-sub block mb-1.5">
                            Scale-up memory %
                          </label>
                          <input
                            type="number"
                            min="50"
                            max="95"
                            [value]="scaleUpMemoryPct() ?? ''"
                            (input)="setScaleUpMemoryPct($any($event.target).value)"
                            [placeholder]="(autoscaleDefaults()?.scaleUpMemoryPct ?? 80) + ''"
                            class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                          />
                          <p class="text-xs text-sub mt-1">
                            Default: {{ autoscaleDefaults()?.scaleUpMemoryPct ?? 80 }}%
                          </p>
                        </div>
                        <div>
                          <label class="text-xs font-medium text-sub block mb-1.5">
                            Scale-up CPU %
                          </label>
                          <input
                            type="number"
                            min="50"
                            max="95"
                            [value]="scaleUpCpuPct() ?? ''"
                            (input)="setScaleUpCpuPct($any($event.target).value)"
                            [placeholder]="(autoscaleDefaults()?.scaleUpCpuPct ?? 75) + ''"
                            class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                          />
                          <p class="text-xs text-sub mt-1">
                            Default: {{ autoscaleDefaults()?.scaleUpCpuPct ?? 75 }}%
                          </p>
                        </div>
                        <div>
                          <label class="text-xs font-medium text-sub block mb-1.5">
                            Cooldown (seconds)
                          </label>
                          <input
                            type="number"
                            min="60"
                            max="3600"
                            [value]="cooldownSeconds() ?? ''"
                            (input)="setCooldownSeconds($any($event.target).value)"
                            [placeholder]="(autoscaleDefaults()?.cooldownSeconds ?? 300) + ''"
                            class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                          />
                          <p class="text-xs text-sub mt-1">
                            Default: {{ autoscaleDefaults()?.cooldownSeconds ?? 300 }}s
                          </p>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="pl-6">
                    <div class="w-32">
                      <label class="text-sm font-medium block mb-2">Fixed Nodes</label>
                      <select
                        [value]="fixedNodes()"
                        (change)="setFixedNodes(+$any($event.target).value)"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        @for (num of [1,2,3,5]; track num) {
                          <option [value]="num">{{ num }}</option>
                        }
                      </select>
                    </div>
                  </div>

                  <!-- Single-node warning -->
                  @if (fixedNodes() <= 1) {
                    <div class="ml-6 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 p-3 flex items-start gap-2">
                      <ng-icon name="lucideInfo" class="h-4 w-4 text-yellow-700 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      <p class="text-xs text-yellow-900 dark:text-yellow-200">
                        You're creating a cluster without autoscaling and with a single
                        worker. Under sudden load the cluster won't self-adjust — consider
                        enabling autoscaling, or be ready to add workers manually when
                        warnings appear.
                      </p>
                    </div>
                  }
                }
              </div>
            </div>
          </div>
        }

        <!-- Step 2: SSH Keys -->
        @case (2) {
          <app-ssh-key-selector
            [selectedKeyId]="selectedSshKeyId()"
            (keySelected)="onSshKeySelected($event)"
          />
        }

        <!-- Step 3: Network Configuration (VNet & Subnet) -->
        @case (3) {
          <div class="space-y-6">
            @if (autoScalingEnabled() && !vnetRequired()) {
              <div class="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-3 flex items-start gap-2">
                <ng-icon name="lucideInfo" class="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p class="text-xs text-blue-900 dark:text-blue-200">
                  Autoscaling is enabled — a VNet will be created automatically if you
                  skip this step. Pick an existing VNet only if you need to share the
                  network with other resources.
                </p>
              </div>
            }
            <!-- VNet Selection -->
            <div>
              <app-vnet-selector
                [provider]="selectedProvider()"
                [required]="vnetRequired()"
                [description]="vnetRequired()
                  ? 'This provider requires all cluster nodes to share a private network. Select a VNet and subnet to continue.'
                  : 'Select a VNet and subnet to attach all cluster nodes to a private network. This is optional but recommended for production clusters.'"
                (vnetSelected)="onVNetSelected($event)"
              />
            </div>

            <!-- Subnet Selection (shown when VNet is selected) -->
            @if (selectedVNetId() && selectedVNetData()) {
              <div class="border-t pt-6">
                <div class="mb-4">
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select Subnet <span class="text-red-500">*</span>
                  </label>
                  <p class="text-sm text-slate-500 dark:text-slate-400">
                    Choose which subnet to attach all cluster nodes to.
                  </p>
                </div>

                @if (selectedVNetData()!.subnets.length === 0) {
                  <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div class="flex items-start gap-2">
                      <ng-icon name="lucideInfo" size="18" class="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"></ng-icon>
                      <div class="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>Warning:</strong> This VNet has no subnets. Please add a subnet to the VNet before proceeding, or select a different VNet.
                      </div>
                    </div>
                  </div>
                } @else {
                  <div class="space-y-2">
                    @for (subnet of selectedVNetData()!.subnets; track subnet.id) {
                      <div
                        (click)="selectSubnet(subnet.id)"
                        [class]="getSubnetCardClass(subnet.id)"
                        class="p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-3 flex-1">
                            <div class="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                              <ng-icon name="lucideNetwork" size="20" class="text-slate-600 dark:text-slate-400"></ng-icon>
                            </div>
                            <div class="flex-1">
                              <div class="flex items-center gap-2 mb-1">
                                <span class="font-mono font-semibold text-slate-900 dark:text-white">
                                  {{ subnet.ipRange }}
                                </span>
                              </div>
                              <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                <span>{{ subnet.networkZone }}</span>
                                @if (subnet.gateway) {
                                  <span>Gateway: {{ subnet.gateway }}</span>
                                }
                                <span>{{ subnet.attachedServerIds.length }} server(s) attached</span>
                              </div>
                            </div>
                          </div>
                          <ng-icon
                            *ngIf="selectedSubnetId() === subnet.id"
                            name="lucideCheck"
                            size="24"
                            class="text-blue-600 dark:text-blue-400 ml-2"
                          ></ng-icon>
                        </div>
                      </div>
                    }
                  </div>
                }

                @if (selectedSubnetId()) {
                  <div class="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div class="flex items-start gap-2">
                      <ng-icon name="lucideInfo" size="18" class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"></ng-icon>
                      <div class="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Note:</strong> All cluster nodes will be automatically attached to this subnet during cluster creation.
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Step 4: Endpoint hostname source -->
        @case (4) {
          <div class="space-y-6">
            <div>
              <h3 class="text-lg font-semibold">How will your apps be reached?</h3>
              <p class="text-sm text-muted-foreground">
                Pick the default for this cluster. You can always change it per app later.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              <button
                type="button"
                (click)="endpointHostnameMode.set('ip')"
                [class]="endpointModeCardClass(endpointHostnameMode() === 'ip')"
              >
                <div class="flex items-center gap-2">
                  <ng-icon name="lucideZap" class="h-5 w-5 text-primary" />
                  <span class="font-medium">Test addresses</span>
                </div>
                <p class="mt-2 text-xs text-muted-foreground">
                  Each app gets an instant address derived from your cluster IP.
                  Great for testing or demos — no DNS setup needed.
                </p>
                <p class="mt-2 text-[11px] text-muted-foreground">
                  Includes a free Let's Encrypt certificate.
                </p>
              </button>

              <button
                type="button"
                (click)="endpointHostnameMode.set('domain')"
                [class]="endpointModeCardClass(endpointHostnameMode() === 'domain')"
              >
                <div class="flex items-center gap-2">
                  <ng-icon name="lucideNetwork" class="h-5 w-5 text-primary" />
                  <span class="font-medium">Custom domains</span>
                </div>
                <p class="mt-2 text-xs text-muted-foreground">
                  Use domains you own (e.g. <code class="font-mono">example.com</code>).
                  You'll connect your DNS provider after the cluster is ready.
                </p>
                <p class="mt-2 text-[11px] text-muted-foreground">
                  Optional wildcard certificate covering all subdomains.
                </p>
              </button>
            </div>

            @if (endpointHostnameMode() === 'domain') {
              <div class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg max-w-3xl">
                <div class="flex items-start gap-2">
                  <ng-icon name="lucideInfo" class="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p class="text-xs text-amber-800 dark:text-amber-300">
                    Until you connect a domain, apps will be reachable on test addresses.
                    Built-in services (auth, web, monitoring) currently always use test addresses.
                  </p>
                </div>
              </div>
            }
          </div>
        }

        <!-- Step 5: Firewall Configuration -->
        @case (5) {
          <div class="space-y-6">
            <!-- Header with toggle -->
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-semibold">Firewall Configuration</h3>
                <p class="text-sm text-muted-foreground">
                  Configure source IP restrictions for inbound traffic
                </p>
              </div>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  [formControl]="$any(firewallConfigForm.get('enabled'))"
                  class="w-4 h-4 rounded border-gray-300"
                />
                <span class="text-sm font-medium">Enable custom firewall rules</span>
              </label>
            </div>

            @if (firewallConfigForm.get('enabled')?.value) {
              <!-- Firewall Rules Configuration -->
              <div class="p-4 rounded-lg border bg-card">
                <!-- Info Alert -->
                <div class="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-4">
                  <ng-icon name="lucideInfo" class="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p class="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Workload Cluster:</strong> Pre-configured with default firewall rules for K3s.
                    SSH port 22 has been pre-populated with your public IP for security.
                    You can modify any IP addresses or add additional rules as needed.
                  </p>
                </div>

                <!-- Firewall Rules -->
                <div class="space-y-3">
                  <h5 class="font-medium text-sm">Inbound Rules</h5>

                  <div
                    *ngFor="let ruleControl of getFirewallRulesArray().controls; let i = index"
                    [formGroup]="$any(ruleControl)"
                    class="p-4 rounded-lg border bg-muted/30 space-y-3"
                  >
                    <!-- Rule Header -->
                    <div class="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span class="text-muted-foreground">Description:</span>
                        <span class="ml-2 font-medium">{{ ruleControl.get('description')?.value }}</span>
                      </div>
                      <div>
                        <span class="text-muted-foreground">Protocol:</span>
                        <span class="ml-2 font-medium uppercase">{{ ruleControl.get('protocol')?.value }}</span>
                      </div>
                      <div>
                        <span class="text-muted-foreground">Port:</span>
                        <span class="ml-2 font-medium">{{ ruleControl.get('port')?.value }}</span>
                      </div>
                      <div>
                        <span class="text-muted-foreground">Direction:</span>
                        <span class="ml-2 font-medium uppercase">{{ ruleControl.get('direction')?.value }}</span>
                      </div>
                    </div>

                    <!-- Source IPs Field -->
                    <div>
                      <div class="flex items-center justify-between mb-2">
                        <label class="text-sm font-medium">
                          Source CIDRs <span class="text-red-500">*</span>
                        </label>
                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            class="text-xs text-blue-600 hover:underline"
                            (click)="resetRuleIPs(i)"
                          >
                            Reset to defaults
                          </button>
                          <button
                            type="button"
                            hlmBtn
                            variant="ghost"
                            size="sm"
                            (click)="detectAndSetIP(i)"
                            [disabled]="ipDetectionService.isDetecting()"
                            class="gap-2 text-xs"
                          >
                            <ng-icon
                              name="lucideRefreshCw"
                              [class]="ipDetectionService.isDetecting() ? 'w-3 h-3 animate-spin' : 'w-3 h-3'"
                            />
                            Detect My IP
                          </button>
                        </div>
                      </div>

                      <textarea
                        formControlName="sourceIps"
                        rows="2"
                        placeholder="203.0.113.0/24, 198.51.100.42/32"
                        class="w-full rounded-md border px-3 py-2 text-sm font-mono resize-none"
                        [class.border-destructive]="ruleControl.get('sourceIps')?.invalid && ruleControl.get('sourceIps')?.touched"
                      ></textarea>

                      <p class="text-xs text-muted-foreground mt-1">
                        Comma-separated CIDR ranges (e.g., 192.168.1.0/24, 10.0.0.5/32)
                      </p>

                      @if (ruleControl.get('sourceIps')?.errors?.['required'] && ruleControl.get('sourceIps')?.touched) {
                        <p class="text-xs text-destructive mt-1">
                          Source CIDRs are required
                        </p>
                      }

                      @if (ruleControl.get('sourceIps')?.errors?.['invalidCidrs']) {
                        <p class="text-xs text-destructive mt-1">
                          Invalid CIDR format: {{ ruleControl.get('sourceIps')?.errors?.['invalidCidrs'].join(', ') }}
                          (must include /32 for single IP or /24 for subnet)
                        </p>
                      }

                      @if (ipDetectionService.userPublicIP() && ruleControl.get('port')?.value === '22') {
                        <p class="text-xs text-blue-600 mt-1">
                          Your detected IP: {{ ipDetectionService.userPublicIP() }}
                        </p>
                      }
                    </div>
                  </div>
                </div>
              </div>
            } @else {
              <div class="p-6 rounded-lg border bg-muted/30 text-center">
                <p class="text-sm text-muted-foreground">
                  Custom firewall rules disabled. Default system templates will be applied based on cluster type.
                </p>
              </div>
            }
          </div>
        }

        <!-- Step 6: Review & Create -->
        @case (6) {
          <div class="space-y-6">
            <h3 class="font-medium mb-4">Review Configuration</h3>

            <div class="space-y-4">
              <!-- Basic Info -->
              <div class="border border-border rounded-lg p-4">
                <h4 class="font-medium mb-3">Basic Configuration</h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span class="text-muted-foreground">Cluster Name:</span>
                    <div class="font-medium">{{ getClusterName() }}</div>
                  </div>
                  <div>
                    <span class="text-muted-foreground">Provider:</span>
                    <div class="font-medium">{{ getSelectedProviderName() }}</div>
                  </div>
                  <div>
                    <span class="text-muted-foreground">Region:</span>
                    <div class="font-medium">{{ getSelectedRegionName() }}</div>
                  </div>
                </div>
              </div>

              <!-- Node Configuration -->
              <div class="border border-border rounded-lg p-4">
                <h4 class="font-medium mb-3">Node Configuration</h4>
                @if (getSelectedServerType(); as serverType) {
                  <div class="space-y-3">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="font-medium mb-1">{{ serverType.name }}</div>
                        <div class="text-sm text-muted-foreground space-y-1">
                          <div>{{ serverType.vcpu }} vCPU • {{ serverType.ram }}GB RAM • {{ serverType.disk }}GB Storage</div>
                        </div>
                        <div class="flex items-center gap-2 mt-2">
                          <span [class]="serverType.cpuType === 'dedicated'
                            ? 'text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 px-2 py-1 rounded'
                            : 'text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-1 rounded'">
                            {{ serverType.cpuType === 'dedicated' ? 'Dedicated CPU' : 'Shared CPU' }}
                          </span>
                          <span class="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 px-2 py-1 rounded">
                            {{ serverType.architecture === 'x86' ? 'x86' : 'ARM' }}
                          </span>
                        </div>
                      </div>
                      <div class="text-right ml-4">
                        <div class="text-sm font-medium">€{{ serverType.pricePerHour }}/hour</div>
                        <div class="text-xs text-muted-foreground">~€{{ pricingService.calculateMonthlyPriceRounded(serverType.pricePerHour) }}/month</div>
                      </div>
                    </div>
                  </div>
                }
              </div>

              <!-- Scaling Configuration -->
              <div class="border border-border rounded-lg p-4">
                <h4 class="font-medium mb-3">Scaling Configuration</h4>
                <div class="space-y-3 text-sm">
                  <div class="flex items-center justify-between">
                    <span class="text-muted-foreground">Auto-scaling:</span>
                    <span class="font-medium">{{ autoScalingEnabled() ? 'Enabled' : 'Disabled' }}</span>
                  </div>
                  @if (autoScalingEnabled()) {
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Minimum nodes:</span>
                      <span class="font-medium">{{ minNodes() }}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Maximum nodes:</span>
                      <span class="font-medium">{{ maxNodes() }}</span>
                    </div>
                  } @else {
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Fixed nodes:</span>
                      <span class="font-medium">{{ fixedNodes() }}</span>
                    </div>
                  }
                </div>
              </div>

              <!-- SSH Keys Configuration -->
              <div class="border border-border rounded-lg p-4">
                <h4 class="font-medium mb-3 flex items-center">
                  <ng-icon name="lucideKey" class="h-4 w-4 mr-2" />
                  SSH Keys
                </h4>
                @if (selectedSshKeyId()) {
                  @if (getSshKeyById(selectedSshKeyId()!); as key) {
                    <div class="text-sm flex items-center">
                      <ng-icon name="lucideKey" class="h-4 w-4 mr-2 text-muted-foreground" />
                      <div class="flex-1">
                        <span class="font-medium">{{ key.name }}</span>
                        <span class="text-xs text-muted-foreground ml-2">({{ key.type }})</span>
                      </div>
                    </div>
                  }
                } @else {
                  <p class="text-sm text-muted-foreground">No SSH key selected</p>
                }
              </div>

              <!-- VNet Configuration Summary -->
              @if (selectedVNetId() && selectedSubnetId()) {
                <div class="border border-border rounded-lg p-4">
                  <h4 class="font-medium mb-3 flex items-center">
                    <ng-icon name="lucideNetwork" class="h-4 w-4 mr-2" />
                    Network Configuration
                  </h4>
                  <div class="text-sm space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">VNet:</span>
                      <span class="font-medium">{{ selectedVNetData()?.name || 'N/A' }}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">VNet IP Range:</span>
                      <span class="font-mono text-sm font-medium">{{ selectedVNetData()?.ipRange || 'N/A' }}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Subnet:</span>
                      <span class="font-mono text-sm font-medium">{{ getSelectedSubnet()?.ipRange || 'N/A' }}</span>
                    </div>
                  </div>
                </div>
              }

              <!-- Endpoint Hostname Source Summary -->
              <div class="border border-border rounded-lg p-4">
                <h4 class="font-medium mb-3 flex items-center">
                  <ng-icon name="lucideZap" class="h-4 w-4 mr-2" />
                  Public addresses
                </h4>
                <div class="text-sm flex items-center justify-between">
                  <span class="text-muted-foreground">Default for this cluster:</span>
                  <span class="font-medium">
                    @if (endpointHostnameMode() === 'ip') {
                      Test addresses
                    } @else {
                      Custom domains
                    }
                  </span>
                </div>
                @if (endpointHostnameMode() === 'domain') {
                  <p class="text-xs text-muted-foreground mt-2">
                    Connect a domain to the cluster after creation to start using it.
                  </p>
                }
              </div>

              <!-- Firewall Configuration Summary -->
              <div class="border border-border rounded-lg p-4">
                <h4 class="font-medium mb-3 flex items-center">
                  <ng-icon name="lucideShield" class="h-4 w-4 mr-2" />
                  Firewall Configuration
                </h4>
                @if (firewallConfigForm.get('enabled')?.value) {
                  <div class="text-sm space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Cluster Type:</span>
                      <span class="font-medium">Workload (K3s)</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Total rules:</span>
                      <span class="font-medium">{{ getFirewallRulesArray().length }}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Custom Source CIDRs:</span>
                      <span class="font-medium">{{ getTotalCustomCIDRs() }} configured</span>
                    </div>
                  </div>
                } @else {
                  <p class="text-sm text-muted-foreground">
                    Firewall disabled - cluster will be created without firewall protection
                  </p>
                }
              </div>

              <!-- Cost Estimation -->
              <div class="border border-border rounded-lg p-4 bg-green-50 dark:bg-green-900/10">
                <h4 class="font-medium mb-3 flex items-center">
                  <ng-icon name="lucideEuro" class="h-4 w-4 mr-2 text-green-600" />
                  Cost Estimation
                </h4>
                <div class="space-y-3 text-sm">
                  @if (autoScalingEnabled()) {
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Minimum cost ({{ minNodes() }} node{{ minNodes() > 1 ? 's' : '' }}):</span>
                      <span class="font-medium text-green-700 dark:text-green-400">€{{ getEstimatedMonthlyCost() }}/month</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Maximum cost ({{ maxNodes() }} nodes):</span>
                      <span class="font-medium text-green-700 dark:text-green-400">€{{ getMaxMonthlyCost() }}/month</span>
                    </div>
                  } @else {
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Monthly cost ({{ fixedNodes() }} node{{ fixedNodes() > 1 ? 's' : '' }}):</span>
                      <span class="font-medium text-green-700 dark:text-green-400">€{{ getEstimatedMonthlyCost() }}/month</span>
                    </div>
                  }
                </div>
                <p class="text-xs text-green-600 dark:text-green-400 mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                  * Estimates based on 24/7 usage. Actual costs may vary.
                </p>
              </div>
            </div>
          </div>
        }
      }
    </app-wizard-shell>
  `,
  styles: [`
    /* Hide duplicate labels from provider-region-selector component */
    app-provider-region-selector ::ng-deep .mb-4 label {
      display: none;
    }
    app-provider-region-selector ::ng-deep .mb-4 p {
      display: none;
    }
  `]
})
export class ClusterCreationWizardComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly clusterService = inject(ClusterService);
  private readonly autoscaleService = inject(ClusterAutoscaleService);
  private readonly wizardService = inject(ProviderWizardService);
  private readonly accessManagementService = inject(AccessManagementService);
  private readonly router = inject(Router);
  public pricingService = inject(PricingService);
  readonly ipDetectionService = inject(IpDetectionService);

  completeOutput = output<{ success: boolean; cluster?: any; error?: string }>();
  cancelled = output<void>();

  // Form state
  basicConfigForm!: FormGroup;
  firewallConfigForm!: FormGroup;
  formValid = signal<boolean>(false);
  currentStepIndex = signal<number>(0);
  isCreating = signal<boolean>(false);

  // Selected values
  selectedProvider = signal<string>('');
  selectedRegion = signal<string>('');
  selectedServerTypeId = signal<string>('');
  selectedSshKeyId = signal<string | undefined>(undefined);
  selectedVNetId = signal<string | null>(null);
  selectedSubnetId = signal<string | null>(null);
  selectedVNetData = signal<VNetInfo | null>(null);

  // Scaling configuration
  autoScalingEnabled = signal<boolean>(false);
  minNodes = signal<number>(1);
  maxNodes = signal<number>(3);
  fixedNodes = signal<number>(1);

  // Advanced autoscale thresholds (optional overrides — fall back to defaults server-side)
  scaleUpMemoryPct = signal<number | null>(null);
  scaleUpCpuPct = signal<number | null>(null);
  cooldownSeconds = signal<number | null>(null);
  advancedThresholdsOpen = signal<boolean>(false);
  autoscaleDefaults = signal<AutoscaleDefaults | null>(null);

  // Disk size (only for network storage types)
  diskSizeGb = signal<number>(20);

  // Flui shared storage (NFS+fscache, see VOLUME_MANAGEMENT_FRONTEND_GUIDE.md)
  sharedStorageEnabled = signal<boolean>(true);
  sharedStorageVolumeSizeGb = signal<number>(20);

  // Endpoint hostname source (cluster default for app endpoints + system services)
  endpointHostnameMode = signal<'ip' | 'domain'>('ip');

  endpointModeCardClass(active: boolean): string {
    const base = 'flex flex-col items-start rounded-lg border p-4 text-left transition w-full hover:bg-accent/40';
    return active
      ? `${base} border-primary bg-primary/5`
      : `${base} border-border`;
  }

  // Computed: selected server type object
  readonly selectedServerType = computed(() => {
    const cacheKey = `${this.selectedProvider()}:${this.selectedRegion()}`;
    const serverTypes = this.wizardService.serverTypesData()[cacheKey] || [];
    return serverTypes.find(st => st.id === this.selectedServerTypeId()) ?? null;
  });

  // Computed: whether current node type needs network storage config
  readonly needsDiskConfig = computed(() => this.selectedServerType()?.storageType === 'network');

  // Computed: storage cost per hour (€/GB/month ÷ 730 hours × diskSizeGb)
  readonly storageCostPerHour = computed(() => {
    const serverType = this.selectedServerType();
    if (!serverType?.blockStoragePricePerGbMonthly) return 0;
    return (serverType.blockStoragePricePerGbMonthly * this.diskSizeGb()) / 730;
  });

  // Computed: total cost per node per hour (compute + storage)
  readonly totalCostPerNodePerHour = computed(() => {
    const serverType = this.selectedServerType();
    if (!serverType) return 0;
    return serverType.pricePerHour + this.storageCostPerHour();
  });

  readonly controlClusterProvider = computed<string | null>(() => {
    const observability = this.clusterService
      .clusters()
      .find(c => isControlClusterType(c.clusterType));
    return observability?.provider ?? null;
  });

  readonly lockedProvider = computed<string | null>(() => {
    const control = this.controlClusterProvider();
    if (!control) return null;
    const crossAllowed =
      this.wizardService.getProviderDefinition(control)?.capabilities?.crossClusterAllowed ?? false;
    return crossAllowed ? null : control;
  });

  readonly vnetRequired = computed<boolean>(() => {
    const provider = this.selectedProvider();
    if (!provider) return false;
    return this.wizardService.getProviderDefinition(provider)?.capabilities?.vnetRequired ?? false;
  });

  constructor() {
    effect(() => {
      const locked = this.lockedProvider();
      if (locked && this.selectedProvider() !== locked) {
        untracked(() => this.onProviderSelected(locked));
      }
    });
  }

  // Wizard steps - Consolidated (6 steps total)
  readonly wizardSteps = computed<WizardStep[]>(() => {
    const currentIndex = this.currentStepIndex();

    return [
      {
        id: 'infrastructure',
        title: 'Infrastructure',
        description: 'Configure name, provider and region',
        icon: 'lucideSettings',
        isValid: this.formValid() && !!this.selectedProvider() && !!this.selectedRegion(),
        isCompleted: currentIndex > 0 && this.formValid() && !!this.selectedProvider() && !!this.selectedRegion(),
      },
      {
        id: 'resources',
        title: 'Resources',
        description: 'Configure node size and scaling',
        icon: 'lucideServer',
        isValid: !!this.selectedServerTypeId(),
        isCompleted: currentIndex > 1 && !!this.selectedServerTypeId(),
      },
      {
        id: 'ssh-keys',
        title: 'SSH Keys',
        description: 'Configure secure access',
        icon: 'lucideKey',
        isValid: true, // Optional step
        isCompleted: currentIndex > 2,
      },
      {
        id: 'network',
        title: 'Network',
        description: this.vnetRequired() ? 'Configure virtual network' : 'Configure virtual network (optional)',
        icon: 'lucideNetwork',
        isValid: this.vnetRequired()
          ? (!!this.selectedVNetId() && !!this.selectedSubnetId())
          : (this.selectedVNetId() ? !!this.selectedSubnetId() : true),
        isCompleted: currentIndex > 3,
      },
      {
        id: 'endpoint',
        title: 'Endpoint',
        description: 'Choose hostname source (nip.io vs domain)',
        icon: 'lucideZap',
        isValid: !!this.endpointHostnameMode(),
        isCompleted: currentIndex > 4,
      },
      {
        id: 'firewall',
        title: 'Firewall',
        description: 'Configure firewall rules and source IPs',
        icon: 'lucideShield',
        isValid: this.firewallConfigForm?.valid ?? true, // Optional step with validation
        isCompleted: currentIndex > 5,
      },
      {
        id: 'review',
        title: 'Review & Create',
        description: 'Review and create cluster',
        icon: 'lucideCheck',
        isValid: this.canComplete(),
        isCompleted: false,
      },
    ];
  });

  ngOnInit(): void {
    void (async () => {
      this.initializeForm();
      await this.initializeFirewall();
  
      // Load autoscale defaults (used as placeholders + min/max defaults)
      try {
        const defs = await this.autoscaleService.loadDefaults();
        this.autoscaleDefaults.set(defs);
        if (defs.defaultMinNodes) this.minNodes.set(defs.defaultMinNodes);
        if (defs.defaultMaxNodes) this.maxNodes.set(defs.defaultMaxNodes);
      } catch {
        // autoscale defaults unavailable — form uses manual inputs
      }
  
      await Promise.all([
        this.clusterService.loadClusters(),
        this.wizardService.loadProviders(),
      ]);
  
      // Track form validity changes with signal
      this.basicConfigForm.statusChanges.subscribe(() => {
        this.formValid.set(this.basicConfigForm.valid);
      });
  
      // Set initial value
      this.formValid.set(this.basicConfigForm.valid);
    })();
  }

  private initializeForm(): void {
    this.basicConfigForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)], [this.clusterNameAsyncValidator()]],
    });

    // Initialize firewall form
    this.firewallConfigForm = this.fb.group({
      enabled: [true],
      rules: this.fb.array([]),
    });
  }

  /**
   * Generate a unique cluster name by checking against existing clusters.
   * Pattern: workload-cluster-1, workload-cluster-2, workload-cluster-3, etc.
   * Called when user clicks the "Auto-generate Name" button.
   */
  generateUniqueClusterName(): void {
    const existingClusters = this.clusterService.clusters();
    const existingNames = new Set(existingClusters.map((c) => c.name?.toLowerCase() || ''));

    let counter = 1;
    let suggestedName = `workload-cluster-${counter}`;

    while (existingNames.has(suggestedName.toLowerCase())) {
      counter++;
      suggestedName = `workload-cluster-${counter}`;
    }

    // Set the generated name in the form
    this.basicConfigForm.patchValue({ name: suggestedName });
  }

  /**
   * Async validator to ensure cluster name is unique.
   * Checks against existing cluster names in real-time.
   */
  private clusterNameAsyncValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Promise<ValidationErrors | null> => {
      return new Promise((resolve) => {
        if (!control.value) {
          resolve(null);
          return;
        }

        const existingClusters = this.clusterService.clusters();
        const existingNames = existingClusters.map((c) => c.name?.toLowerCase() || '');
        const inputName = control.value.toLowerCase();

        if (existingNames.includes(inputName)) {
          resolve({ nameExists: true });
        } else {
          resolve(null);
        }
      });
    };
  }

  private async initializeFirewall(): Promise<void> {
    try {
      // Get default rules for WORKLOAD cluster type
      const defaultRules = getDefaultRulesForClusterType(ClusterType.WORKLOAD);

      // Detect user's public IP for SSH rule
      const userIP = await this.ipDetectionService.detectPublicIP();

      const rulesArray = this.getFirewallRulesArray();

      // Populate FormArray with default rules
      for (const rule of defaultRules) {
        // For SSH rule, use only detected IP (no fallback to 0.0.0.0/0)
        const isSSH = rule.port === '22' && rule.direction === 'in';
        const sourceIps = isSSH && userIP
          ? [`${userIP}/32`]  // Add /32 CIDR suffix to detected IP
          : (rule.sourceIps || []);

        // For outbound rules, ensure destinationIps has default value
        let destinationIps: string[];
        if (rule.destinationIps && rule.destinationIps.length > 0) destinationIps = rule.destinationIps;
        else if (rule.direction === 'out') destinationIps = ['0.0.0.0/0'];
        else destinationIps = [];

        const ruleFormGroup = this.fb.group({
          description: [rule.description, Validators.required],
          direction: [rule.direction, Validators.required],
          protocol: [rule.protocol, Validators.required],
          port: [rule.port || ''],
          sourceIps: [
            sourceIps.join(', '),
            rule.direction === 'in' ? [Validators.required, cidrListValidator()] : []
          ],
          destinationIps: [
            destinationIps.join(', '),
            rule.direction === 'out' ? [Validators.required, cidrListValidator()] : []
          ],
          originalSourceIps: [sourceIps.join(', ')], // For reset functionality
        });

        rulesArray.push(ruleFormGroup);
      }
    } catch (error) {
      console.error('Failed to initialize firewall rules:', error);
      // Non-blocking: user can still create cluster without custom firewall
    }
  }

  // Event handlers
  onProviderSelected(providerId: string): void {
    this.selectedProvider.set(providerId);
    this.selectedRegion.set('');
    this.selectedServerTypeId.set('');
  }

  onRegionSelected(regionId: string): void {
    this.selectedRegion.set(regionId);
    this.selectedServerTypeId.set('');
  }

  onServerTypeSelected(serverTypeId: string): void {
    this.selectedServerTypeId.set(serverTypeId);
  }

  onSshKeySelected(keyId: string | undefined): void {
    this.selectedSshKeyId.set(keyId);
  }

  onVNetSelected(vnet: VNetInfo | null): void {
    if (vnet) {
      this.selectedVNetId.set(vnet.id);
      this.selectedVNetData.set(vnet);
      // Reset subnet selection when VNet changes
      this.selectedSubnetId.set(null);
    } else {
      this.selectedVNetId.set(null);
      this.selectedVNetData.set(null);
      this.selectedSubnetId.set(null);
    }
  }

  selectSubnet(subnetId: string): void {
    this.selectedSubnetId.set(subnetId);
  }

  getSubnetCardClass(subnetId: string): string {
    const isSelected = this.selectedSubnetId() === subnetId;
    return isSelected
      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
      : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600';
  }

  getSelectedSubnet() {
    const vnetData = this.selectedVNetData();
    const subnetId = this.selectedSubnetId();
    if (!vnetData || !subnetId) return null;
    return vnetData.subnets.find(s => s.id === subnetId);
  }

  // Navigation
  nextStep(): void {
    if (this.canProceedFromCurrentStep()) {
      this.currentStepIndex.update(index => Math.min(index + 1, this.wizardSteps().length - 1));
    }
  }

  previousStep(): void {
    this.currentStepIndex.update(index => Math.max(index - 1, 0));
  }

  navigateBack(): void {
    this.router.navigate(['/cluster']);
  }

  // Validation
  canProceedFromCurrentStep(): boolean {
    const step = this.wizardSteps()[this.currentStepIndex()];
    return step?.isValid || false;
  }

  canComplete(): boolean {
    const vnetOk = !this.vnetRequired() || (!!this.selectedVNetId() && !!this.selectedSubnetId());
    return (
      this.basicConfigForm.valid &&
      !!this.selectedProvider() &&
      !!this.selectedRegion() &&
      !!this.selectedServerTypeId() &&
      vnetOk
    );
  }

  // Scaling configuration
  toggleAutoScaling(): void {
    this.autoScalingEnabled.update(enabled => !enabled);
  }

  setMinNodes(count: number): void {
    this.minNodes.set(count);
  }

  setMaxNodes(count: number): void {
    this.maxNodes.set(count);
  }

  setFixedNodes(count: number): void {
    this.fixedNodes.set(count);
  }

  setScaleUpMemoryPct(value: string): void {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      this.scaleUpMemoryPct.set(null);
      return;
    }
    const n = Number(trimmed);
    this.scaleUpMemoryPct.set(Number.isFinite(n) ? n : null);
  }

  setScaleUpCpuPct(value: string): void {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      this.scaleUpCpuPct.set(null);
      return;
    }
    const n = Number(trimmed);
    this.scaleUpCpuPct.set(Number.isFinite(n) ? n : null);
  }

  setCooldownSeconds(value: string): void {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      this.cooldownSeconds.set(null);
      return;
    }
    const n = Number(trimmed);
    this.cooldownSeconds.set(Number.isFinite(n) ? n : null);
  }

  setDiskSizeGb(value: number): void {
    this.diskSizeGb.set(Math.min(500, Math.max(5, value || 5)));
  }

  setSharedStorageEnabled(enabled: boolean): void {
    this.sharedStorageEnabled.set(enabled);
  }

  setSharedStorageVolumeSizeGb(value: number): void {
    this.sharedStorageVolumeSizeGb.set(Math.min(1000, Math.max(10, value || 10)));
  }

  // Helper methods
  getClusterName(): string {
    return this.basicConfigForm.get('name')?.value || '';
  }

  getSelectedProviderName(): string {
    const provider = this.wizardService.providersData().find(p => p.id === this.selectedProvider());
    return provider?.name || '';
  }

  getSelectedRegionName(): string {
    const regions = this.wizardService.regionsData()[this.selectedProvider()] || [];
    const region = regions.find(r => r.id === this.selectedRegion());
    return region?.name || '';
  }

  getSelectedServerType(): NodeSizeOption | undefined {
    const cacheKey = `${this.selectedProvider()}:${this.selectedRegion()}`;
    const serverTypes = this.wizardService.serverTypesData()[cacheKey] || [];
    return serverTypes.find(st => st.id === this.selectedServerTypeId());
  }

  getEstimatedMonthlyCost(): string {
    const serverType = this.getSelectedServerType();
    if (!serverType) return '0.00';

    const nodes = this.autoScalingEnabled() ? this.minNodes() : this.fixedNodes();
    return this.pricingService.formatClusterMonthlyCost(serverType.pricePerHour, nodes);
  }

  getMaxMonthlyCost(): string {
    const serverType = this.getSelectedServerType();
    if (!serverType) return '0.00';

    const nodes = this.autoScalingEnabled() ? this.maxNodes() : this.fixedNodes();
    return this.pricingService.formatClusterMonthlyCost(serverType.pricePerHour, nodes);
  }

  getSshKeyById(keyId: string) {
    return this.wizardService.sshKeysData().find(key => key.id === keyId);
  }

  // Firewall helper methods
  getFirewallRulesArray(): FormArray {
    return this.firewallConfigForm.get('rules') as FormArray;
  }

  async detectAndSetIP(ruleIndex: number): Promise<void> {
    const ip = await this.ipDetectionService.detectPublicIP(true); // Force refresh
    if (ip) {
      const ruleControl = this.getFirewallRulesArray().at(ruleIndex);
      const currentValue = ruleControl.get('sourceIps')?.value || '';
      const ipWithCidr = `${ip}/32`;

      if (currentValue.trim()) {
        const cidrs = currentValue.split(',').map((c: string) => c.trim());
        if (!cidrs.includes(ipWithCidr)) {
          ruleControl.patchValue({
            sourceIps: `${currentValue}, ${ipWithCidr}`,
          });
        }
      } else {
        ruleControl.patchValue({ sourceIps: ipWithCidr });
      }
    }
  }

  resetRuleIPs(ruleIndex: number): void {
    const ruleControl = this.getFirewallRulesArray().at(ruleIndex);
    const originalIPs = ruleControl.get('originalSourceIps')?.value;
    ruleControl.patchValue({ sourceIps: originalIPs });
  }

  getTotalCustomCIDRs(): number {
    if (!this.firewallConfigForm.get('enabled')?.value) {
      return 0;
    }

    const rules = this.getFirewallRulesArray();
    const allCidrs: string[] = [];

    rules.controls.forEach((ruleControl) => {
      const ips = ruleControl.get('sourceIps')?.value;
      if (ips) {
        const cidrs = ips
          .split(',')
          .map((c: string) => c.trim())
          .filter(Boolean);
        allCidrs.push(...cidrs);
      }
    });

    // Return unique count
    return new Set(allCidrs).size;
  }

  /**
   * Build firewall rules array for CreateClusterDto
   * Validates CIDR and ensures at least one inbound rule
   */
  buildFirewallRules(): Array<{
    description: string;
    direction: 'in' | 'out';
    protocol: 'tcp' | 'udp' | 'icmp';
    port?: string;
    sourceIps?: string[];
    destinationIps?: string[];
  }> | undefined {
    if (!this.firewallConfigForm.get('enabled')?.value) {
      return undefined; // Backend will create deny-all firewall
    }

    const rulesArray = this.getFirewallRulesArray();
    const rules: Array<{
      description: string;
      direction: 'in' | 'out';
      protocol: 'tcp' | 'udp' | 'icmp';
      port?: string;
      sourceIps?: string[];
      destinationIps?: string[];
    }> = [];

    let hasInboundRule = false;

    for (const ruleControl of rulesArray.controls) {
      const description = ruleControl.get('description')?.value;
      const direction = ruleControl.get('direction')?.value as 'in' | 'out';
      const protocol = ruleControl.get('protocol')?.value as 'tcp' | 'udp' | 'icmp';
      const port = ruleControl.get('port')?.value;
      const sourceIpsStr = ruleControl.get('sourceIps')?.value || '';
      const destinationIpsStr = ruleControl.get('destinationIps')?.value || '';

      // Track inbound rules
      if (direction === 'in') {
        hasInboundRule = true;
      }

      // Parse and validate CIDRs
      const sourceIps = sourceIpsStr
        .split(',')
        .map((c: string) => c.trim())
        .filter((c: string) => c && isValidCidr(c));

      const destinationIps = destinationIpsStr
        .split(',')
        .map((c: string) => c.trim())
        .filter((c: string) => c && isValidCidr(c));

      // Build rule object based on direction
      const rule: {
        description: string;
        direction: 'in' | 'out';
        protocol: 'tcp' | 'udp' | 'icmp';
        port?: string;
        sourceIps?: string[];
        destinationIps?: string[];
      } = {
        description,
        direction,
        protocol,
        port: port || undefined,
      };

      // For inbound rules, use validated sourceIps
      if (direction === 'in') {
        rule.sourceIps = sourceIps;
      }

      // For outbound rules, use validated destinationIps
      if (direction === 'out') {
        rule.destinationIps = destinationIps;
      }

      rules.push(rule);
    }

    // Validation: at least one inbound rule required
    if (!hasInboundRule) {
      throw new Error('At least one inbound firewall rule is required (e.g., SSH)');
    }

    return rules;
  }

  // Main action
  async createCluster(): Promise<void> {
    if (!this.canComplete()) return;

    const serverType = this.getSelectedServerType();
    if (!serverType) return;

    this.isCreating.set(true);

    try {
      const configuration: ClusterConfiguration = {
        name: this.basicConfigForm.get('name')?.value || '',
        provider: this.selectedProvider() as ProviderType,
        region: this.selectedRegion(),
        nodeTypeId: serverType.id,
        minNodes: this.autoScalingEnabled() ? this.minNodes() : this.fixedNodes(),
        maxNodes: this.autoScalingEnabled() ? this.maxNodes() : this.fixedNodes(),
        autoScalingEnabled: this.autoScalingEnabled(),
        scaleUpMemoryPct: this.autoScalingEnabled() ? this.scaleUpMemoryPct() ?? undefined : undefined,
        scaleUpCpuPct: this.autoScalingEnabled() ? this.scaleUpCpuPct() ?? undefined : undefined,
        cooldownSeconds: this.autoScalingEnabled() ? this.cooldownSeconds() ?? undefined : undefined,
        sshKeys: this.selectedSshKeyId() ? [this.selectedSshKeyId()!] : [],
        diskSizeGb: this.needsDiskConfig() ? this.diskSizeGb() : undefined,
        firewallRules: this.buildFirewallRules(),
        vnetConfig: this.selectedVNetId() && this.selectedSubnetId() ? {
          vnetId: this.selectedVNetId()!,
          subnetId: this.selectedSubnetId()!,
          autoAssignIp: true
        } : undefined,
        endpointHostnameMode: this.endpointHostnameMode(),
        sharedStorageEnabled: this.sharedStorageEnabled(),
        sharedStorageVolumeSizeGb: this.sharedStorageEnabled()
          ? this.sharedStorageVolumeSizeGb()
          : undefined,
      };

      const result = await this.clusterService.createCluster(configuration);

      // Update SSH key tags if needed
      if (this.selectedSshKeyId()) {
        await this.updateSshKeyTagsWithClusterId(result.clusterId, this.selectedSshKeyId()!);
      }

      // Navigate to progress tracker
      if (result.operationId) {
        this.router.navigate(['/cluster/create', result.operationId]);
      } else if (result.clusterId) {
        this.router.navigate(['/cluster', result.clusterId]);
      } else {
        this.router.navigate(['/cluster']);
      }

      this.completeOutput.emit({
        success: true,
        cluster: {
          ...configuration,
          id: result.clusterId,
          clusterId: result.clusterId,
          operationId: result.operationId,
        },
      });
    } catch (error: any) {
      console.error('Failed to create cluster:', error);
      this.completeOutput.emit({
        success: false,
        error: this.mapCreateClusterError(error),
      });
    } finally {
      this.isCreating.set(false);
    }
  }

  private mapCreateClusterError(error: any): string {
    const body = error?.error;
    switch (body?.code) {
      case 'CROSS_PROVIDER_NOT_ALLOWED':
        return body.message
          ?? 'This workload must use the same provider as the control cluster.';
      case 'VNET_REQUIRED':
        return body.message
          ?? 'This provider requires a VNet/Subnet selection.';
      default:
        return body?.message ?? error?.message ?? 'Failed to create cluster';
    }
  }

  /**
   * Update SSH key tags with cluster ID
   */
  private async updateSshKeyTagsWithClusterId(clusterId: string, keyId: string): Promise<void> {
    try {
      const existingKey = this.getSshKeyById(keyId);
      if (!existingKey) return;

      const existingTags = (existingKey.tags || {}) as Record<string, any>;
      let existingClusterIds: any[];
      if (Array.isArray(existingTags['cluster-id'])) existingClusterIds = existingTags['cluster-id'];
      else if (existingTags['cluster-id']) existingClusterIds = [existingTags['cluster-id']];
      else existingClusterIds = [];

      const updatedClusterIds = existingClusterIds.includes(clusterId)
        ? existingClusterIds
        : [...existingClusterIds, clusterId];

      const updatedTags = {
        ...existingTags,
        'cluster-id': updatedClusterIds,
      };

      await firstValueFrom(
        this.accessManagementService.accessControllerUpdateSSHKey(keyId, {
          tags: updatedTags,
        })
      );

    } catch {
      // Non-critical: cluster is created, only tag update failed
    }
  }
}
