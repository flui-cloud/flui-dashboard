import { Component, computed, input, output } from '@angular/core';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { MailDomainProofs } from '../../model/mail-console.models';
import { MailProofPillComponent } from './mail-proof-pill.component';
import { MailTestSendComponent } from './mail-test-send.component';

const PROVIDER_LABELS: Record<string, string> = {
  'scaleway-tem': 'Scaleway',
  brevo: 'Brevo',
  zeptomail: 'ZeptoMail',
  smtp: 'SMTP relay',
};

@Component({
  selector: 'app-mail-domains-table',
  imports: [
    FlTable,
    FlButton,
    FlStatus,
    FlActionsMenu,
    ReadOnlySectionDirective,
    MailProofPillComponent,
    MailTestSendComponent,
  ],
  host: { class: 'block' },
  template: `
    <div class="fl-table-wrap">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">Domain</th>
            <th scope="col">Provider</th>
            <th scope="col">State</th>
            <th scope="col">SPF</th>
            <th scope="col">DKIM</th>
            <th scope="col">DMARC</th>
            <th scope="col">Verification</th>
            <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (d of domains(); track d.domain) {
            <tr>
              <td class="fl-cell-name fl-mono">{{ d.domain }}</td>
              <td>
                {{ providerLabel(d.provider) }}
                <span class="text-fl-ink-muted">· {{ d.scope }}</span>
              </td>
              <td>
                <fl-status
                  [tone]="d.active ? 'success' : 'neutral'"
                  [label]="d.active ? 'Sending' : 'Standby'"
                />
              </td>
              <td><app-mail-proof-pill purpose="spf" [verdict]="d.spf" /></td>
              <td><app-mail-proof-pill purpose="dkim" [verdict]="d.dkim" /></td>
              <td><app-mail-proof-pill purpose="dmarc" [verdict]="d.dmarc" /></td>
              <td>
                @if (d.verified) {
                  <fl-status tone="success" label="Verified" />
                } @else {
                  <fl-status
                    tone="warning"
                    label="Not verified yet"
                    title="Records can be correct and published while the provider has not re-checked them yet. Verification lags DNS by minutes."
                  />
                }
              </td>
              <td class="is-fit">
                <div class="fl-row flex-nowrap">
                  <button
                    flButton="ghost"
                    size="sm"
                    type="button"
                    (click)="toggleTest.emit(d.domain)"
                  >
                    {{ testing() === d.domain ? 'Close test' : 'Test' }}
                  </button>
                  <fl-actions-menu
                    appReadOnlySection="mail"
                    [label]="'Actions for ' + d.domain"
                    [compact]="true"
                    [items]="actions()"
                    (action)="onAction($event, d.domain)"
                  />
                </div>
              </td>
            </tr>
            @if (testing() === d.domain) {
              <tr>
                <td colspan="8" class="whitespace-normal">
                  <app-mail-test-send [domain]="d.domain" />
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
})
export class MailDomainsTable {
  readonly domains = input.required<MailDomainProofs[]>();
  readonly publishing = input(false);
  readonly removing = input(false);
  readonly testing = input<string | null>(null);

  readonly publish = output<string>();
  readonly remove = output<string>();
  readonly toggleTest = output<string>();

  protected readonly actions = computed<MenuAction[]>(() => [
    { id: 'publish', label: 'Re-publish', disabled: this.publishing() },
    {
      id: 'remove',
      label: 'Remove',
      danger: true,
      disabled: this.removing(),
      separatorBefore: true,
    },
  ]);

  protected onAction(id: string, domain: string): void {
    if (id === 'publish') this.publish.emit(domain);
    if (id === 'remove') this.remove.emit(domain);
  }

  protected providerLabel(id: string): string {
    return PROVIDER_LABELS[id] ?? id;
  }
}
