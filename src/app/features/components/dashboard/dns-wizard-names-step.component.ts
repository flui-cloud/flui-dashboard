import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideRotateCcw } from '@ng-icons/lucide';
import { DnsSetupWizardService, SYSTEM_APP_TITLES, SystemNameRow } from './dns-setup-wizard.service';

@Component({
  selector: 'app-dns-wizard-names-step',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideLoader, lucideRotateCcw })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <h3 class="text-sm font-semibold text-foreground mb-1">Choose the addresses</h3>
    <p class="text-xs text-muted-foreground mb-4">Keep the suggested names or change them.</p>

    @if (wiz.loadingNames()) {
      <div class="flex-1 flex items-center justify-center py-6" data-testid="names-loading">
        <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    } @else {
      <div class="flex flex-col gap-3 p-2">
        @for (row of wiz.systemNames(); track row.app) {
          <div [attr.data-testid]="'name-row-' + row.app">
            <label class="text-xs font-medium text-foreground block mb-1" [attr.for]="'name-' + row.app">{{ title(row) }}</label>
            <div class="flex items-stretch">
              <input
                type="text"
                [id]="'name-' + row.app"
                [value]="row.label"
                (input)="wiz.setSystemName(row.app, $any($event.target).value)"
                [disabled]="wiz.checkingNames()"
                autocomplete="off"
                spellcheck="false"
                [attr.data-testid]="'name-input-' + row.app"
                class="flex-1 min-w-0 px-3 py-1.5 border rounded-l-md bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                [class.border-destructive]="row.error"
              />
              <span class="inline-flex items-center px-2 py-1.5 border border-l-0 rounded-r-md bg-muted text-sm text-muted-foreground font-mono whitespace-nowrap select-none">
                .{{ wiz.namesZoneName() }}
              </span>
              @if (row.label !== row.defaultLabel) {
                <button
                  type="button"
                  (click)="wiz.setSystemName(row.app, row.defaultLabel)"
                  [title]="'Back to ' + row.defaultLabel"
                  [attr.data-testid]="'name-reset-' + row.app"
                  class="ml-1 px-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" />
                </button>
              }
            </div>
            @if (row.error) {
              <p class="mt-1 text-xs text-destructive" [attr.data-testid]="'name-error-' + row.app">{{ row.error }}</p>
            }
          </div>
        }

        @if (wiz.namesError()) {
          <p class="text-xs text-destructive" data-testid="names-error">{{ wiz.namesError() }}</p>
        }
      </div>
    }
  `,
})
export class DnsWizardNamesStepComponent {
  protected wiz = inject(DnsSetupWizardService);

  protected title(row: SystemNameRow): string {
    return SYSTEM_APP_TITLES[row.app] ?? row.app;
  }
}
