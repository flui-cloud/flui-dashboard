import { Component, computed, input } from '@angular/core';
import { ProviderConfigurationDto, ProviderDefinitionDto } from '../../../core/api';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlStatus } from '../../../ui/primitives/status';
import {
  credentialKind,
  credentialKindLabel,
  formatDateTime,
  providerCapabilities,
} from './provider-presentation';

@Component({
  selector: 'app-provider-details-panel',
  imports: [MaskIdPipe, FlPanel, FlKeyValue, FlKvItem, FlCopyId, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    @if (configuration(); as c) {
      <fl-panel title="Details">
        <fl-key-value>
          <fl-kv-item key="Configuration ID">
            <fl-copy-id [value]="c.id" [display]="c.id | maskId" label="configuration ID" />
          </fl-kv-item>
          <fl-kv-item key="Provider key" [mono]="true">{{ provider().id }}</fl-kv-item>
          <fl-kv-item key="Sign-in">{{ signIn() || '—' }}</fl-kv-item>
          <fl-kv-item key="Active">{{ c.isActive ? 'Yes' : 'No' }}</fl-kv-item>
          <fl-kv-item key="Last update">{{ format(c.updatedAt) }}</fl-kv-item>
          @if (c.lastHealthCheck) {
            <fl-kv-item key="Last check">{{ format(c.lastHealthCheck) }}</fl-kv-item>
          }
        </fl-key-value>
      </fl-panel>
    }
    @if (capabilities().length > 0) {
      <fl-panel title="Capabilities">
        <fl-key-value>
          @for (item of capabilities(); track item.key) {
            <fl-kv-item [key]="item.label" [attr.title]="item.hint">
              <fl-status
                [tone]="item.on ? 'success' : 'neutral'"
                [label]="item.on ? 'Available' : 'Not available'"
                [attr.data-testid]="'capability-' + item.key"
              />
            </fl-kv-item>
          }
        </fl-key-value>
      </fl-panel>
    }
  `,
})
export class ProviderDetailsPanel {
  readonly provider = input.required<ProviderDefinitionDto>();
  readonly configuration = input<ProviderConfigurationDto>();

  protected readonly capabilities = computed(() => providerCapabilities(this.provider()));
  protected readonly signIn = computed(() => credentialKindLabel(credentialKind(this.provider())));

  protected format(value: string | undefined): string {
    return formatDateTime(value);
  }
}
