import { Component, input, output } from '@angular/core';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';

export type ValidationStatus = 'idle' | 'validating' | 'success' | 'error' | 'skipped';

export interface WizardRegion {
  id: string;
  name?: string;
  displayName?: string;
  available?: boolean;
}

@Component({
  selector: 'app-provider-wizard-check',
  imports: [FlAlert, FlButton, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    @switch (status()) {
      @case ('skipped') {
        <div class="fl-stack" data-testid="wizard-demo-check">
          <fl-status tone="neutral" label="Connection check" />
          <p class="text-fl-body-sm text-fl-ink-muted">
            Here Flui tests the credentials against {{ providerName() }}. In the demo nothing is
            sent.
          </p>
          @if (regions().length > 0) {
            <p class="text-fl-body-sm text-fl-ink-muted">
              {{ regions().length }} regions to choose from next.
            </p>
          }
        </div>
      }
      @case ('validating') {
        <fl-status tone="progress" [label]="'Testing the connection to ' + providerName()" />
      }
      @case ('success') {
        <fl-status tone="success" label="Connection successful" />
        <p class="text-fl-body-sm text-fl-ink-muted">
          Your credentials are valid and the connection works.
        </p>
        @if (regions().length > 0) {
          <div class="flex flex-col gap-2">
            <span class="text-fl-caption text-fl-ink-muted">Regions detected</span>
            <ul class="grid grid-cols-1 gap-1 text-fl-body-sm sm:grid-cols-2">
              @for (region of regions(); track region.id) {
                <li>
                  {{ region.displayName || region.name }}
                  <span class="fl-mono text-fl-ink-muted">{{ region.id }}</span>
                </li>
              }
            </ul>
          </div>
        }
      }
      @case ('error') {
        <fl-alert tone="error" title="Validation failed">
          {{ error() || 'Unable to connect with the provided credentials.' }}
          <button alertActions flButton size="sm" type="button" (click)="retry.emit()">
            Retry validation
          </button>
        </fl-alert>
      }
    }
  `,
})
export class ProviderWizardCheck {
  readonly status = input.required<ValidationStatus>();
  readonly error = input('');
  readonly providerName = input.required<string>();
  readonly regions = input<WizardRegion[]>([]);
  readonly retry = output<void>();
}
