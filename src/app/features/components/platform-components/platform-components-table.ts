import { Component, input, output } from '@angular/core';
import { FlTable } from '../../../ui/patterns/table';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { PlatformComponentStatusBadgeComponent } from './platform-component-status-badge.component';
import { ClusterGroup, createdAtOf, relativeAge } from './platform-components-rows';

export interface ComponentRef {
  readonly clusterId: string;
  readonly key: string;
}

@Component({
  selector: 'app-platform-components-table',
  imports: [FlTable, FlSpinner, FlStatus, FlTag, PlatformComponentStatusBadgeComponent],
  host: { class: 'block' },
  template: `
    <div class="fl-table-wrap">
      <table flTable density="dense" data-testid="platform-components-table">
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col">Category</th>
            <th scope="col">Status</th>
            <th scope="col">Managed by</th>
            <th scope="col" class="is-num">Errors</th>
            <th scope="col" class="is-num">Created</th>
          </tr>
        </thead>
        @for (group of groups(); track group.entry.clusterId) {
          <tbody>
            <tr>
              <th scope="rowgroup" colspan="6">
                <span class="fl-row justify-between">
                  <span class="fl-row">
                    {{ group.entry.clusterName }}
                    @if (group.entry.loading) {
                      <fl-spinner label="Loading components" />
                    }
                  </span>
                  @if (group.entry.error) {
                    <fl-status
                      [tone]="group.entry.refused ? 'neutral' : 'error'"
                      [label]="group.entry.error"
                    />
                  }
                </span>
              </th>
            </tr>
            @for (comp of group.components; track comp.key) {
              <tr [class.is-selected]="isOpen(comp.clusterId, comp.key)">
                <td class="fl-cell-name">
                  <button
                    type="button"
                    class="fl-link text-left"
                    (click)="open.emit({ clusterId: comp.clusterId, key: comp.key })"
                  >
                    {{ comp.name }}
                  </button>
                </td>
                <td>{{ comp.category }}</td>
                <td><app-platform-component-status-badge [status]="comp.status" /></td>
                <td>
                  <fl-tag>{{ comp.managedBy }}</fl-tag>
                </td>
                <td class="is-num">{{ comp.errorCount > 0 ? comp.errorCount : '—' }}</td>
                <td class="is-num">{{ age(created(comp)) || '—' }}</td>
              </tr>
            } @empty {
              @if (!group.entry.loading) {
                <tr>
                  <td colspan="6" class="text-fl-ink-muted">No components match the filters.</td>
                </tr>
              }
            }
          </tbody>
        }
      </table>
    </div>
  `,
})
export class PlatformComponentsTable {
  readonly groups = input.required<readonly ClusterGroup[]>();
  readonly openKey = input<string | null>(null);
  readonly open = output<ComponentRef>();

  protected readonly created = createdAtOf;
  protected readonly age = relativeAge;

  protected isOpen(clusterId: string, key: string): boolean {
    return this.openKey() === `${clusterId}:${key}`;
  }
}
