import { Component, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideShield } from '@ng-icons/lucide';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import {
  RuleLike,
  isRuleApplied,
  ruleCidrs,
  ruleDirection,
  rulePort,
  ruleProtocol,
} from './firewall-format';

@Component({
  selector: 'app-firewall-rules-table',
  imports: [FlTable, FlEmptyState, FlStatus],
  providers: [provideIcons({ lucideShield })],
  host: { class: 'block' },
  template: `
    @if (rules().length === 0) {
      <fl-empty-state
        icon="lucideShield"
        title="No firewall rules"
        body="Edit the rules to open a port."
        [compact]="true"
      />
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
                <td>{{ direction(rule) }}</td>
                <td class="fl-mono">{{ protocol(rule) }}</td>
                <td class="fl-mono">{{ port(rule) }}</td>
                <td class="fl-mono whitespace-normal">{{ cidrs(rule) }}</td>
                <td>
                  @if (applied(rule)) {
                    <fl-status tone="success" label="Applied" />
                  } @else {
                    <fl-status tone="neutral" label="Not applied" />
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class FirewallRulesTable {
  readonly rules = input.required<readonly RuleLike[]>();
  readonly appliedRules = input<readonly RuleLike[]>([]);

  protected readonly direction = ruleDirection;
  protected readonly protocol = ruleProtocol;
  protected readonly port = rulePort;
  protected readonly cidrs = ruleCidrs;

  protected applied(rule: RuleLike): boolean {
    return isRuleApplied(rule, this.appliedRules());
  }
}
