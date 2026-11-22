import { Component, input, ChangeDetectionStrategy } from '@angular/core';

import { FirewallRuleResponseDto } from '../../../core/api/model/models';

/**
 * Component to display a side-by-side comparison of desired and applied firewall rules
 *
 * This helps visualize drift between the intended configuration and what's
 * actually deployed on the cloud provider.
 */
@Component({
  selector: 'app-firewall-rule-comparison',
  standalone: true,
  imports: [],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Desired Rules Column -->
      <div class="space-y-2">
        <h3 class="text-lg font-semibold text-gray-900 mb-3">Desired Rules</h3>
        @if (desiredRules().length === 0) {
          <p class="text-sm text-gray-500 italic">No desired rules configured</p>
        } @else {
          <div class="space-y-2">
            @for (rule of desiredRules(); track $index) {
              <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div class="text-sm font-medium text-gray-900">
                  {{ rule.description }}
                </div>
                <div class="text-xs text-gray-600 mt-1">
                  {{ formatRule(rule) }}
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Applied Rules Column -->
      <div class="space-y-2">
        <h3 class="text-lg font-semibold text-gray-900 mb-3">Applied Rules</h3>
        @if (!appliedRules() || appliedRules().length === 0) {
          <p class="text-sm text-gray-500 italic">No rules have been applied yet</p>
        } @else {
          <div class="space-y-2">
            @for (rule of appliedRules(); track $index) {
              <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div class="text-sm font-medium text-gray-900">
                  {{ rule.description }}
                </div>
                <div class="text-xs text-gray-600 mt-1">
                  {{ formatRule(rule) }}
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>

    @if (showHashComparison()) {
      <div class="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 class="text-sm font-semibold text-gray-900 mb-2">Hash Comparison</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <div class="text-gray-600 mb-1">Desired Hash:</div>
            <div class="text-gray-900 break-all">
              {{ desiredHash() || 'N/A' }}
            </div>
          </div>
          <div>
            <div class="text-gray-600 mb-1">Applied Hash:</div>
            <div class="text-gray-900 break-all">
              {{ lastAppliedHash() || 'N/A' }}
            </div>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class FirewallRuleComparisonComponent {
  // Input signals
  desiredRules = input.required<FirewallRuleResponseDto[] | any[]>();
  appliedRules = input<FirewallRuleResponseDto[] | any[]>([]);
  desiredHash = input<string>();
  lastAppliedHash = input<string>();
  showHashComparison = input<boolean>(false);

  /**
   * Format a rule for display
   */
  formatRule(rule: any): string {
    const parts: string[] = [];

    // Direction
    parts.push(rule.direction === 'in' ? 'Inbound' : 'Outbound');

    // Protocol and port
    if (rule.protocol === 'icmp') {
      parts.push('ICMP');
    } else {
      const proto = rule.protocol.toUpperCase();
      parts.push(rule.port ? `${proto}:${rule.port}` : proto);
    }

    // Source/Destination IPs
    if (rule.direction === 'in' && rule.sourceIps && rule.sourceIps.length > 0) {
      parts.push(`from ${rule.sourceIps.join(', ')}`);
    } else if (rule.direction === 'out' && rule.destinationIps && rule.destinationIps.length > 0) {
      parts.push(`to ${rule.destinationIps.join(', ')}`);
    }

    return parts.join(' • ');
  }
}
