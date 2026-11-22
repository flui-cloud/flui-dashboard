import { Component, computed, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideShield } from '@ng-icons/lucide';
import { FirewallRuleResponseDto } from '../../../core/api/model/models';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlStatus } from '../../../ui/primitives/status';
import {
  RuleLike,
  changeState,
  compareRules,
  ruleCidrs,
  ruleDirection,
  rulePort,
  ruleProtocol,
  ruleSummary,
} from './firewall-format';

@Component({
  selector: 'app-firewall-rule-comparison',
  imports: [FlTable, FlEmptyState, FlKeyValue, FlKvItem, FlStatus],
  providers: [provideIcons({ lucideShield })],
  host: { class: 'block' },
  template: `
    @if (rows().length === 0) {
      <fl-empty-state
        icon="lucideShield"
        title="No rules to compare"
        body="There are no desired rules and nothing has been applied yet."
        [compact]="true"
      />
    } @else {
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Change</th>
              <th scope="col">Description</th>
              <th scope="col">Direction</th>
              <th scope="col">Protocol</th>
              <th scope="col">Port</th>
              <th scope="col">Source or destination</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr>
                <td>
                  <fl-status [tone]="change(row.change).tone" [label]="change(row.change).label" />
                </td>
                <td class="whitespace-normal">
                  <span class="font-medium">{{ row.rule.description }}</span>
                  @if (row.previous; as previous) {
                    <span class="block text-fl-caption text-fl-ink-muted">
                      Applied: <span class="fl-mono">{{ summary(previous) }}</span>
                    </span>
                  }
                </td>
                <td>{{ direction(row.rule) }}</td>
                <td class="fl-mono">{{ protocol(row.rule) }}</td>
                <td class="fl-mono">{{ port(row.rule) }}</td>
                <td class="fl-mono whitespace-normal">{{ cidrs(row.rule) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (appliedRules().length === 0) {
        <p class="m-0 border-t border-fl-border p-4 text-fl-body-sm text-fl-ink-muted">
          No rules have been applied yet.
        </p>
      }
    }

    @if (showHashComparison()) {
      <div class="border-t border-fl-border p-4">
        <fl-key-value>
          <fl-kv-item key="Desired hash" [mono]="true">{{ desiredHash() || '—' }}</fl-kv-item>
          <fl-kv-item key="Applied hash" [mono]="true">{{ lastAppliedHash() || '—' }}</fl-kv-item>
        </fl-key-value>
      </div>
    }
  `,
})
export class FirewallRuleComparisonComponent {
  desiredRules = input.required<FirewallRuleResponseDto[] | RuleLike[]>();
  appliedRules = input<FirewallRuleResponseDto[] | RuleLike[]>([]);
  desiredHash = input<string>();
  lastAppliedHash = input<string>();
  showHashComparison = input<boolean>(false);

  protected readonly rows = computed(() =>
    compareRules(this.desiredRules() ?? [], this.appliedRules() ?? []),
  );

  protected readonly change = changeState;
  protected readonly summary = ruleSummary;
  protected readonly direction = ruleDirection;
  protected readonly protocol = ruleProtocol;
  protected readonly port = rulePort;
  protected readonly cidrs = ruleCidrs;
}
