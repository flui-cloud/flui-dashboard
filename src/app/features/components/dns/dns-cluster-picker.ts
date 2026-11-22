import { Component, input, model, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

export interface PickableCluster {
  readonly id?: string;
  readonly name?: string;
}

@Component({
  selector: 'app-dns-cluster-picker',
  imports: [FlButton, FlIcon],
  providers: [provideIcons({ lucideRefreshCw })],
  host: { class: 'flex flex-wrap items-center justify-between gap-3' },
  template: `
    <span class="fl-select-wrap">
      <select
        class="fl-select fl-select--sm"
        aria-label="Cluster"
        [value]="value()"
        (change)="onChange($event)"
      >
        <option value="" [selected]="!value()">Select a cluster</option>
        @for (cluster of clusters(); track cluster.id) {
          <option [value]="cluster.id" [selected]="cluster.id === value()">
            {{ cluster.name }}
          </option>
        }
      </select>
    </span>
    @if (showRefresh()) {
      <button
        flButton
        size="sm"
        type="button"
        [iconOnly]="true"
        aria-label="Refresh"
        title="Refresh"
        [disabled]="refreshing()"
        (click)="refresh.emit()"
      >
        <fl-icon name="lucideRefreshCw" [size]="14" />
      </button>
    }
  `,
})
export class DnsClusterPicker {
  readonly clusters = input.required<readonly PickableCluster[]>();
  readonly value = model('');
  readonly showRefresh = input(true);
  readonly refreshing = input(false);
  readonly refresh = output<void>();

  protected onChange(event: Event): void {
    this.value.set((event.target as HTMLSelectElement).value);
  }
}
