import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { VNetSelectorComponent } from '../../../shared/components/vnet-selector/vnet-selector.component';
import { SubnetInfo, VNetInfo, subnetServesRegion } from '../../model/vnet.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { isIpv4Subnet, isSubnetUsable } from './cluster-create-network-model';

export interface EnvironmentNetwork {
  readonly name: string;
  readonly ipRange: string;
}

export interface SubnetZoneOption {
  readonly id: string;
  readonly displayName: string;
}

@Component({
  selector: 'app-cluster-create-step-network',
  imports: [VNetSelectorComponent, FlAlert, FlField, FlTable, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucidePlus })],
  host: { class: 'fl-stack' },
  templateUrl: './cluster-create-step-network.html',
})
export class ClusterCreateStepNetwork {
  readonly environmentNetwork = input<EnvironmentNetwork | null>(null);
  readonly canBuildNetwork = input(false);
  readonly fluiBuilds = input(false);
  readonly cidr = input('');
  readonly showHelp = input(false);
  readonly provider = input('');
  readonly region = input('');
  readonly vnetRequired = input(false);
  readonly vnet = input<VNetInfo | null>(null);
  readonly subnets = input<readonly SubnetInfo[]>([]);
  readonly selectedSubnetId = input<string | null>(null);
  readonly showAddForm = input(false);
  readonly adding = input(false);
  readonly addError = input<string | null>(null);
  readonly zones = input<readonly SubnetZoneOption[]>([]);
  readonly zone = input('');
  readonly ipRange = input('');
  readonly cidrValid = input(true);
  readonly addValid = input(false);
  readonly fluiBuildsChange = output<boolean>();
  readonly cidrChange = output<string>();
  readonly helpToggle = output<void>();
  readonly vnetSelected = output<VNetInfo | null>();
  readonly subnetSelect = output<string>();
  readonly openAdd = output<void>();
  readonly closeAdd = output<void>();
  readonly submitAdd = output<void>();
  readonly zoneChange = output<string>();
  readonly ipRangeChange = output<string>();

  protected usable(subnet: SubnetInfo): boolean {
    return isSubnetUsable(subnet, this.region());
  }

  protected note(subnet: SubnetInfo): string {
    if (!isIpv4Subnet(subnet.ipRange)) return 'IPv6 only. Nodes need an IPv4 subnet.';
    if (!subnetServesRegion(subnet, this.region())) return `Not reachable from ${this.region()}`;
    return '';
  }

  protected vnetDescription(): string {
    return this.vnetRequired()
      ? 'This provider requires every cluster node on a private network. Pick a VNet and a subnet to continue.'
      : 'Attach every cluster node to a private network. Optional, recommended for production clusters.';
  }
}
