import { Component, computed, input, output } from '@angular/core';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyFocus } from './topology-state';
import { ClusterConnection, clusterConnections } from './topology-tiles';
import { connectionTone } from './topology-kit';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTag } from '../../../ui/primitives/tag';
import { FlStatus } from '../../../ui/primitives/status';

const LINE: Record<ClusterConnection['kind'], { style: string; label: string }> = {
  tunnel: { style: 'border-solid', label: 'Flui network' },
  'public-address': { style: 'border-dashed', label: 'Public address' },
  off: { style: 'border-dotted', label: 'Flui network off' },
};

/** How the control reaches every other cluster: one line each, its kind drawn and named. */
@Component({
  selector: 'app-topology-network-strip',
  imports: [FlPanel, FlTag, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    @if (view(); as v) {
      <fl-panel title="Between clusters">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          @if (v.control; as control) {
            <button
              type="button"
              class="flex-none rounded-fl-md border bg-fl-surface px-3 py-2 text-left hover:bg-fl-surface-hover focus-visible:shadow-fl-focus focus-visible:outline-none"
              [class.border-fl-accent]="isFocused(control.id)"
              [class.border-fl-ink-muted]="!isFocused(control.id)"
              [attr.aria-pressed]="isFocused(control.id)"
              (click)="selected.emit({ type: 'cluster', id: control.id })"
            >
              <span class="block text-fl-body-sm font-semibold text-fl-ink">{{
                control.name
              }}</span>
              <span class="text-fl-caption text-fl-ink-muted"
                >control · {{ control.provider }}</span
              >
            </button>
          }
          <ul class="flex min-w-0 flex-1 flex-col gap-2">
            @for (c of v.connections; track c.clusterId) {
              <li class="flex items-center gap-2">
                <span
                  class="hidden h-0 flex-1 border-t-2 border-fl-ink-muted sm:block"
                  aria-hidden="true"
                  [class]="line(c).style"
                ></span>
                <fl-status class="flex-none" [tone]="tone(c)" [label]="line(c).label" />
                @if (c.crossProvider) {
                  <fl-tag class="flex-none">other provider</fl-tag>
                }
                <button
                  type="button"
                  class="w-40 flex-none truncate rounded-fl-md border bg-fl-surface px-2 py-1 text-left text-fl-body-sm font-medium text-fl-ink hover:bg-fl-surface-hover focus-visible:shadow-fl-focus focus-visible:outline-none"
                  [class.border-fl-accent]="isFocused(c.clusterId)"
                  [class.border-fl-border]="!isFocused(c.clusterId)"
                  [attr.aria-pressed]="isFocused(c.clusterId)"
                  [attr.aria-label]="c.name + ', reached over ' + line(c).label"
                  (click)="selected.emit({ type: 'cluster', id: c.clusterId })"
                >
                  {{ c.name }}
                </button>
              </li>
            }
          </ul>
        </div>
      </fl-panel>
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

  protected tone(c: ClusterConnection) {
    return connectionTone(c.kind);
  }

  protected isFocused(clusterId: string): boolean {
    const f = this.focus();
    return f?.type === 'cluster' && f.id === clusterId;
  }
}
