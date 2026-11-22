import { Component, computed, input, output } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlButton } from '../../../ui/primitives/button';
import { SpareVolume } from '../../model/volume-management.models';
import { formatDate } from './snapshot-format';

@Component({
  selector: 'app-spare-volumes',
  imports: [FlPanel, FlTable, FlActionsMenu, FlButton],
  host: { class: 'block' },
  template: `
    <fl-panel title="Restored and previous volumes" [count]="volumes().length" [flush]="true">
      <p class="px-4 py-3 text-fl-body-sm text-fl-ink-muted">
        Full volumes this application does not run on, paid for while they exist.
      </p>
      <div class="fl-table-wrap border-t border-fl-border">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Volume</th>
              <th scope="col">Origin</th>
              <th scope="col" class="is-num">Size</th>
              <th scope="col">Created</th>
              <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.volume.name) {
              <tr>
                <td class="fl-mono">{{ row.volume.name }}</td>
                <td class="text-fl-ink-muted">{{ row.origin }}</td>
                <td class="is-num">{{ row.volume.size || '—' }}</td>
                <td class="fl-num">{{ row.created }}</td>
                <td class="is-fit">
                  <div class="fl-row flex-nowrap justify-end">
                    <button
                      flButton
                      size="sm"
                      type="button"
                      [disabled]="row.volume.inUse || restoring()"
                      (click)="use.emit(row.volume)"
                    >
                      Use this
                    </button>
                    <fl-actions-menu
                      [compact]="true"
                      [label]="'Actions for ' + row.volume.name"
                      [items]="row.menu"
                      (action)="remove.emit(row.volume.name)"
                    />
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>
  `,
})
export class SpareVolumes {
  readonly volumes = input.required<readonly SpareVolume[]>();
  readonly restoring = input(false);
  readonly use = output<SpareVolume>();
  readonly remove = output<string>();

  protected readonly rows = computed(() =>
    this.volumes().map((volume) => {
      const menu: MenuAction[] = [
        { id: 'delete', label: 'Delete', danger: true, disabled: volume.inUse },
      ];
      return {
        volume,
        origin:
          volume.kind === 'previous'
            ? 'What the application used before a restore'
            : 'Restored from a copy, never put in use',
        created: volume.createdAt ? formatDate(volume.createdAt) : '—',
        menu,
      };
    }),
  );
}
