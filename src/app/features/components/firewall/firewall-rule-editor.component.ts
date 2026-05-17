import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  FirewallRuleFormData,
  validateFirewallRule
} from '../../model/firewall-v2.models';

/**
 * Firewall Rule Editor Component
 * Allows users to add, edit, and delete firewall rules
 */
@Component({
  selector: 'app-firewall-rule-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './firewall-rule-editor.component.html',
  styleUrls: ['./firewall-rule-editor.component.scss']
})
export class FirewallRuleEditorComponent {
  @Input() set initialRules(rules: FirewallRuleFormData[] | null) {
    if (rules) {
      this.rules.set([...rules]);
    }
  }

  @Output() save = new EventEmitter<FirewallRuleFormData[]>();
  @Output() cancelled = new EventEmitter<void>();

  // State
  rules = signal<FirewallRuleFormData[]>([]);
  editingIndex = signal<number | null>(null);
  showAddForm = signal(false);

  // Form for new/editing rule
  editForm = signal<FirewallRuleFormData>({
    description: '',
    direction: 'in',
    protocol: 'tcp',
    port: '',
    sourceIps: [],
    destinationIps: []
  });

  // Validation
  validationErrors = signal<string[]>([]);
  sourceIpsText = signal('');
  destinationIpsText = signal('');

  // IP Detection
  detectedIp = signal<string | null>(null);
  detectingIp = signal(false);

  // Computed
  hasChanges = computed(() => {
    return this.rules().length > 0 || this.showAddForm() || this.editingIndex() !== null;
  });

  isFormValid = computed(() => {
    // Create a temporary form with parsed IPs for validation
    const form = { ...this.editForm() };

    // Parse IPs from text fields
    if (form.direction === 'in' && this.sourceIpsText()) {
      form.sourceIps = this.sourceIpsText()
        .split(',')
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0);
    }

    if (form.direction === 'out' && this.destinationIpsText()) {
      form.destinationIps = this.destinationIpsText()
        .split(',')
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0);
    }

    const errors = validateFirewallRule(form);
    return errors.length === 0;
  });

  /**
   * Start adding a new rule
   */
  startAddRule() {
    this.resetForm();
    this.showAddForm.set(true);
    this.editingIndex.set(null);
  }

  /**
   * Start editing an existing rule
   */
  startEditRule(index: number) {
    const rule = this.rules()[index];
    this.editForm.set({
      ...rule,
      sourceIps: rule.sourceIps ? [...rule.sourceIps] : [],
      destinationIps: rule.destinationIps ? [...rule.destinationIps] : []
    });

    // Set IPs as text for editing
    if (rule.sourceIps && rule.sourceIps.length > 0) {
      this.sourceIpsText.set(rule.sourceIps.join(', '));
    }
    if (rule.destinationIps && rule.destinationIps.length > 0) {
      this.destinationIpsText.set(rule.destinationIps.join(', '));
    }

    this.editingIndex.set(index);
    this.showAddForm.set(true);
  }

  /**
   * Delete a rule
   */
  deleteRule(index: number) {
    if (confirm('Are you sure you want to delete this rule?')) {
      this.rules.update(rules => rules.filter((_, i) => i !== index));
    }
  }


  /**
   * Save the current form (add or update)
   */
  saveRule() {
    // Parse IPs from text
    const form = this.editForm();

    if (form.direction === 'in' && this.sourceIpsText()) {
      form.sourceIps = this.sourceIpsText()
        .split(',')
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0);
    }

    if (form.direction === 'out' && this.destinationIpsText()) {
      form.destinationIps = this.destinationIpsText()
        .split(',')
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0);
    }

    // Validate
    const errors = validateFirewallRule(form);
    if (errors.length > 0) {
      this.validationErrors.set(errors);
      return;
    }

    const editIndex = this.editingIndex();
    if (editIndex === null) {
      // Add new rule
      this.rules.update(rules => [...rules, { ...form }]);
    } else {
      // Update existing rule
      this.rules.update(rules => {
        const newRules = [...rules];
        newRules[editIndex] = { ...form };
        return newRules;
      });
    }

    this.cancelEdit();
  }

  /**
   * Cancel editing/adding
   */
  cancelEdit() {
    this.showAddForm.set(false);
    this.editingIndex.set(null);
    this.resetForm();
  }

  /**
   * Reset the edit form
   */
  private resetForm() {
    this.editForm.set({
      description: '',
      direction: 'in',
      protocol: 'tcp',
      port: '',
      sourceIps: [],
      destinationIps: []
    });
    this.sourceIpsText.set('');
    this.destinationIpsText.set('');
    this.validationErrors.set([]);
  }

  /**
   * Update form field
   */
  updateField<K extends keyof FirewallRuleFormData>(field: K, value: FirewallRuleFormData[K]) {
    this.editForm.update(form => ({ ...form, [field]: value }));

    // Clear validation errors when user makes changes
    this.validationErrors.set([]);
  }

  /**
   * Save all rules
   */
  saveAllRules() {
    this.save.emit(this.rules());
  }

  /**
   * Cancel all changes
   */
  cancelAllChanges() {
    if (this.hasChanges() && !confirm('Are you sure? All unsaved changes will be lost.')) {
      return;
    }
    this.cancelled.emit();
  }

  /**
   * Get rule summary for display
   */
  getRuleSummary(rule: FirewallRuleFormData): string {
    const dir = rule.direction === 'in' ? 'Inbound' : 'Outbound';
    const proto = rule.protocol.toUpperCase();
    const port = rule.port ? `:${rule.port}` : '';

    let ips = '';
    if (rule.direction === 'in' && rule.sourceIps && rule.sourceIps.length > 0) {
      ips = ` from ${rule.sourceIps.join(', ')}`;
    } else if (rule.direction === 'out' && rule.destinationIps && rule.destinationIps.length > 0) {
      ips = ` to ${rule.destinationIps.join(', ')}`;
    }

    return `${dir} • ${proto}${port}${ips}`;
  }

  /**
   * Detect current user's public IP address
   */
  async detectCurrentIp() {
    this.detectingIp.set(true);
    try {
      // Use a public IP detection service
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      if (data.ip) {
        this.detectedIp.set(data.ip);
        // Auto-apply with /32 (single IP)
        this.setIpPreset(`${data.ip}/32`);
      }
    } catch (error) {
      console.error('Failed to detect IP:', error);
      alert('Failed to detect your IP address. Please enter it manually.');
    } finally {
      this.detectingIp.set(false);
    }
  }

  /**
   * Set IP preset (helper for quick IP entry)
   */
  setIpPreset(preset: string) {
    const direction = this.editForm().direction;

    if (direction === 'in') {
      // Append to existing source IPs or replace
      const current = this.sourceIpsText();
      if (current && current.trim().length > 0) {
        // Append
        this.sourceIpsText.set(`${current}, ${preset}`);
      } else {
        // Replace
        this.sourceIpsText.set(preset);
      }
    } else {
      // Append to existing destination IPs or replace
      const current = this.destinationIpsText();
      if (current && current.trim().length > 0) {
        // Append
        this.destinationIpsText.set(`${current}, ${preset}`);
      } else {
        // Replace
        this.destinationIpsText.set(preset);
      }
    }
  }

  /**
   * Clear IP field
   */
  clearIpField() {
    const direction = this.editForm().direction;
    if (direction === 'in') {
      this.sourceIpsText.set('');
    } else {
      this.destinationIpsText.set('');
    }
  }

  /**
   * Get current IP text based on direction
   */
  getCurrentIpText(): string {
    const direction = this.editForm().direction;
    return direction === 'in' ? this.sourceIpsText() : this.destinationIpsText();
  }
}
