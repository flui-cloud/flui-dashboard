import { Component, input } from '@angular/core';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlStatus } from '../../../ui/primitives/status';
import { MailConnectResult } from '../../model/mail-console.models';
import { MailRecordsTable } from './mail-records-table';

@Component({
  selector: 'app-mail-connect-result',
  imports: [FlAlert, FlPanel, FlStatus, MailRecordsTable],
  host: { class: 'block' },
  template: `
    @let r = result();
    <fl-panel [title]="r.connection.label + ' is connected'">
      <fl-status
        panelActions
        [tone]="r.activated ? 'success' : 'neutral'"
        [label]="r.activated ? 'Sending' : 'Not sending yet'"
      />
      <div class="flex flex-col gap-3 text-fl-body-sm">
        <p class="m-0 text-fl-ink-muted">
          {{
            r.activated
              ? 'It is now carrying ' + r.connection.scope + ' mail.'
              : 'It is not sending yet: another provider still holds the scope. Choose Send through this one on its row when you are ready.'
          }}
        </p>

        @if (r.domain?.published?.length) {
          <p class="m-0 text-fl-ink-muted">
            Published {{ r.domain!.published.length }} DNS record(s).
            {{
              r.domain!.verified
                ? 'The provider has confirmed the domain.'
                : 'Waiting for the provider to confirm it, which lags DNS by minutes.'
            }}
          </p>
        }

        @if (r.manualSteps.length) {
          <fl-alert tone="warning" title="Left for you">
            <ul class="m-0 list-disc pl-4">
              @for (step of r.manualSteps; track step) {
                <li>{{ step }}</li>
              }
            </ul>
          </fl-alert>
        }

        @if (r.domain?.outstanding?.length && !r.domain!.canWrite) {
          <p class="m-0 text-fl-ink-muted">
            Flui does not hold this zone. Publish these where it is hosted:
          </p>
          <app-mail-records-table [records]="r.domain!.outstanding" />
        }
      </div>
    </fl-panel>
  `,
})
export class MailConnectResultPanel {
  readonly result = input.required<MailConnectResult>();
}
