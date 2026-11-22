import { Component, computed, input, output } from '@angular/core';
import {
  architectureLabel,
  architectureWarning,
} from '../../../shared/components/architecture-badge.component';
import { NodeSizeOption } from '../../model/cluster.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { DeployReviewGroup } from '../application/deploy-review-group';
import { EnvironmentNetwork } from './cluster-create-step-network';

export interface ReviewSshKey {
  readonly name: string;
  readonly type: string;
}

export interface ReviewVnet {
  readonly name: string;
  readonly ipRange: string;
  readonly subnet: string;
}

@Component({
  selector: 'app-cluster-create-step-review',
  imports: [FlAlert, FlKeyValue, FlKvItem, DeployReviewGroup],
  host: { class: 'fl-stack' },
  templateUrl: './cluster-create-step-review.html',
})
export class ClusterCreateStepReview {
  readonly editable = input<readonly string[]>([]);
  readonly name = input('');
  readonly providerName = input('');
  readonly regionName = input('');
  readonly serverType = input<NodeSizeOption | undefined>(undefined);
  readonly serverMonthly = input<number | null>(null);
  readonly nodes = input(1);
  readonly highlyAvailable = input(false);
  readonly availabilityZones = input('');
  readonly sshKey = input<ReviewSshKey | null>(null);
  readonly environmentNetwork = input<EnvironmentNetwork | null>(null);
  readonly vnet = input<ReviewVnet | null>(null);
  readonly endpointMode = input<'ip' | 'domain'>('ip');
  readonly zoneName = input<string | null>(null);
  readonly firewallEnabled = input(false);
  readonly ruleCount = input(0);
  readonly sourceCidrs = input(0);
  readonly monthlyCost = input('0.00');
  readonly edit = output<string>();

  protected readonly architecture = computed(() =>
    architectureLabel(this.serverType()?.architecture),
  );

  protected readonly warning = computed(() => architectureWarning(this.serverType()?.architecture));
}
