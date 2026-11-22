import { Component, computed, input } from '@angular/core';
import { PlatformUpdateOperation } from '../../service/platform-update.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { elapsed, historyDetail, historyWhen, operationStatus } from './platform-update-format';

@Component({
  selector: 'app-platform-update-history',
  imports: [FlPanel, FlTable, FlEmptyState, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Update history" [count]="operations().length" [flush]="true">
      @if (rows().length === 0) {
        <fl-empty-state
          [compact]="true"
          title="No platform updates yet"
          body="Every platform update attempted on this installation is listed here, newest first."
        />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Outcome</th>
                <th scope="col">Release</th>
                <th scope="col">Detail</th>
                <th scope="col" class="is-num">Duration</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr>
                  <td><fl-status [tone]="row.tone" [label]="row.label" /></td>
                  <td class="fl-mono">
                    <span class="text-fl-ink-muted">{{ row.from }}</span> → {{ row.to }}
                  </td>
                  <td class="text-fl-ink-secondary">
                    <span class="fl-cell-clip" [title]="row.detail">{{ row.detail }}</span>
                  </td>
                  <td class="fl-mono is-num text-fl-ink-secondary">{{ row.duration }}</td>
                  <td class="fl-num text-fl-ink-secondary">{{ row.when }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class PlatformUpdateHistoryComponent {
  readonly operations = input.required<PlatformUpdateOperation[]>();

  protected readonly rows = computed(() =>
    this.operations().map((operation) => {
      const status = operationStatus(operation);
      return {
        id: operation.id,
        tone: status.tone,
        label:
          operation.status === 'PENDING' || operation.status === 'IN_PROGRESS'
            ? 'Running'
            : status.label,
        from: operation.fromVersion,
        to: operation.targetVersion,
        detail: historyDetail(operation),
        duration: elapsed(operation.startedAt, operation.completedAt),
        when: historyWhen(operation),
      };
    }),
  );
}
