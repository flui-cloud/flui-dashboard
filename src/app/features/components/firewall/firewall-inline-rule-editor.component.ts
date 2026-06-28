import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  FirewallRuleFormData,
  validateFirewallRule
} from '../../model/firewall-v2.models';

@Component({
  selector: 'app-firewall-inline-rule-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './firewall-inline-rule-editor.component.html',
  styleUrls: ['./firewall-inline-rule-editor.component.scss']
})
export class FirewallInlineRuleEditorComponent {
  @Input() set initialRules(rules: FirewallRuleFormData[] | null) {
    if (rules) {
      this.originalRules.set([...rules]);
      this.workingRules.set([...rules]);
    }
  }

  @Input() supportsSshAllowlist = true;
  @Input() isHostFirewall = false;

  @Output() save = new EventEmitter<FirewallRuleFormData[]>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly originalRules = signal<FirewallRuleFormData[]>([]);
  workingRules = signal<FirewallRuleFormData[]>([]);
  expandedIndex = signal<number | null>(null);
  isAddingNew = signal(false);

  newRuleForm = signal<FirewallRuleFormData>({
    description: '',
    direction: 'in',
    protocol: 'tcp',
    port: '',
    sourceIps: [],
    destinationIps: []
  });

  ruleErrors = signal<Map<number, string[]>>(new Map());
  newRuleErrors = signal<string[]>([]);

  sourceIpsText = signal('');
  destinationIpsText = signal('');

  detectingIp = signal(false);

  isDirty = computed(() => {
    return JSON.stringify(this.originalRules()) !== JSON.stringify(this.workingRules());
  });

  changedRulesCount = computed(() => {
    const original = this.originalRules();
    const working = this.workingRules();

    if (original.length !== working.length) {
      return Math.abs(original.length - working.length);
    }

    let count = 0;
    for (let i = 0; i < original.length; i++) {
      if (JSON.stringify(original[i]) !== JSON.stringify(working[i])) {
        count++;
      }
    }
    return count;
  });

  hasValidationErrors = computed(() => {
    return this.ruleErrors().size > 0;
  });

  isRuleModified(index: number): boolean {
    const original = this.originalRules()[index];
    const working = this.workingRules()[index];
    return original && working && JSON.stringify(original) !== JSON.stringify(working);
  }

  startAddNewRule() {
    this.expandedIndex.set(null);

    this.newRuleForm.set({
      description: '',
      direction: 'in',
      protocol: 'tcp',
      port: '',
      sourceIps: [],
      destinationIps: []
    });
    this.sourceIpsText.set('');
    this.destinationIpsText.set('');
    this.newRuleErrors.set([]);

    this.isAddingNew.set(true);
  }

  cancelAddNew() {
    this.isAddingNew.set(false);
    this.newRuleErrors.set([]);
  }

  addNewRule() {
    const form = this.newRuleForm();

    if (form.direction === 'in' && this.sourceIpsText()) {
      form.sourceIps = this.parseIps(this.sourceIpsText());
    }

    if (form.direction === 'out' && this.destinationIpsText()) {
      form.destinationIps = this.parseIps(this.destinationIpsText());
    }

    const errors = validateFirewallRule(form);
    if (errors.length > 0) {
      this.newRuleErrors.set(errors);
      return;
    }

    this.workingRules.update(rules => [{ ...form }, ...rules]);
    this.isAddingNew.set(false);
  }

  expandRule(index: number) {
    const rule = this.workingRules()[index];
    if (rule && this.isManagedSshRule(rule)) return;

    this.isAddingNew.set(false);

    if (rule.sourceIps && rule.sourceIps.length > 0) {
      this.sourceIpsText.set(rule.sourceIps.join(', '));
    } else {
      this.sourceIpsText.set('');
    }

    if (rule.destinationIps && rule.destinationIps.length > 0) {
      this.destinationIpsText.set(rule.destinationIps.join(', '));
    } else {
      this.destinationIpsText.set('');
    }

    this.expandedIndex.set(index);
  }

  collapseRule(index: number) {
    const original = this.originalRules()[index];
    if (original) {
      this.workingRules.update(rules => {
        const newRules = [...rules];
        newRules[index] = { ...original };
        return newRules;
      });
    }

    this.expandedIndex.set(null);
    this.ruleErrors.update(map => {
      map.delete(index);
      return new Map(map);
    });
  }

  saveEditedRule(index: number) {
    const rule = { ...this.workingRules()[index] };

    if (rule.direction === 'in' && this.sourceIpsText()) {
      rule.sourceIps = this.parseIps(this.sourceIpsText());
    } else if (rule.direction === 'in') {
      rule.sourceIps = [];
    }

    if (rule.direction === 'out' && this.destinationIpsText()) {
      rule.destinationIps = this.parseIps(this.destinationIpsText());
    } else if (rule.direction === 'out') {
      rule.destinationIps = [];
    }

    const errors = validateFirewallRule(rule);
    if (errors.length > 0) {
      this.ruleErrors.update(map => {
        map.set(index, errors);
        return new Map(map);
      });
      return;
    }

    this.workingRules.update(rules => {
      const newRules = [...rules];
      newRules[index] = rule;
      return newRules;
    });

    this.ruleErrors.update(map => {
      map.delete(index);
      return new Map(map);
    });
    this.expandedIndex.set(null);
  }

  private static readonly REQUIRED_INGRESS_PORTS = ['80', '443'];

  isRequiredIngress(rule: FirewallRuleFormData): boolean {
    return (
      rule.direction === 'in' &&
      rule.protocol === 'tcp' &&
      FirewallInlineRuleEditorComponent.REQUIRED_INGRESS_PORTS.includes(
        rule.port ?? '',
      )
    );
  }

  isManagedSshRule(rule: FirewallRuleFormData): boolean {
    return (
      !this.supportsSshAllowlist &&
      rule.direction === 'in' &&
      rule.protocol === 'tcp' &&
      rule.port === '22'
    );
  }

  isUnenforcedEgress(rule: FirewallRuleFormData): boolean {
    return this.isHostFirewall && rule.direction === 'out';
  }

  ruleBadge(rule: FirewallRuleFormData): string | null {
    if (this.isManagedSshRule(rule)) return 'Always open';
    if (this.isRequiredIngress(rule)) return 'Required';
    if (this.isUnenforcedEgress(rule)) return 'Not enforced';
    return null;
  }

  badgeTitle(rule: FirewallRuleFormData): string {
    if (this.isManagedSshRule(rule)) {
      return 'SSH stays open and CA-protected on a host firewall (no out-of-band recovery). Managed by Flui — cannot be edited or removed.';
    }
    if (this.isRequiredIngress(rule)) {
      return `Port ${rule.port} is required (HTTPS ingress / ACME) — you can restrict its source IPs but not remove it.`;
    }
    if (this.isUnenforcedEgress(rule)) {
      return 'Outbound traffic is not restricted on a host firewall (egress stays open). This rule is informational.';
    }
    return '';
  }

  deleteRule(index: number) {
    const rule = this.workingRules()[index];
    if (rule && this.isRequiredIngress(rule)) {
      const why =
        rule.port === '443'
          ? "the dashboard, API and apps over HTTPS (Traefik)"
          : 'ACME HTTP-01 cert renewal and the HTTP→HTTPS redirect';
      alert(
        `Port ${rule.port} can't be removed — it serves ${why}. ` +
          `Removing it would lock you out of the cluster. ` +
          `You can restrict its source IPs instead (edit the rule).`,
      );
      return;
    }
    if (confirm('Delete this firewall rule?')) {
      this.workingRules.update(rules => rules.filter((_, i) => i !== index));

      if (this.expandedIndex() === index) {
        this.expandedIndex.set(null);
      }
    }
  }

  updateRuleField<K extends keyof FirewallRuleFormData>(
    index: number,
    field: K,
    value: FirewallRuleFormData[K]
  ) {
    this.workingRules.update(rules => {
      const newRules = [...rules];
      newRules[index] = { ...newRules[index], [field]: value };
      return newRules;
    });
  }

  updateNewRuleField<K extends keyof FirewallRuleFormData>(
    field: K,
    value: FirewallRuleFormData[K]
  ) {
    this.newRuleForm.update(form => ({ ...form, [field]: value }));
    this.newRuleErrors.set([]);
  }

  saveAllChanges() {
    const rules = this.workingRules();
    const missing = FirewallInlineRuleEditorComponent.REQUIRED_INGRESS_PORTS.filter(
      (port) =>
        !rules.some(
          (r) =>
            r.direction === 'in' && r.protocol === 'tcp' && r.port === port,
        ),
    );
    if (missing.length > 0) {
      alert(
        `Can't save: inbound TCP ${missing.join(' and ')} must stay open — ` +
          `443 serves the dashboard/API/apps over HTTPS and 80 serves ACME HTTP-01 ` +
          `cert renewal + the HTTP→HTTPS redirect. Removing them would make the ` +
          `cluster unreachable. You can restrict the source IPs, but the ports must ` +
          `stay present.`,
      );
      return;
    }
    this.save.emit(rules);
  }

  discardAllChanges() {
    if (confirm('Discard all unsaved changes?')) {
      this.workingRules.set([...this.originalRules()]);
      this.expandedIndex.set(null);
      this.isAddingNew.set(false);
      this.ruleErrors.set(new Map());
    }
  }

  cancelEditing() {
    if (this.isDirty() && !confirm('You have unsaved changes. Discard them?')) {
      return;
    }
    this.cancelled.emit();
  }

  async detectCurrentIp(isForNewRule: boolean = false) {
    this.detectingIp.set(true);
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      if (data.ip) {
        this.setIpPreset(`${data.ip}/32`, isForNewRule);
      }
    } catch (error) {
      console.error('Failed to detect IP:', error);
      alert('Failed to detect your IP address. Please enter it manually.');
    } finally {
      this.detectingIp.set(false);
    }
  }

  setIpPreset(preset: string, isForNewRule: boolean = false) {
    const direction = isForNewRule ? this.newRuleForm().direction :
                      this.workingRules()[this.expandedIndex()!]?.direction;

    if (direction === 'in') {
      const current = this.sourceIpsText();
      this.sourceIpsText.set(current?.trim() ? `${current}, ${preset}` : preset);
    } else {
      const current = this.destinationIpsText();
      this.destinationIpsText.set(current?.trim() ? `${current}, ${preset}` : preset);
    }
  }

  clearIpField(isForNewRule: boolean = false) {
    const direction = isForNewRule ? this.newRuleForm().direction :
                      this.workingRules()[this.expandedIndex()!]?.direction;

    if (direction === 'in') {
      this.sourceIpsText.set('');
    } else {
      this.destinationIpsText.set('');
    }
  }

  private parseIps(text: string): string[] {
    return text.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
  }

  getRuleSummary(rule: FirewallRuleFormData): string {
    const dir = rule.direction === 'in' ? 'Inbound' : 'Outbound';
    const proto = rule.protocol.toUpperCase();
    const port = rule.port ? `:${rule.port}` : '';

    let ips = '';
    if (rule.direction === 'in' && rule.sourceIps && rule.sourceIps.length > 0) {
      ips = ` • from ${rule.sourceIps.join(', ')}`;
    } else if (rule.direction === 'out' && rule.destinationIps && rule.destinationIps.length > 0) {
      ips = ` • to ${rule.destinationIps.join(', ')}`;
    }

    return `${dir} • ${proto}${port}${ips}`;
  }
}
