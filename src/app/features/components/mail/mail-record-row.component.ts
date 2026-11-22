import { Component, computed, input } from '@angular/core';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlStatus } from '../../../ui/primitives/status';
import { MailDnsRecord, mxParts, recordPurpose, recordStatus } from './mail-records';

export type OutstandingRecord = MailDnsRecord;

@Component({
  selector: 'tr[app-mail-record-row]',
  imports: [FlCopyId, FlStatus],
  template: `
    <td class="fl-mono">{{ record().kind }}</td>
    <td>{{ purpose() }}</td>
    <td class="is-wrap break-all">
      <fl-copy-id [value]="record().name" label="host" />
    </td>
    @if (showValue()) {
      <td class="is-wrap break-all">
        @if (mx(); as parts) {
          <span class="fl-mono text-fl-ink-muted">{{ parts.priority }}</span>
          <fl-copy-id [value]="parts.host" label="value" />
        } @else {
          <fl-copy-id [value]="record().value" label="value" />
        }
      </td>
    }
    <td>
      <fl-status [tone]="status().tone" [label]="status().label" />
    </td>
  `,
})
export class MailRecordRowComponent {
  readonly record = input.required<OutstandingRecord>();
  readonly showValue = input(true);

  protected readonly purpose = computed(() => recordPurpose(this.record()));
  protected readonly mx = computed(() => mxParts(this.record()));
  protected readonly status = computed(() => recordStatus(this.record()));
}
