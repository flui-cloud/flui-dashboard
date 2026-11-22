import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideNetwork, lucidePlus, lucideSearch, lucideX } from '@ng-icons/lucide';
import { VNetService } from '../../../features/service/vnet.service';
import {
  VNetInfo,
  CreateVNetConfiguration,
  vnetServesRegion,
  vnetServedRegions,
} from '../../../features/model/vnet.models';
import { ProviderWizardService } from '../../services/provider-wizard.service';
import { VNetTopologyDto } from '../../../core/api/model/vNetTopologyDto';
import { vnetProviderLabel, vnetStatus } from '../../../features/components/vnet/vnet-status';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

let nextId = 0;

@Component({
  selector: 'app-vnet-selector',
  imports: [
    FormsModule,
    FlPanel,
    FlAlert,
    FlField,
    FlTable,
    FlEmptyState,
    FlLoadingState,
    FlStatus,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucideNetwork, lucidePlus, lucideSearch, lucideX })],
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './vnet-selector.component.html',
})
export class VNetSelectorComponent implements OnInit {
  private readonly vnetService = inject(VNetService);
  private readonly providerWizardService = inject(ProviderWizardService);

  protected readonly uid = `vnet-selector-${nextId++}`;

  provider = input<string | undefined>(undefined);

  required = input<boolean>(false);

  description = input<string | undefined>(undefined);

  region = input<string | undefined>(undefined);

  readonly regionForNew = computed(() =>
    this.vnetZones().length === 0 && this.vnetTopology()?.scope === 'regional'
      ? (this.region() ?? '')
      : '',
  );

  vnetSelected = output<VNetInfo | null>();

  selectedVNet = signal<VNetInfo | null>(null);
  searchQuery = signal<string>('');
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  showCreateForm = signal<boolean>(false);
  isCreating = signal<boolean>(false);
  createError = signal<string | null>(null);
  occupiedCidrs = signal<string[]>([]);

  newVnetName = '';
  newIpRange = '';
  newSubnetZone = '';
  newCreateSubnet = true;
  newSubnetIpRange = '';

  filteredVNets = computed(() => {
    const vnets = this.vnetService.vnets();
    const query = this.searchQuery().toLowerCase();

    return vnets.filter((vnet) => {
      if (query) {
        const name = vnet.name.toLowerCase();
        const ipRange = vnet.ipRange.toLowerCase();
        return name.includes(query) || ipRange.includes(query);
      }
      return true;
    });
  });

  protected readonly providerName = computed(() => {
    const p = this.provider() ?? '';
    return this.providerWizardService.getProviderDefinition(p)?.displayName || p;
  });

  protected readonly emptyTitle = computed(() => {
    const query = this.searchQuery();
    if (query) return `No networks match "${query}"`;
    const p = this.provider();
    return p ? `No networks on ${this.providerName()}` : 'No networks yet';
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

  constructor() {
    effect(() => {
      this.provider();
      this.loadVNets();
    });
    effect(() => {
      const selected = this.selectedVNet();
      if (selected && !vnetServesRegion(selected, this.region())) {
        untracked(() => this.selectVNet(null));
      }
    });
  }

  ngOnInit(): void {
    this.loadVNets();
    void this.providerWizardService.loadProviders();
  }

  async openCreateForm(): Promise<void> {
    const p = this.provider() ?? '';
    const zones = this.vnetZones();
    const region = this.region();
    const covering = region ? zones.find((z) => z.coveredRegions?.includes(region)) : undefined;
    this.newSubnetZone = covering?.id ?? zones[0]?.id ?? this.regionForNew();
    this.newVnetName = this.newSubnetZone ? `${p}-${this.newSubnetZone}` : `${p}-vnet`;
    this.newCreateSubnet = this.supportsSubnets();
    this.createError.set(null);
    this.occupiedCidrs.set([]);
    this.newIpRange = `10.0.0.0/${this.suggestedVnetPrefix()}`;
    this.newSubnetIpRange = this.deriveDefaultSubnetCidr() ?? '';
    this.showCreateForm.set(true);

    if (p) {
      const occupied = await this.vnetService.getOccupiedSubnets(
        p,
        this.newSubnetZone || undefined,
      );
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
    const ip = ((+m[1] << 24) | (+m[2] << 16) | (+m[3] << 8) | +m[4]) >>> 0;
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

  cidrOccupied(cidr: string): boolean {
    return this.occupiedCidrs().some((c) => this.cidrsOverlap(c, cidr));
  }

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

  private deriveDefaultSubnetCidr(): string | undefined {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(this.newIpRange);
    if (!m) return undefined;
    const vnetPrefix = Number.parseInt(m[5], 10);
    const c = this.subnetIpConstraints();
    let prefix = Math.max(24, vnetPrefix);
    if (c) prefix = Math.min(Math.max(prefix, c.minPrefix), c.maxPrefix);
    return `${m[1]}.${m[2]}.0.0/${prefix}`;
  }

  closeCreateForm(): void {
    this.showCreateForm.set(false);
    this.createError.set(null);
  }

  private cidrMatches(
    value: string,
    constraints: { minPrefix: number; maxPrefix: number } | null,
  ): boolean {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;
    if (!cidrRegex.test(value)) return false;
    const prefix = Number.parseInt(value.split('/')[1], 10);
    if (prefix < 0 || prefix > 32) return false;
    if (constraints && (prefix < constraints.minPrefix || prefix > constraints.maxPrefix))
      return false;
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
    if (!this.newSubnetIpRange) return true;
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
      networkZone: this.newSubnetZone || undefined,
      subnet: includeSubnet
        ? {
            networkZone: this.newSubnetZone,
            ipRange: this.regionForNew()
              ? this.deriveDefaultSubnetCidr()
              : this.newSubnetIpRange || this.deriveDefaultSubnetCidr(),
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

  zoneServesRegion(zone: { coveredRegions?: string[] }): boolean {
    const region = this.region();
    return !region || !zone.coveredRegions?.length || zone.coveredRegions.includes(region);
  }

  isUsable(vnet: VNetInfo): boolean {
    return vnetServesRegion(vnet, this.region());
  }

  servedRegions(vnet: VNetInfo): string[] {
    return vnetServedRegions(vnet);
  }

  selectVNet(vnet: VNetInfo | null): void {
    this.selectedVNet.set(vnet);
    this.vnetSelected.emit(vnet);
  }

  isSelected(vnet: VNetInfo): boolean {
    const selected = this.selectedVNet();
    return selected ? selected.id === vnet.id : false;
  }

  protected statusOf(vnet: VNetInfo) {
    return vnetStatus(vnet.status);
  }

  protected providerLabel(vnet: VNetInfo): string {
    return vnetProviderLabel(
      vnet,
      (id) => this.providerWizardService.getProviderDefinition(id)?.displayName,
    );
  }

  protected ipRangeError(): string | null {
    if (!this.newIpRange) return null;
    if (!this.isValidVnetCidr()) return this.vnetCidrError();
    if (this.cidrOccupied(this.newIpRange)) {
      return `This range is already in use on ${this.providerName()}.`;
    }
    return null;
  }
}
