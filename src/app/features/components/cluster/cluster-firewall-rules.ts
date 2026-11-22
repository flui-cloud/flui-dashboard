import { Component, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideShield } from '@ng-icons/lucide';
import { FirewallRuleDto } from '../../../core/api/model/firewallRuleDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { ruleTargets } from './cluster-firewall-format';

@Component({
  selector: 'app-cluster-firewall-rules',
  imports: [FlPanel, FlTable, FlEmptyState, FlStatus],
  providers: [provideIcons({ lucideShield })],
  template: `
    <fl-panel title="Applied rules" [count]="rules().length || null" [flush]="true">
      @if (rules().length === 0) {
        <fl-empty-state icon="lucideShield" title="No firewall rules" [compact]="true" />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Description</th>
                <th scope="col">Direction</th>
                <th scope="col">Protocol</th>
                <th scope="col">Port</th>
                <th scope="col">Source or destination</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (rule of rules(); track $index) {
                <tr>
                  <td class="font-medium">{{ rule.description }}</td>
                  <td>{{ rule.direction === 'in' ? 'Inbound' : 'Outbound' }}</td>
                  <td class="fl-mono">{{ rule.protocol?.toUpperCase() }}</td>
                  <td class="fl-mono">{{ rule.port || '—' }}</td>
                  <td class="fl-mono" [title]="allTargets(rule)">{{ targets(rule) }}</td>
                  <td><fl-status tone="success" label="Applied" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class ClusterFirewallRules {
  readonly rules = input.required<readonly FirewallRuleDto[]>();

  protected targets(rule: FirewallRuleDto): string {
    return ruleTargets(rule);
  }

  protected allTargets(rule: FirewallRuleDto): string {
    return ((rule.direction === 'in' ? rule.sourceIps : rule.destinationIps) ?? []).join(', ');
  }
}
