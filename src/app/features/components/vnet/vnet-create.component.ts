import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideTrash2 } from '@ng-icons/lucide';

import { VNetService } from '../../service/vnet.service';
import { CreateVNetConfiguration } from '../../model/vnet.models';
import { ProviderWizardService } from '../../../shared/services/provider-wizard.service';
import { VNetTopologyDto } from '../../../core/api/model/vNetTopologyDto';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'vnet-create',
  imports: [
    FormsModule,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlField,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucidePlus, lucideTrash2 })],
  template: `
    <div class="fl-page">
      <fl-page-header title="Create network" [breadcrumb]="breadcrumb">
        <span headerMeta>A private network on one of your providers</span>
      </fl-page-header>

      @if (errorMessage()) {
        <fl-alert tone="error" title="Could not create the network">{{ errorMessage() }}</fl-alert>
      }

      <fl-panel title="Network">
        <div class="flex max-w-2xl flex-col gap-4">
          <fl-field label="Provider" for="vnet-provider">
            @if (isLoadingProviders()) {
              <fl-loading-state [rows]="1" />
            } @else {
              <span class="fl-select-wrap">
                <select
                  id="vnet-provider"
                  class="fl-select"
                  [ngModel]="providerSignal()"
                  (ngModelChange)="onProviderChange($event)"
                >
                  @for (p of enabledProviders(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
              </span>
            }
          </fl-field>

          <fl-field
            label="IP range"
            for="vnet-ip-range"
            [error]="ipRange() && !isValidCIDR() ? cidrErrorMessage() : null"
          >
            <div class="fl-input fl-input--lg fl-mono">
              <input
                id="vnet-ip-range"
                type="text"
                autocomplete="off"
                spellcheck="false"
                [ngModel]="ipRange()"
                (ngModelChange)="ipRange.set($event)"
                [placeholder]="'10.0.0.0/' + suggestedVnetPrefix()"
              />
            </div>
            <span class="fl-field__hint">
              {{ vnetCidrHint() }}.
              <button
                type="button"
                class="fl-link"
                (click)="ipRange.set('10.0.0.0/' + suggestedVnetPrefix())"
              >
                Use /{{ suggestedVnetPrefix() }}
              </button>
              @if (ipRangeAddressLabel()) {
                <span class="fl-mono"> · {{ ipRangeAddressLabel() }}</span>
              }
            </span>
          </fl-field>

          <fl-field
            label="Name"
            for="vnet-name"
            [hint]="
              !nameCustomized && vnetName ? 'Suggested from the provider and zone' : undefined
            "
            [error]="showValidation() && !vnetName ? 'Enter a name' : null"
          >
            <div class="fl-input fl-input--lg">
              <input
                id="vnet-name"
                type="text"
                autocomplete="off"
                [(ngModel)]="vnetName"
                (input)="onNameInput()"
                placeholder="production-network"
              />
            </div>
          </fl-field>
        </div>
      </fl-panel>

      @if (vnetTopology() && vnetZones().length > 0) {
        <fl-panel title="Zone">
          <div class="flex max-w-2xl flex-col gap-4">
            <fl-field
              label="Network zone"
              for="vnet-zone"
              [hint]="
                selectedZoneCoveredRegions.length > 0
                  ? 'Covers ' + selectedZoneCoveredRegions.join(', ')
                  : undefined
              "
            >
              <span class="fl-select-wrap">
                <select
                  id="vnet-zone"
                  class="fl-select"
                  [(ngModel)]="subnetZone"
                  (ngModelChange)="onZoneChange($event)"
                >
                  @for (zone of vnetZones(); track zone.id) {
                    <option [value]="zone.id">{{ zone.displayName }}</option>
                  }
                </select>
              </span>
            </fl-field>

            @if (supportsSubnets()) {
              <label class="fl-check">
                <input type="checkbox" [(ngModel)]="createInitialSubnet" />
                <span>Create a first subnet in this zone</span>
              </label>
              @if (createInitialSubnet) {
                <fl-field
                  label="Subnet IP range"
                  for="vnet-subnet-range"
                  [hint]="subnetCidrHint()"
                  [error]="subnetIpRange && !isValidSubnetCIDR() ? subnetCidrErrorMessage() : null"
                >
                  <div class="fl-input fl-input--lg fl-mono">
                    <input
                      id="vnet-subnet-range"
                      type="text"
                      autocomplete="off"
                      spellcheck="false"
                      [(ngModel)]="subnetIpRange"
                      placeholder="Leave empty to allocate one"
                    />
                  </div>
                </fl-field>
              }
            }
          </div>
        </fl-panel>
      }

      <fl-panel title="Labels" [count]="labels().length || null">
        <button panelActions flButton size="sm" type="button" (click)="addLabel()">
          <fl-icon name="lucidePlus" />
          Add label
        </button>
        @if (labels().length > 0) {
          <div class="flex max-w-2xl flex-col gap-2">
            @for (label of labels(); track $index; let i = $index) {
              <div class="flex items-center gap-2">
                <div class="fl-input fl-input--lg min-w-0 flex-1">
                  <input
                    type="text"
                    [attr.aria-label]="'Label ' + (i + 1) + ' key'"
                    [(ngModel)]="label.key"
                    placeholder="Key"
                  />
                </div>
                <div class="fl-input fl-input--lg min-w-0 flex-1">
                  <input
                    type="text"
                    [attr.aria-label]="'Label ' + (i + 1) + ' value'"
                    [(ngModel)]="label.value"
                    placeholder="Value"
                  />
                </div>
                <button
                  flButton="ghost"
                  type="button"
                  [iconOnly]="true"
                  [attr.aria-label]="'Remove label ' + (i + 1)"
                  (click)="removeLabel(i)"
                >
                  <fl-icon name="lucideTrash2" />
                </button>
              </div>
            }
          </div>
        } @else {
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">No labels. Labels are optional.</p>
        }
      </fl-panel>

      <div class="flex justify-end gap-2">
        <button flButton="ghost" type="button" [disabled]="isLoading()" (click)="goBack()">
          Cancel
        </button>
        <button
          flButton="primary"
          type="button"
          [disabled]="isLoading() || !isFormValid()"
          (click)="createVNet()"
        >
          @if (isLoading()) {
            <fl-spinner label="Creating" />
            Creating…
          } @else {
            Create network
          }
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class VNetCreateComponent implements OnInit {
  private readonly vnetService = inject(VNetService);
  private readonly router = inject(Router);
  private readonly providerWizardService = inject(ProviderWizardService);

  readonly isLoading = this.vnetService.loading;
  readonly errorMessage = this.vnetService.errorMessage;
  readonly isLoadingProviders = this.providerWizardService.isProviderLoading;

  protected readonly breadcrumb = [
    { label: 'Networks', link: '/infrastructure/vnet' },
    { label: 'Create network' },
  ];

  readonly enabledProviders = () =>
    this.providerWizardService.providersData().filter((p) => !p.comingSoon);

  readonly vnetTopology = computed((): VNetTopologyDto | null => {
    const def = this.providerWizardService.getProviderDefinition(this.providerSignal());
    return def?.capabilities?.vnetTopology ?? null;
  });

  readonly vnetZones = computed(() => this.vnetTopology()?.zones ?? []);

  readonly supportsSubnets = computed(() => this.vnetTopology()?.supportsSubnets ?? false);

  readonly subnetPerZone = computed(() => this.vnetTopology()?.subnetPerZone ?? false);

  readonly vnetIpConstraints = computed(() => this.vnetTopology()?.vnetIpRange ?? null);

  readonly subnetIpConstraints = computed(() => this.vnetTopology()?.subnetIpRange ?? null);

  readonly suggestedVnetPrefix = computed(() => {
    const c = this.vnetIpConstraints();
    if (!c) return 16;
    if (16 >= c.minPrefix && 16 <= c.maxPrefix) return 16;
    return Math.round((c.minPrefix + c.maxPrefix) / 2);
  });

  readonly vnetCidrHint = computed(() => {
    const c = this.vnetIpConstraints();
    if (!c) return 'Recommended: /16 for production';
    return `Allowed: /${c.minPrefix}–/${c.maxPrefix}`;
  });

  readonly ipRangeAddressCount = computed(() => {
    const val = this.ipRange();
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!val || !cidrRegex.test(val)) return null;
    const prefix = Number.parseInt(val.split('/')[1], 10);
    if (prefix < 0 || prefix > 32) return null;
    return Math.pow(2, 32 - prefix);
  });

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

    const countLabel =
      count >= 1_000_000 ? `${(count / 1_000_000).toFixed(1)}M` : count.toLocaleString();

    return `${countLabel} addresses · ${toIp(first)}–${toIp(last)}`;
  });

  readonly subnetCidrHint = computed(() => {
    const c = this.subnetIpConstraints();
    if (!c) return 'Leave empty to automatically allocate a /28 subnet (16 IPs)';
    return `Allowed range: /${c.minPrefix} to /${c.maxPrefix}. Leave empty for auto-allocation.`;
  });

  get selectedZoneCoveredRegions(): string[] {
    return this.vnetZones().find((z) => z.id === this.subnetZone)?.coveredRegions ?? [];
  }

  vnetName = '';
  nameCustomized = false;
  providerSignal = signal<string>('');
  ipRange = signal<string>('');

  createInitialSubnet = true;
  subnetZone = '';
  subnetIpRange = '';

  labels = signal<{ key: string; value: string }[]>([]);

  showValidation = signal(false);

  constructor() {
    effect(() => {
      const zones = this.vnetZones();
      if (zones.length > 0) {
        this.subnetZone = zones[0].id;
      } else {
        this.subnetZone = '';
      }
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
    this.nameCustomized = false;
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
    this.labels.update((current) => [...current, { key: '', value: '' }]);
  }

  removeLabel(index: number) {
    this.labels.update((current) => current.filter((_, i) => i !== index));
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
    if (!this.subnetIpRange) return true;
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
    if (!cidrRegex.test(this.subnetIpRange))
      return 'Please enter a valid CIDR notation (e.g., 10.0.0.0/24)';
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
        .filter((l) => l.key && l.value)
        .map((l) => ({ key: l.key, value: l.value })),
      subnet: hasSubnet
        ? {
            networkZone: this.subnetZone,
            ipRange: this.subnetIpRange || undefined,
          }
        : undefined,
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
