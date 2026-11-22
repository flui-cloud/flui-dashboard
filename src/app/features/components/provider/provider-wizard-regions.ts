import { Component, input, output } from '@angular/core';
import { FlStatus } from '../../../ui/primitives/status';
import { WizardRegion } from './provider-wizard-check';

@Component({
  selector: 'app-provider-wizard-regions',
  imports: [FlStatus],
  host: { class: 'fl-stack' },
  template: `
    <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
      @for (region of regions(); track region.id) {
        <label class="fl-radiocard" [attr.data-testid]="'wizard-region-' + region.id">
          <input
            type="checkbox"
            [checked]="selected().includes(region.id)"
            (change)="toggled.emit(region.id)"
          />
          <span class="fl-radiocard__text min-w-0 flex-1">
            <span class="fl-radiocard__title truncate">{{
              region.displayName || region.name
            }}</span>
            <span class="fl-radiocard__desc fl-mono">{{ region.id }}</span>
          </span>
          @if (region.available === false) {
            <fl-status tone="neutral" label="Unavailable" />
          }
        </label>
      }
    </div>
    @if (selected().length === 0) {
      <fl-status tone="warning" label="Pick at least one region to continue." />
    }
  `,
})
export class ProviderWizardRegions {
  readonly regions = input.required<WizardRegion[]>();
  readonly selected = input.required<string[]>();
  readonly toggled = output<string>();
}
