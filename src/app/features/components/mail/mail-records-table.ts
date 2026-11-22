import { Component, computed, input } from '@angular/core';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlTable } from '../../../ui/patterns/table';
import { MailRecordRowComponent } from './mail-record-row.component';
import { MailDnsRecord, recordCaution } from './mail-records';

@Component({
  selector: 'app-mail-records-table',
  imports: [FlTable, FlAlert, MailRecordRowComponent],
  host: { class: 'flex flex-col gap-3' },
  template: `
    <div class="fl-table-wrap rounded-fl-md border border-fl-border">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">Purpose</th>
            <th scope="col">Host</th>
            @if (showValues()) {
              <th scope="col">Value</th>
            }
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          @for (record of records(); track record.name + record.kind + record.value) {
            <tr app-mail-record-row [record]="record" [showValue]="showValues()"></tr>
          }
        </tbody>
      </table>
    </div>
    @for (note of cautions(); track note.key) {
      <fl-alert tone="warning" [title]="note.title">{{ note.text }}</fl-alert>
    }
  `,
})
export class MailRecordsTable {
  readonly records = input.required<readonly MailDnsRecord[]>();
  readonly showValues = input(true);

  protected readonly cautions = computed(() =>
    this.records().flatMap((record) => {
      const text = recordCaution(record);
      return text
        ? [
            {
              key: record.name + record.kind,
              title: `Before you publish the ${record.kind} record for ${record.name}`,
              text,
            },
          ]
        : [];
    }),
  );
}
