import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import {
  MailDomainSummary,
  MailSenderSummary,
  SENDER_STATUS_LABEL,
  formatCount,
  formatRate,
} from '../../model/mail-console.models';
import { MailProofPillComponent } from './mail-proof-pill.component';
import { shortWhen } from './mail-format';

const SENDER_TONE: Record<MailSenderSummary['status'], StatusTone> = {
  delivering: 'success',
  degraded: 'warning',
  failing: 'error',
  silent: 'neutral',
};

@Component({
  selector: 'app-mail-overview-domains',
  imports: [
    RouterLink,
    FlPanel,
    FlTable,
    FlAlert,
    FlEmptyState,
    FlButton,
    FlStatus,
    MailProofPillComponent,
  ],
  host: { class: 'block' },
  template: `
    <fl-panel title="Domains" [count]="domains().length" [flush]="true">
      <a panelActions flButton="ghost" size="sm" routerLink="/management/mail/domains">Manage</a>
      @if (unregistered().length) {
        <div class="border-b border-fl-border p-4">
          <fl-alert tone="warning" title="Mail is going out from a domain not registered here">
            {{ unregistered().join(', ') }} is not registered here, so nothing has checked its
            records.
          </fl-alert>
        </div>
      }
      @if (!domains().length) {
        <fl-empty-state
          [compact]="true"
          title="No sending domain yet"
          body="Register one to start sending."
        >
          <a flButton size="sm" routerLink="/management/mail/setup">Set one up</a>
        </fl-empty-state>
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Domain</th>
                <th scope="col">SPF</th>
                <th scope="col">DKIM</th>
                <th scope="col">DMARC</th>
                <th scope="col">Verification</th>
                <th scope="col" class="is-num">Sent</th>
              </tr>
            </thead>
            <tbody>
              @for (d of domains(); track d.domain) {
                <tr>
                  <td class="fl-mono">{{ d.domain }}</td>
                  <td><app-mail-proof-pill purpose="spf" [verdict]="d.spf" /></td>
                  <td><app-mail-proof-pill purpose="dkim" [verdict]="d.dkim" /></td>
                  <td><app-mail-proof-pill purpose="dmarc" [verdict]="d.dmarc" /></td>
                  <td>
                    @if (d.verified) {
                      <fl-status tone="success" label="Verified" title="Verified by the provider" />
                    } @else {
                      <fl-status
                        tone="warning"
                        label="Not verified"
                        title="Records may be right; the provider has not re-checked yet."
                      />
                    }
                  </td>
                  <td class="is-num">{{ count(d.sent) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class MailOverviewDomains {
  readonly domains = input.required<MailDomainSummary[]>();
  readonly unregistered = input<string[]>([]);

  protected count(n: number): string {
    return formatCount(n);
  }
}

@Component({
  selector: 'app-mail-overview-senders',
  imports: [FlPanel, FlTable, FlEmptyState, FlStatus],
  host: { class: 'block' },
  template: `
    <fl-panel title="Senders" [count]="senders().length" [flush]="true">
      <span panelActions class="fl-toolbar__info">By the address mail was sent from</span>
      @if (!senders().length) {
        <fl-empty-state [compact]="true" title="Nothing has sent mail in this window" />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Sender</th>
                <th scope="col" class="is-num">Sent</th>
                <th scope="col" class="is-num">Delivered</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (row of senders(); track row.from) {
                <tr>
                  <td class="fl-cell-name">
                    <div class="flex min-w-0 flex-col">
                      <span class="truncate">{{ name(row) }}</span>
                      @if (row.application) {
                        <span class="fl-mono truncate text-fl-ink-muted">{{ row.from }}</span>
                      }
                      @if (row.lastError) {
                        <span class="fl-mono truncate text-fl-ink-muted" [title]="row.lastError">{{
                          row.lastError
                        }}</span>
                      }
                    </div>
                  </td>
                  <td class="is-num">{{ count(row.sent) }}</td>
                  <td class="is-num">{{ rate(row.deliveredRate) }}</td>
                  <td>
                    <fl-status
                      [tone]="tone(row)"
                      [label]="statusLabel(row)"
                      [attr.title]="statusHint(row)"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class MailOverviewSenders {
  readonly senders = input.required<MailSenderSummary[]>();

  protected count(n: number): string {
    return formatCount(n);
  }

  protected rate(r: number | null): string {
    return formatRate(r);
  }

  protected name(row: MailSenderSummary): string {
    return row.application?.applicationName ?? row.from;
  }

  protected tone(row: MailSenderSummary): StatusTone {
    return SENDER_TONE[row.status];
  }

  protected statusLabel(row: MailSenderSummary): string {
    return SENDER_STATUS_LABEL[row.status];
  }

  protected statusHint(row: MailSenderSummary): string {
    switch (row.status) {
      case 'failing':
        return 'Sent, delivered nothing.';
      case 'degraded':
        return `${row.failed} of ${row.sent} failed.`;
      case 'silent':
        return 'Configured to send and has sent nothing — the state a provider cannot report.';
      default:
        return row.lastDeliveredAt ? `Last delivered ${shortWhen(row.lastDeliveredAt)}` : '';
    }
  }
}
