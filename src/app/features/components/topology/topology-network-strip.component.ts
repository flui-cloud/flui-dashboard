import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyFocus } from './topology-state';
import { ClusterConnection, clusterConnections } from './topology-tiles';

const LINE: Record<ClusterConnection['kind'], { style: string; color: string; label: string }> = {
  tunnel: { style: 'solid', color: 'hsl(var(--ok))', label: 'Flui network' },
  'public-address': { style: 'dashed', color: 'hsl(var(--warn))', label: 'Public address' },
  off: { style: 'dotted', color: 'hsl(var(--muted-foreground))', label: 'Flui network off' },
};

/** How the control reaches every other cluster: one line each, its kind drawn and named. */
@Component({
  selector: 'app-topology-network-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <section class="card-surface p-4" aria-label="How the clusters are connected">
        <h2 class="text-label mb-3">Between clusters</h2>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          @if (v.control; as control) {
            <button type="button" class="flex-none rounded-lg border-2 px-3 py-2 text-left"
                    style="border-color: hsl(var(--brand))"
                    [class.ring-1]="isFocused(control.id)"
                    (click)="selected.emit({ type: 'cluster', id: control.id })">
              <span class="block text-sm font-semibold text-foreground">{{ control.name }}</span>
              <span class="text-sub">control · {{ control.provider }}</span>
            </button>
          }
          <ul class="flex min-w-0 flex-1 flex-col gap-2">
            @for (c of v.connections; track c.clusterId) {
              <li class="flex items-center gap-2">
                <span class="hidden h-0 flex-1 border-t-2 sm:block" aria-hidden="true"
                      [style.border-top-style]="line(c).style" [style.border-top-color]="line(c).color"></span>
                <span class="flex-none text-xs font-medium" [style.color]="line(c).color">{{ line(c).label }}</span>
                @if (c.crossProvider) {
                  <span class="badge badge-pending flex-none">other provider</span>
                }
                <button type="button" class="w-40 flex-none truncate rounded-md border border-border px-2 py-1 text-left text-sm font-medium text-foreground hover:bg-muted"
                        [class.ring-1]="isFocused(c.clusterId)"
                        [attr.aria-label]="c.name + ', reached over ' + line(c).label"
                        (click)="selected.emit({ type: 'cluster', id: c.clusterId })">{{ c.name }}</button>
              </li>
            }
          </ul>
        </div>
      </section>
    }
  `,
})
export class TopologyNetworkStripComponent {
  readonly snapshot = input.required<TopologyResponseDto>();
  readonly focus = input<TopologyFocus | null>(null);
  readonly selected = output<TopologyFocus>();

  protected readonly view = computed(() => {
    const result = clusterConnections(this.snapshot());
    return result.connections.length ? result : null;
  });

  protected line(c: ClusterConnection) {
    return LINE[c.kind];
  }

  protected isFocused(clusterId: string): boolean {
    const f = this.focus();
    return f?.type === 'cluster' && f.id === clusterId;
  }
}
