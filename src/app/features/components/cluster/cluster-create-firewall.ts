import { inject } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ClusterType, getDefaultRulesForClusterType } from '../../model/firewall-v2.models';
import { IpDetectionService } from '../../../shared/services/ip-detection.service';
import {
  FirewallRuleDto,
  applyRuleDirection,
  countSourceCidrs,
  customRuleGroup,
  defaultRuleGroup,
  toFirewallRuleDtos,
} from './cluster-create-firewall-form';
import { ClusterCreateState } from './cluster-create.state';

export class ClusterCreateFirewall {
  private readonly fb = inject(FormBuilder);
  private readonly ipDetectionService = inject(IpDetectionService);

  constructor(private readonly state: ClusterCreateState) {}

  private get rules() {
    return this.state.getFirewallRulesArray();
  }

  async initializeFirewall(): Promise<void> {
    try {
      const defaultRules = getDefaultRulesForClusterType(ClusterType.WORKLOAD);
      const userIP = await this.ipDetectionService.detectPublicIP();
      const rulesArray = this.rules;
      for (const rule of defaultRules) {
        rulesArray.push(defaultRuleGroup(this.fb, rule, userIP));
      }
    } catch (error) {
      console.error('Failed to initialize firewall rules:', error);
    }
  }

  async detectAndSetIP(ruleIndex: number): Promise<void> {
    const ip = await this.ipDetectionService.detectPublicIP(true);
    if (ip) {
      const ruleControl = this.rules.at(ruleIndex);
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
    const ruleControl = this.rules.at(ruleIndex);
    if (ruleControl.get('direction')?.value === 'out') {
      ruleControl.patchValue({ destinationIps: ruleControl.get('originalDestinationIps')?.value });
    } else {
      ruleControl.patchValue({ sourceIps: ruleControl.get('originalSourceIps')?.value });
    }
  }

  addCustomRule(): void {
    this.rules.push(customRuleGroup(this.fb));
  }

  removeRule(ruleIndex: number): void {
    const rulesArray = this.rules;
    if (!rulesArray.at(ruleIndex)?.get('isCustom')?.value) return;
    rulesArray.removeAt(ruleIndex);
  }

  onCustomRuleDirectionChange(ruleIndex: number): void {
    applyRuleDirection(this.rules.at(ruleIndex));
  }

  getTotalCustomCIDRs(): number {
    if (!this.state.firewallConfigForm.get('enabled')?.value) {
      return 0;
    }
    return countSourceCidrs(this.rules);
  }

  buildFirewallRules(): Array<FirewallRuleDto> | undefined {
    if (!this.state.firewallConfigForm.get('enabled')?.value) {
      return undefined;
    }
    return toFirewallRuleDtos(this.rules);
  }
}
