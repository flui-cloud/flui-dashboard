import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { cidrListValidator } from '../../../shared/utils/cidr-validator';
import { FirewallRuleFormData, isValidCidr } from '../../model/firewall-v2.models';

export interface FirewallRuleDto {
  description: string;
  direction: 'in' | 'out';
  protocol: 'tcp' | 'udp' | 'icmp';
  port?: string;
  sourceIps?: string[];
  destinationIps?: string[];
}

export function isSshRule(ruleControl: AbstractControl): boolean {
  return ruleControl.get('port')?.value === '22' && ruleControl.get('direction')?.value === 'in';
}

export function defaultRuleGroup(
  fb: FormBuilder,
  rule: FirewallRuleFormData,
  userIP: string | null,
): FormGroup {
  const isSSH = rule.port === '22' && rule.direction === 'in';
  const sourceIps = isSSH && userIP ? [`${userIP}/32`] : rule.sourceIps || [];

  let destinationIps: string[];
  if (rule.destinationIps && rule.destinationIps.length > 0) destinationIps = rule.destinationIps;
  else if (rule.direction === 'out') destinationIps = ['0.0.0.0/0'];
  else destinationIps = [];

  let sourceValidators = [Validators.required, cidrListValidator()];
  if (rule.direction !== 'in') sourceValidators = [];
  else if (isSSH) sourceValidators = [cidrListValidator()];

  return fb.group({
    description: [rule.description, Validators.required],
    direction: [rule.direction, Validators.required],
    protocol: [rule.protocol, Validators.required],
    port: [rule.port || ''],
    sourceIps: [sourceIps.join(', '), sourceValidators],
    destinationIps: [
      destinationIps.join(', '),
      rule.direction === 'out' ? [Validators.required, cidrListValidator()] : [],
    ],
    originalSourceIps: [sourceIps.join(', ')],
    originalDestinationIps: [destinationIps.join(', ')],
  });
}

export function customRuleGroup(fb: FormBuilder): FormGroup {
  return fb.group({
    description: ['Custom rule', Validators.required],
    direction: ['in', Validators.required],
    protocol: ['tcp', Validators.required],
    port: [''],
    sourceIps: ['', [Validators.required, cidrListValidator()]],
    destinationIps: [''],
    originalSourceIps: [''],
    originalDestinationIps: [''],
    isCustom: [true],
  });
}

export function applyRuleDirection(ruleControl: AbstractControl): void {
  const sourceIps = ruleControl.get('sourceIps');
  const destinationIps = ruleControl.get('destinationIps');
  if (ruleControl.get('direction')?.value === 'out') {
    sourceIps?.clearValidators();
    sourceIps?.setValue('');
    destinationIps?.setValidators([Validators.required, cidrListValidator()]);
    if (!destinationIps?.value) destinationIps?.setValue('0.0.0.0/0');
  } else {
    destinationIps?.clearValidators();
    destinationIps?.setValue('');
    sourceIps?.setValidators([Validators.required, cidrListValidator()]);
  }
  sourceIps?.updateValueAndValidity();
  destinationIps?.updateValueAndValidity();
}

function splitCidrs(value: string): string[] {
  return value
    .split(',')
    .map((c: string) => c.trim())
    .filter(Boolean);
}

export function countSourceCidrs(rules: FormArray): number {
  const allCidrs: string[] = [];
  for (const ruleControl of rules.controls) {
    const ips = ruleControl.get('sourceIps')?.value;
    if (ips) allCidrs.push(...splitCidrs(ips));
  }
  return new Set(allCidrs).size;
}

export function toFirewallRuleDtos(rules: FormArray): FirewallRuleDto[] {
  const result: FirewallRuleDto[] = [];
  let hasInboundRule = false;

  for (const ruleControl of rules.controls) {
    const direction = ruleControl.get('direction')?.value as 'in' | 'out';
    const port = ruleControl.get('port')?.value;
    if (direction === 'in') hasInboundRule = true;

    const sourceIps = splitCidrs(ruleControl.get('sourceIps')?.value || '').filter((c) =>
      isValidCidr(c),
    );
    const destinationIps = splitCidrs(ruleControl.get('destinationIps')?.value || '').filter((c) =>
      isValidCidr(c),
    );

    const rule: FirewallRuleDto = {
      description: ruleControl.get('description')?.value,
      direction,
      protocol: ruleControl.get('protocol')?.value as 'tcp' | 'udp' | 'icmp',
      port: port || undefined,
    };

    if (direction === 'in') {
      if (sourceIps.length === 0 && isSshRule(ruleControl)) continue;
      rule.sourceIps = sourceIps;
    }
    if (direction === 'out') rule.destinationIps = destinationIps;

    result.push(rule);
  }

  if (!hasInboundRule) {
    throw new Error('At least one inbound firewall rule is required (e.g., SSH)');
  }
  return result;
}
