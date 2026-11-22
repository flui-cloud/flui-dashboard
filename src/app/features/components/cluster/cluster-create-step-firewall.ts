import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRefreshCw, lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { isSshRule } from './cluster-create-firewall-form';

export interface ManagedFirewallRule {
  readonly description: string;
  readonly protocol: string;
  readonly port: string;
  readonly direction: string;
  readonly source: string;
}

interface RuleRow {
  readonly group: FormGroup;
  readonly index: number;
  readonly custom: boolean;
  readonly outbound: boolean;
  readonly ssh: boolean;
  readonly description: string;
  readonly protocol: string;
  readonly port: string;
  readonly direction: string;
  readonly field: 'sourceIps' | 'destinationIps';
  readonly empty: boolean;
  readonly error: string | null;
}

function cidrError(control: FormControl | null, label: string): string | null {
  if (!control) return null;
  const errors = control.errors;
  if (errors?.['required'] && control.touched) return `${label} are required.`;
  const invalid = errors?.['invalidCidrs'] as string[] | undefined;
  if (invalid)
    return `Invalid CIDR: ${invalid.join(', ')}. Add /32 for a single IP or /24 for a subnet.`;
  return null;
}

@Component({
  selector: 'app-cluster-create-step-firewall',
  imports: [
    ReactiveFormsModule,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlEmptyState,
    FlTable,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucidePlus, lucideRefreshCw, lucideX })],
  host: { class: 'fl-stack' },
  templateUrl: './cluster-create-step-firewall.html',
})
export class ClusterCreateStepFirewall {
  readonly form = input.required<FormGroup>();
  readonly detecting = input(false);
  readonly userIp = input<string | null>(null);
  readonly throughTunnel = input(false);
  readonly controlProvider = input<string | null>(null);
  readonly managedRules = input<readonly ManagedFirewallRule[]>([]);
  readonly detectIp = output<number>();
  readonly resetIps = output<number>();
  readonly addRule = output<void>();
  readonly removeRule = output<number>();
  readonly directionChange = output<number>();

  private readonly revision = signal(0);

  protected readonly enabledControl = computed(
    () => this.form().get('enabled') as FormControl<boolean>,
  );

  protected readonly enabled = computed(() => {
    this.revision();
    return !!this.enabledControl().value;
  });

  protected readonly rows = computed<RuleRow[]>(() => {
    this.revision();
    const rules = this.form().get('rules') as FormArray<FormGroup>;
    return rules.controls.map((group, index) => {
      const value = group.getRawValue();
      const outbound = value.direction === 'out';
      const field = outbound ? 'destinationIps' : 'sourceIps';
      const label = outbound ? 'Destination CIDRs' : 'Source CIDRs';
      return {
        group,
        index,
        custom: !!value.isCustom,
        outbound,
        ssh: isSshRule(group),
        description: value.description ?? '',
        protocol: String(value.protocol ?? '').toUpperCase(),
        port: value.port || '-',
        direction: String(value.direction ?? '').toUpperCase(),
        field,
        empty: !value[field],
        error: cidrError(group.get(field) as FormControl | null, label),
      };
    });
  });

  constructor() {
    effect((onCleanup) => {
      const subscription = this.form().events.subscribe(() => this.revision.update((v) => v + 1));
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
