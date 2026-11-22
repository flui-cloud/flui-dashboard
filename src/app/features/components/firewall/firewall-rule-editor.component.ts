import { Component, Input, Output, EventEmitter, signal, computed, inject } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideShield } from '@ng-icons/lucide';
import { FirewallRuleFormData, validateFirewallRule } from '../../model/firewall-v2.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FirewallRuleForm, RuleFieldChange } from './firewall-rule-form';
import { ruleCidrs, ruleDirection, rulePort, ruleProtocol, ruleSummary } from './firewall-format';

const RULE_ACTIONS: MenuAction[] = [
  { id: 'edit', label: 'Edit rule' },
  { id: 'delete', label: 'Delete rule', danger: true, separatorBefore: true },
];

/**
 * Firewall Rule Editor Component
 * Allows users to add, edit, and delete firewall rules
 */
@Component({
  selector: 'app-firewall-rule-editor',
  imports: [FlPanel, FlTable, FlAlert, FlEmptyState, FlButton, FlActionsMenu, FirewallRuleForm],
  providers: [provideIcons({ lucideShield })],
  host: { class: 'fl-stack' },
  templateUrl: './firewall-rule-editor.component.html',
})
export class FirewallRuleEditorComponent {
  private readonly confirmService = inject(ConfirmService);

  protected readonly ruleActions = RULE_ACTIONS;
  protected readonly direction = ruleDirection;
  protected readonly protocol = ruleProtocol;
  protected readonly port = rulePort;
  protected readonly cidrs = ruleCidrs;

  @Input() set initialRules(rules: FirewallRuleFormData[] | null) {
    if (rules) {
      this.rules.set([...rules]);
    }
  }

  @Output() save = new EventEmitter<FirewallRuleFormData[]>();
  @Output() cancelled = new EventEmitter<void>();

  rules = signal<FirewallRuleFormData[]>([]);
  editingIndex = signal<number | null>(null);
  showAddForm = signal(false);

  editForm = signal<FirewallRuleFormData>({
    description: '',
    direction: 'in',
    protocol: 'tcp',
    port: '',
    sourceIps: [],
    destinationIps: [],
  });

  validationErrors = signal<string[]>([]);
  sourceIpsText = signal('');
  destinationIpsText = signal('');

  detectedIp = signal<string | null>(null);
  detectingIp = signal(false);
  notice = signal<string | null>(null);

  hasChanges = computed(() => {
    return this.rules().length > 0 || this.showAddForm() || this.editingIndex() !== null;
  });

  isFormValid = computed(() => {
    const form = { ...this.editForm() };
    if (form.direction === 'in' && this.sourceIpsText()) {
      form.sourceIps = this.sourceIpsText()
        .split(',')
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0);
    }

    if (form.direction === 'out' && this.destinationIpsText()) {
      form.destinationIps = this.destinationIpsText()
        .split(',')
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0);
    }

    const errors = validateFirewallRule(form);
    return errors.length === 0;
  });

  startAddRule() {
    this.resetForm();
    this.showAddForm.set(true);
    this.editingIndex.set(null);
  }

  startEditRule(index: number) {
    const rule = this.rules()[index];
    this.editForm.set({
      ...rule,
      sourceIps: rule.sourceIps ? [...rule.sourceIps] : [],
      destinationIps: rule.destinationIps ? [...rule.destinationIps] : [],
    });
    if (rule.sourceIps && rule.sourceIps.length > 0) {
      this.sourceIpsText.set(rule.sourceIps.join(', '));
    }
    if (rule.destinationIps && rule.destinationIps.length > 0) {
      this.destinationIpsText.set(rule.destinationIps.join(', '));
    }

    this.editingIndex.set(index);
    this.showAddForm.set(true);
  }

  onRuleAction(index: number, action: string) {
    if (action === 'edit') this.startEditRule(index);
    if (action === 'delete') void this.deleteRule(index);
  }

  onField(change: RuleFieldChange) {
    this.updateField(change.field, change.value);
  }

  setIpsText(text: string) {
    if (this.editForm().direction === 'in') this.sourceIpsText.set(text);
    else this.destinationIpsText.set(text);
  }

  async deleteRule(index: number) {
    const ok = await this.confirmService.confirm({
      title: 'Delete this rule?',
      body: `${this.rules()[index]?.description || 'The rule'} is removed from the rules you are editing.`,
      confirmLabel: 'Delete rule',
      destructive: true,
    });
    if (ok) {
      this.rules.update((rules) => rules.filter((_, i) => i !== index));
    }
  }

  saveRule() {
    const form = this.editForm();

    if (form.direction === 'in' && this.sourceIpsText()) {
      form.sourceIps = this.sourceIpsText()
        .split(',')
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0);
    }

    if (form.direction === 'out' && this.destinationIpsText()) {
      form.destinationIps = this.destinationIpsText()
        .split(',')
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0);
    }
    const errors = validateFirewallRule(form);
    if (errors.length > 0) {
      this.validationErrors.set(errors);
      return;
    }

    const editIndex = this.editingIndex();
    if (editIndex === null) {
      this.rules.update((rules) => [...rules, { ...form }]);
    } else {
      this.rules.update((rules) => {
        const newRules = [...rules];
        newRules[editIndex] = { ...form };
        return newRules;
      });
    }

    this.cancelEdit();
  }

  cancelEdit() {
    this.showAddForm.set(false);
    this.editingIndex.set(null);
    this.resetForm();
  }

  private resetForm() {
    this.editForm.set({
      description: '',
      direction: 'in',
      protocol: 'tcp',
      port: '',
      sourceIps: [],
      destinationIps: [],
    });
    this.sourceIpsText.set('');
    this.destinationIpsText.set('');
    this.validationErrors.set([]);
  }

  updateField<K extends keyof FirewallRuleFormData>(field: K, value: FirewallRuleFormData[K]) {
    this.editForm.update((form) => ({ ...form, [field]: value }));
    this.validationErrors.set([]);
  }

  saveAllRules() {
    this.save.emit(this.rules());
  }

  async cancelAllChanges() {
    if (this.hasChanges()) {
      const ok = await this.confirmService.confirm({
        title: 'Discard unsaved changes?',
        body: 'All unsaved changes are lost.',
        confirmLabel: 'Discard changes',
        destructive: true,
      });
      if (!ok) return;
    }
    this.cancelled.emit();
  }

  getRuleSummary(rule: FirewallRuleFormData): string {
    return ruleSummary(rule);
  }

  async detectCurrentIp() {
    this.detectingIp.set(true);
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      if (data.ip) {
        this.detectedIp.set(data.ip);
        this.setIpPreset(`${data.ip}/32`);
      }
    } catch (error) {
      console.error('Failed to detect IP:', error);
      this.notice.set('Enter it manually.');
    } finally {
      this.detectingIp.set(false);
    }
  }

  setIpPreset(preset: string) {
    const direction = this.editForm().direction;

    if (direction === 'in') {
      const current = this.sourceIpsText();
      if (current && current.trim().length > 0) {
        this.sourceIpsText.set(`${current}, ${preset}`);
      } else {
        this.sourceIpsText.set(preset);
      }
    } else {
      const current = this.destinationIpsText();
      if (current && current.trim().length > 0) {
        this.destinationIpsText.set(`${current}, ${preset}`);
      } else {
        this.destinationIpsText.set(preset);
      }
    }
  }

  clearIpField() {
    const direction = this.editForm().direction;
    if (direction === 'in') {
      this.sourceIpsText.set('');
    } else {
      this.destinationIpsText.set('');
    }
  }

  getCurrentIpText(): string {
    const direction = this.editForm().direction;
    return direction === 'in' ? this.sourceIpsText() : this.destinationIpsText();
  }
}
