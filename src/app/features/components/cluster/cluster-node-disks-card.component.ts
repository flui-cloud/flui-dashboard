import { Component, effect, inject, input, signal } from '@angular/core';
import { DiskSpace, NodeDisksService, NodeDisksView } from '../../service/node-disks.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

@Component({
  selector: 'app-cluster-node-disks-card',
  imports: [FlPanel, FlTable, FlAlert, FlStatus],
  host: { class: 'block' },
  template: `
    @if (view(); as v) {
      <fl-panel
        title="Space on the nodes"
        [count]="v.nodes.length"
        [flush]="true"
        data-testid="node-disks-card"
      >
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Node</th>
                <th scope="col">Location</th>
                <th scope="col">Disk</th>
                <th scope="col">Copies of replicated volumes</th>
              </tr>
            </thead>
            <tbody>
              @for (n of v.nodes; track n.node) {
                <tr>
                  <td class="fl-mono">{{ n.node }}</td>
                  <td class="text-fl-ink-muted">{{ n.zone ?? '—' }}</td>
                  <td>
                    @if (n.disk) {
                      <fl-status [tone]="tone(n.disk, 3)" [label]="label(n.disk)" />
                    } @else {
                      <span class="text-fl-ink-muted">—</span>
                    }
                  </td>
                  <td>
                    @if (n.copies) {
                      <fl-status [tone]="tone(n.copies, 2)" [label]="label(n.copies)" />
                    } @else {
                      <span class="text-fl-ink-muted">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (v.warnings.length) {
          <div class="flex flex-col gap-2 border-t border-fl-border p-4">
            @for (w of v.warnings; track w) {
              <fl-alert tone="warning" title="Running short of space">{{ w }}</fl-alert>
            }
          </div>
        }
      </fl-panel>
    }
  `,
})
export class ClusterNodeDisksCardComponent {
  private readonly disks = inject(NodeDisksService);

  readonly clusterId = input.required<string | null>();
  readonly view = signal<NodeDisksView | null>(null);

  label(s: DiskSpace | null): string {
    return s ? `${s.freeGiB} of ${s.totalGiB} GiB free` : '—';
  }

  tone(s: DiskSpace, floorGiB: number): StatusTone {
    return s.freeGiB < floorGiB || s.freeGiB < s.totalGiB * 0.15 ? 'warning' : 'success';
  }

  constructor() {
    effect(() => {
      const id = this.clusterId();
      if (!id) return;
      this.disks.get(id).subscribe({
        next: (v) => this.view.set(v),
        error: () => this.view.set(null),
      });
    });
  }
}
