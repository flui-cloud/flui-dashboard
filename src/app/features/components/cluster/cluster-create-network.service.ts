import { computed, inject, signal } from '@angular/core';
import { AddSubnetConfiguration, VNetInfo } from '../../model/vnet.models';
import { VNetService } from '../../service/vnet.service';
import { ProviderWizardService } from '../../../shared/services/provider-wizard.service';
import { deriveSubnetCidr, isValidSubnetCidr, orderSubnets } from './cluster-create-network-model';
import { ReviewVnet } from './cluster-create-step-review';
import { ClusterCreateState } from './cluster-create.state';

export class ClusterCreateNetwork {
  private readonly vnetService = inject(VNetService);
  private readonly wizardService = inject(ProviderWizardService);

  readonly showAddSubnetForm = signal<boolean>(false);
  readonly addingSubnet = signal<boolean>(false);
  readonly addSubnetError = signal<string | null>(null);
  addSubnetZone = '';
  addSubnetIpRange = '';

  constructor(private readonly state: ClusterCreateState) {}

  readonly orderedSubnets = computed(() =>
    orderSubnets(this.state.selectedVNetData()?.subnets ?? []),
  );

  private readonly providerVnetTopology = computed(
    () =>
      this.wizardService.getProviderDefinition(this.state.selectedProvider())?.capabilities
        ?.vnetTopology ?? null,
  );
  readonly addSubnetZones = computed(() => this.providerVnetTopology()?.zones ?? []);
  private readonly addSubnetConstraints = computed(
    () => this.providerVnetTopology()?.subnetIpRange ?? null,
  );

  readonly reviewVnet = computed<ReviewVnet | null>(() => {
    const vnet = this.state.selectedVNetData();
    if (!this.state.selectedVNetId() || !this.state.selectedSubnetId()) return null;
    return {
      name: vnet?.name ?? '',
      ipRange: vnet?.ipRange ?? '',
      subnet: this.state.getSelectedSubnet()?.ipRange ?? '',
    };
  });

  onVNetSelected(vnet: VNetInfo | null): void {
    if (vnet) {
      this.state.selectedVNetId.set(vnet.id);
      this.state.selectedVNetData.set(vnet);
      const usable = vnet.subnets.filter((s) => this.state.isSubnetUsable(s));
      this.state.selectedSubnetId.set(usable.length === 1 ? usable[0].id : null);
    } else {
      this.state.selectedVNetId.set(null);
      this.state.selectedVNetData.set(null);
      this.state.selectedSubnetId.set(null);
    }
  }

  selectSubnet(subnetId: string): void {
    const subnet = this.state.selectedVNetData()?.subnets.find((s) => s.id === subnetId);
    if (subnet && !this.state.isSubnetUsable(subnet)) return;
    this.state.selectedSubnetId.set(subnetId);
  }

  private deriveSubnetCidr(vnetIpRange: string): string | undefined {
    return deriveSubnetCidr(
      vnetIpRange,
      this.addSubnetConstraints(),
      this.state.selectedVNetData()?.subnets.length ?? 0,
    );
  }

  isValidAddSubnetCidr(): boolean {
    if (!this.addSubnetIpRange) return true;
    return isValidSubnetCidr(this.addSubnetIpRange, this.addSubnetConstraints());
  }

  isAddSubnetValid(): boolean {
    if (this.addSubnetZones().length > 0 && !this.addSubnetZone) return false;
    return this.isValidAddSubnetCidr();
  }

  openAddSubnetForm(): void {
    const vnet = this.state.selectedVNetData();
    const zones = this.addSubnetZones();
    this.addSubnetZone = vnet?.subnets[0]?.networkZone || zones[0]?.id || '';
    this.addSubnetIpRange = vnet ? (this.deriveSubnetCidr(vnet.ipRange) ?? '') : '';
    this.addSubnetError.set(null);
    this.showAddSubnetForm.set(true);
  }

  closeAddSubnetForm(): void {
    this.showAddSubnetForm.set(false);
    this.addSubnetError.set(null);
  }

  async submitAddSubnet(): Promise<void> {
    const vnet = this.state.selectedVNetData();
    if (!vnet || !this.isAddSubnetValid()) return;
    this.addingSubnet.set(true);
    this.addSubnetError.set(null);
    const existingIds = new Set(vnet.subnets.map((s) => s.id));

    const config: AddSubnetConfiguration = {
      networkZone: this.addSubnetZone,
      ipRange: this.addSubnetIpRange || this.deriveSubnetCidr(vnet.ipRange),
    };

    try {
      const updated = await this.vnetService.addSubnet(vnet.id, config);
      this.state.selectedVNetData.set(updated);
      const added = updated.subnets.find((s) => !existingIds.has(s.id)) ?? updated.subnets.at(-1);
      if (added) {
        this.state.selectedSubnetId.set(added.id);
      }
      this.showAddSubnetForm.set(false);
    } catch (error: any) {
      this.addSubnetError.set(error?.error?.message || 'Failed to add subnet');
    } finally {
      this.addingSubnet.set(false);
    }
  }
}
