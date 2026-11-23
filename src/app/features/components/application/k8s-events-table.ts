import { Component, input } from '@angular/core';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus } from '../../../ui/primitives/status';

export interface K8sEventRow {
  type: string;
  reason: string;
  message: string;
  count: number;
  lastTimestamp?: string;
}

@Component({
  selector: 'app-k8s-events-table',
  imports: [FlTable, FlStatus],
  host: { class: 'fl-table-wrap block' },
  template: `
    <table flTable density="dense">
      <thead>
        <tr>
          <th scope="col" class="is-fit">Type</th>
          <th scope="col" class="is-fit">Reason</th>
          <th scope="col">Message</th>
          <th scope="col" class="is-num is-fit">Count</th>
          <th scope="col" class="is-fit">Last seen</th>
        </tr>
      </thead>
      <tbody>
        @for (ev of events(); track $index) {
          <tr class="align-top">
            <td>
              <fl-status [tone]="ev.type === 'Warning' ? 'warning' : 'neutral'" [label]="ev.type" />
            </td>
            <td class="fl-mono">{{ ev.reason }}</td>
            <td class="whitespace-normal break-words">{{ ev.message }}</td>
            <td class="is-num">
              {{ ev.count }}
              @if (ev.count > 10) {
                <span class="block text-fl-caption text-fl-ink-muted">Repeated</span>
              }
            </td>
            <td class="text-fl-ink-muted">
              {{ ev.lastTimestamp ? formatDate(ev.lastTimestamp) : '—' }}
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class K8sEventsTable {
  readonly events = input.required<readonly K8sEventRow[]>();

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-GB');
  }
}
