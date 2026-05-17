import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  FirewallRuleFormData,
  validateFirewallRule
} from '../../model/firewall-v2.models';

/**
 * Inline Rule Editor Component - Progressive Disclosure Pattern
 * Allows editing firewall rules inline without modals or separate forms
 */
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

  @Output() save = new EventEmitter<FirewallRuleFormData[]>();
  @Output() cancelled = new EventEmitter<void>();

  // Three-level state management
  private readonly originalRules = signal<FirewallRuleFormData[]>([]);
  workingRules = signal<FirewallRuleFormData[]>([]);
  expandedIndex = signal<number | null>(null);
  isAddingNew = signal(false);

  // New rule form
  newRuleForm = signal<FirewallRuleFormData>({
    description: '',
    direction: 'in',
    protocol: 'tcp',
    port: '',
    sourceIps: [],
    destinationIps: []
  });

  // Validation
  ruleErrors = signal<Map<number, string[]>>(new Map());
  newRuleErrors = signal<string[]>([]);

  // IP text fields (for editing)
  sourceIpsText = signal('');
  destinationIpsText = signal('');

  // IP Detection
  detectingIp = signal(false);

  // Computed
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

  /**
   * Check if rule is modified
   */
  isRuleModified(index: number): boolean {
    const original = this.originalRules()[index];
    const working = this.workingRules()[index];
    return original && working && JSON.stringify(original) !== JSON.stringify(working);
  }

  /**
   * Start adding a new rule
   */
  startAddNewRule() {
    // Close any expanded rule
    this.expandedIndex.set(null);

    // Reset form
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

  /**
   * Cancel adding new rule
   */
  cancelAddNew() {
    this.isAddingNew.set(false);
    this.newRuleErrors.set([]);
  }

  /**
   * Add new rule to working list
   */
  addNewRule() {
    const form = this.newRuleForm();

    // Parse IPs
    if (form.direction === 'in' && this.sourceIpsText()) {
      form.sourceIps = this.parseIps(this.sourceIpsText());
    }

    if (form.direction === 'out' && this.destinationIpsText()) {
      form.destinationIps = this.parseIps(this.destinationIpsText());
    }

    // Validate
    const errors = validateFirewallRule(form);
    if (errors.length > 0) {
      this.newRuleErrors.set(errors);
      return;
    }

    // Add to working rules
    this.workingRules.update(rules => [{ ...form }, ...rules]);
    this.isAddingNew.set(false);
  }

  /**
   * Expand rule for editing
   */
  expandRule(index: number) {
    // Close add new if open
    this.isAddingNew.set(false);

    const rule = this.workingRules()[index];

    // Set IP text fields
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

  /**
   * Collapse rule (cancel editing)
   */
  collapseRule(index: number) {
    // Revert to original if not yet saved locally
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

  /**
   * Save edited rule (local save to working state)
   */
  saveEditedRule(index: number) {
    const rule = { ...this.workingRules()[index] };

    // Parse IPs from text fields
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

    // Validate
    const errors = validateFirewallRule(rule);
    if (errors.length > 0) {
      this.ruleErrors.update(map => {
        map.set(index, errors);
        return new Map(map);
      });
      return;
    }

    // Update working rules with new reference to trigger signal detection
    this.workingRules.update(rules => {
      const newRules = [...rules];
      newRules[index] = rule;
      return newRules;
    });

    // Clear errors and collapse
    this.ruleErrors.update(map => {
      map.delete(index);
      return new Map(map);
    });
    this.expandedIndex.set(null);
  }

  /**
   * Delete rule
   */
  deleteRule(index: number) {
    if (confirm('Delete this firewall rule?')) {
      this.workingRules.update(rules => rules.filter((_, i) => i !== index));

      // If this was expanded, close it
      if (this.expandedIndex() === index) {
        this.expandedIndex.set(null);
      }
    }
  }

  /**
   * Update rule field
   */
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

  /**
   * Update new rule form field
   */
  updateNewRuleField<K extends keyof FirewallRuleFormData>(
    field: K,
    value: FirewallRuleFormData[K]
  ) {
    this.newRuleForm.update(form => ({ ...form, [field]: value }));
    this.newRuleErrors.set([]);
  }

  /**
   * Save all changes to server
   */
  saveAllChanges() {
    this.save.emit(this.workingRules());
  }

  /**
   * Discard all changes
   */
  discardAllChanges() {
    if (confirm('Discard all unsaved changes?')) {
      this.workingRules.set([...this.originalRules()]);
      this.expandedIndex.set(null);
      this.isAddingNew.set(false);
      this.ruleErrors.set(new Map());
    }
  }

  /**
   * Cancel editing (go back)
   */
  cancelEditing() {
    if (this.isDirty() && !confirm('You have unsaved changes. Discard them?')) {
      return;
    }
    this.cancelled.emit();
  }

  /**
   * Detect current IP
   */
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

  /**
   * Set IP preset
   */
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

  /**
   * Clear IP field
   */
  clearIpField(isForNewRule: boolean = false) {
    const direction = isForNewRule ? this.newRuleForm().direction :
                      this.workingRules()[this.expandedIndex()!]?.direction;

    if (direction === 'in') {
      this.sourceIpsText.set('');
    } else {
      this.destinationIpsText.set('');
    }
  }

  /**
   * Parse IPs from comma-separated text
   */
  private parseIps(text: string): string[] {
    return text.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
  }

  /**
   * Get rule summary for collapsed view
   */
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
