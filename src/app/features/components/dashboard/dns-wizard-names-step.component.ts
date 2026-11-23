import { Component, inject } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideRotateCcw } from '@ng-icons/lucide';
import {
  DnsSetupWizardService,
  SYSTEM_APP_TITLES,
  SystemNameRow,
} from './dns-setup-wizard.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-dns-wizard-names-step',
  imports: [FlAlert, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideRotateCcw })],
  host: { class: 'fl-stack' },
  template: `
    <p class="m-0 text-fl-body-sm text-fl-ink-muted">
      Choose the addresses of the platform. Keep the suggested names or change them.
    </p>

    @if (wiz.loadingNames()) {
      <div
        class="flex items-center gap-2 text-fl-body-sm text-fl-ink-muted"
        data-testid="names-loading"
      >
        <fl-spinner label="Loading names" />
        Loading the suggested names…
      </div>
    } @else {
      <div class="flex flex-col gap-4">
        @for (row of wiz.systemNames(); track row.app) {
          <div
            class="fl-field"
            [class.is-invalid]="!!row.error"
            [attr.data-testid]="'name-row-' + row.app"
          >
            <label class="fl-field__label" [attr.for]="'name-' + row.app">{{ title(row) }}</label>
            <div class="flex items-center gap-2">
              <div class="fl-input fl-input--lg fl-mono flex-1">
                <input
                  type="text"
                  [id]="'name-' + row.app"
                  [value]="row.label"
                  (input)="wiz.setSystemName(row.app, $any($event.target).value)"
                  [disabled]="wiz.checkingNames()"
                  autocomplete="off"
                  spellcheck="false"
                  [attr.aria-invalid]="!!row.error"
                  [attr.data-testid]="'name-input-' + row.app"
                />
                <span class="whitespace-nowrap">.{{ wiz.namesZoneName() }}</span>
              </div>
              @if (row.label !== row.defaultLabel) {
                <button
                  flButton="ghost"
                  size="sm"
                  [iconOnly]="true"
                  type="button"
                  (click)="wiz.setSystemName(row.app, row.defaultLabel)"
                  [attr.aria-label]="'Back to ' + row.defaultLabel"
                  [title]="'Back to ' + row.defaultLabel"
                  [attr.data-testid]="'name-reset-' + row.app"
                >
                  <fl-icon name="lucideRotateCcw" />
                </button>
              }
            </div>
            @if (row.error) {
              <span class="fl-field__error" [attr.data-testid]="'name-error-' + row.app">
                {{ row.error }}
              </span>
            }
          </div>
        }
      </div>

      @if (wiz.namesError()) {
        <fl-alert tone="error" title="Addresses not available" data-testid="names-error">
          {{ wiz.namesError() }}
        </fl-alert>
      }
    }
  `,
})
export class DnsWizardNamesStepComponent {
  protected wiz = inject(DnsSetupWizardService);

  protected title(row: SystemNameRow): string {
    return SYSTEM_APP_TITLES[row.app] ?? row.app;
  }
}
