import { Component, input, output } from '@angular/core';
import { DeferredAction, openingLabel } from '../../service/maintenance.service';
import { FlPanel, FlTable } from '../../../ui/patterns';
import { FlButton, FlStatus, StatusTone } from '../../../ui/primitives';

const STATUS: Record<string, { tone: StatusTone; label: string }> = {
  pending: { tone: 'warning', label: 'Waiting' },
  running: { tone: 'progress', label: 'Running' },
  applied: { tone: 'success', label: 'Applied' },
  done: { tone: 'success', label: 'Done' },
  completed: { tone: 'success', label: 'Done' },
  failed: { tone: 'error', label: 'Failed' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
  expired: { tone: 'neutral', label: 'Expired' },
};

/** Changes held for a window, and what became of each. */
@Component({
  selector: 'app-deferred-list',
  imports: [FlPanel, FlTable, FlButton, FlStatus],
  template: `
    @if (rows().length) {
      <fl-panel
        title="Held changes"
        [count]="rows().length"
        [flush]="true"
        data-testid="deferred-list"
      >
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Change</th>
                <th scope="col">Status</th>
                <th scope="col">Runs</th>
                <th scope="col">Asked by</th>
                @if (cancellable()) {
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr>
                  <td class="is-wrap">
                    <span class="block text-fl-ink">{{ row.says }}</span>
                    @if (row.outcome) {
                      <span class="block text-fl-caption text-fl-ink-muted">{{ row.outcome }}</span>
                    }
                  </td>
                  <td><fl-status [tone]="tone(row.status)" [label]="statusLabel(row.status)" /></td>
                  <td class="fl-num">{{ label(row.runAt) }}</td>
                  <td>{{ row.requestedBy }}</td>
                  @if (cancellable()) {
                    <td class="is-fit">
                      @if (row.status === 'pending') {
                        <button
                          flButton="ghost"
                          size="sm"
                          type="button"
                          (click)="cancelAction.emit(row)"
                          [attr.data-testid]="'deferred-cancel-' + row.id"
                        >
                          Cancel
                        </button>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </fl-panel>
    }
  `,
})
export class DeferredListComponent {
  readonly rows = input<DeferredAction[]>([]);
  readonly cancellable = input(false);
  readonly cancelAction = output<DeferredAction>();
  protected label = openingLabel;

  protected tone(status: string): StatusTone {
    return STATUS[status]?.tone ?? 'neutral';
  }

  protected statusLabel(status: string): string {
    const known = STATUS[status]?.label;
    if (known) return known;
    const text = status.replaceAll(/[-_]/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
