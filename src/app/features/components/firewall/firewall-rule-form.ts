import { Component, input, output } from '@angular/core';
import { FirewallRuleFormData } from '../../model/firewall-v2.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';

export type RuleFieldChange = {
  [K in keyof FirewallRuleFormData]-?: { field: K; value: FirewallRuleFormData[K] };
}[keyof FirewallRuleFormData];

function cidr(octets: readonly number[], prefix: number): string {
  return `${octets.join('.')}/${prefix}`;
}

const PRIVATE_RANGES = [
  cidr([192, 168, 0, 0], 16),
  cidr([10, 0, 0, 0], 8),
  cidr([172, 16, 0, 0], 12),
];

const PRESETS = [
  { cidr: '0.0.0.0/0', label: 'All IPs' },
  ...PRIVATE_RANGES.map((range) => ({ cidr: range, label: range })),
];

@Component({
  selector: 'app-firewall-rule-form',
  imports: [FlAlert, FlField, FlButton],
  host: { class: 'flex flex-col gap-4' },
  template: `
    @if (errors().length > 0) {
      <fl-alert tone="error" title="Check the rule">
        <ul class="m-0 pl-4">
          @for (error of errors(); track error) {
            <li>{{ error }}</li>
          }
        </ul>
      </fl-alert>
    }
    <fl-field label="Description" [for]="idPrefix() + '-description'">
      <div class="fl-input fl-input--lg">
        <input
          [id]="idPrefix() + '-description'"
          type="text"
          [value]="rule().description"
          (input)="change('description', value($event))"
          placeholder="For example SSH access"
        />
      </div>
    </fl-field>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <fl-field label="Direction" [for]="idPrefix() + '-direction'">
        <span class="fl-select-wrap">
          <select
            class="fl-select"
            [id]="idPrefix() + '-direction'"
            [value]="rule().direction"
            (change)="change('direction', asDirection($event))"
          >
            <option value="in">Inbound</option>
            <option value="out">Outbound</option>
          </select>
        </span>
      </fl-field>
      <fl-field label="Protocol" [for]="idPrefix() + '-protocol'">
        <span class="fl-select-wrap">
          <select
            class="fl-select"
            [id]="idPrefix() + '-protocol'"
            [value]="rule().protocol"
            (change)="change('protocol', asProtocol($event))"
          >
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="icmp">ICMP</option>
          </select>
        </span>
      </fl-field>
      @if (rule().protocol !== 'icmp') {
        <fl-field label="Port" [for]="idPrefix() + '-port'" hint="One port or a range">
          <div class="fl-input fl-input--lg">
            <input
              [id]="idPrefix() + '-port'"
              class="fl-mono"
              type="text"
              [value]="rule().port ?? ''"
              (input)="change('port', value($event))"
              placeholder="22 or 8000-8100"
            />
          </div>
        </fl-field>
      }
    </div>
    <fl-field
      [label]="rule().direction === 'in' ? 'Source CIDRs' : 'Destination CIDRs'"
      [for]="idPrefix() + '-cidrs'"
      hint="Comma-separated CIDR ranges"
    >
      <div class="fl-input fl-input--lg">
        <input
          [id]="idPrefix() + '-cidrs'"
          class="fl-mono"
          type="text"
          [value]="ipsText()"
          (input)="ipsTextChange.emit(value($event))"
          [placeholder]="rule().direction === 'in' ? '0.0.0.0/0, 192.168.1.0/24' : '0.0.0.0/0'"
        />
      </div>
    </fl-field>
    <div class="fl-row" role="group" aria-label="Add a common range">
      @if (rule().direction === 'in') {
        <button
          flButton="ghost"
          size="sm"
          type="button"
          [disabled]="detecting()"
          (click)="detectIp.emit()"
        >
          {{ detecting() ? 'Detecting…' : 'My IP' }}
        </button>
      }
      @for (p of presets; track p.cidr) {
        <button flButton="ghost" size="sm" type="button" (click)="preset.emit(p.cidr)">
          <span [class.fl-mono]="p.cidr !== '0.0.0.0/0'">{{ p.label }}</span>
        </button>
      }
      <button flButton="ghost" size="sm" type="button" (click)="clearIps.emit()">Clear</button>
    </div>
  `,
})
export class FirewallRuleForm {
  readonly rule = input.required<FirewallRuleFormData>();
  readonly ipsText = input('');
  readonly errors = input<readonly string[]>([]);
  readonly detecting = input(false);
  readonly idPrefix = input.required<string>();
  readonly fieldChange = output<RuleFieldChange>();
  readonly ipsTextChange = output<string>();
  readonly detectIp = output<void>();
  readonly preset = output<string>();
  readonly clearIps = output<void>();

  protected readonly presets = PRESETS;

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected asDirection(event: Event): FirewallRuleFormData['direction'] {
    return this.value(event) as FirewallRuleFormData['direction'];
  }

  protected asProtocol(event: Event): FirewallRuleFormData['protocol'] {
    return this.value(event) as FirewallRuleFormData['protocol'];
  }

  protected change<K extends keyof FirewallRuleFormData>(
    field: K,
    value: FirewallRuleFormData[K],
  ): void {
    this.fieldChange.emit({ field, value } as RuleFieldChange);
  }
}
