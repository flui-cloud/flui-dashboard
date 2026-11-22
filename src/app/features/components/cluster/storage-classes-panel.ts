import { Component } from '@angular/core';
import { STORAGE_CLASSES } from '../../model/volume-management.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-storage-classes-panel',
  imports: [FlPanel, FlTable, FlStatus],
  host: { class: 'block' },
  template: `
    <fl-panel title="Where your apps store data" [count]="classes.length" [flush]="true">
      <p class="m-0 border-b border-fl-border px-4 py-3 text-fl-body-sm text-fl-ink-muted">
        Flui picks the right one automatically based on the app. You almost never need to choose by
        hand.
      </p>
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Storage</th>
              <th scope="col">Class</th>
              <th scope="col">State</th>
              <th scope="col">What it is for</th>
            </tr>
          </thead>
          <tbody>
            @for (sc of classes; track sc.name) {
              <tr>
                <td class="font-medium">{{ sc.label }}</td>
                <td class="fl-mono">{{ sc.name }}</td>
                <td>
                  <fl-status
                    [tone]="sc.state === 'active' ? 'success' : 'neutral'"
                    [label]="sc.state === 'active' ? 'Active' : 'Fallback'"
                  />
                </td>
                <td class="is-wrap text-fl-ink-muted">{{ sc.description }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>
  `,
})
export class StorageClassesPanel {
  protected readonly classes = STORAGE_CLASSES;
}
