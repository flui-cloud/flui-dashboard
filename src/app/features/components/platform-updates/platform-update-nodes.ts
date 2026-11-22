import { Component, input } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus } from '../../../ui/primitives/status';
import { K3sNodeRow } from './platform-upgrade-plan';
import { stepLabel, stepTone } from './platform-update-format';

@Component({
  selector: 'app-platform-update-nodes',
  imports: [FlPanel, FlTable, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="K3s nodes" [count]="rows().length" [flush]="true">
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Cluster</th>
              <th scope="col">Node</th>
              <th scope="col">Role</th>
              <th scope="col">K3s</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.cluster + row.node) {
              <tr>
                <td>{{ row.cluster }}</td>
                <td class="fl-mono">
                  <span class="fl-cell-clip" [title]="row.node">{{ row.node }}</span>
                </td>
                <td class="text-fl-ink-secondary">{{ row.role }}</td>
                <td class="fl-mono text-fl-ink-secondary">{{ row.version ?? '—' }}</td>
                <td>
                  <fl-status
                    [tone]="tone(row.status)"
                    [label]="label(row.status)"
                    [attr.title]="row.message ?? null"
                  />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>
  `,
})
export class PlatformUpdateNodes {
  readonly rows = input.required<readonly K3sNodeRow[]>();
  protected readonly tone = stepTone;
  protected readonly label = stepLabel;
}
