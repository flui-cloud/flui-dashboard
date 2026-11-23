import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyColorBy, TopologyFocus } from './topology-state';
import { FULL_PCT, fullestServers, replicaSpread } from './topology-tiles';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-topology-infra-panels',
  imports: [RouterLink, FlPanel, FlAlert, FlTable, FlUsageBar, FlButton, FlStatus],
  host: { class: 'fl-grid-2' },
  template: `
    @if (spread(); as s) {
      <fl-panel [title]="'Replica spread · ' + s.name">
        <span panelActions class="fl-toolbar__info"
          >{{ s.replicas }} replicas · {{ s.servers }} servers · {{ s.rows.length }} cluster{{
            s.rows.length === 1 ? '' : 's'
          }}</span
        >
        <div class="flex flex-col gap-3">
          @for (row of s.rows; track row.clusterId) {
            <div class="flex items-center gap-3">
              <span class="w-28 flex-none truncate text-fl-body-sm font-medium text-fl-ink">{{
                row.cluster
              }}</span>
              <span class="flex min-w-0 flex-1 gap-1">
                @for (seg of row.segments; track seg.serverId) {
                  <button
                    type="button"
                    class="flex h-7 min-w-0 items-center overflow-hidden rounded-fl-sm border border-fl-border bg-fl-surface px-1.5 font-mono text-fl-caption text-fl-ink hover:bg-fl-surface-hover focus-visible:shadow-fl-focus focus-visible:outline-none"
                    [style.flex]="seg.count"
                    [attr.aria-label]="seg.label + ', ' + seg.count + ' replicas'"
                    (click)="selected.emit({ type: 'server', id: seg.serverId })"
                  >
                    @if (seg.piled) {
                      <fl-status class="min-w-0" tone="warning" [label]="segmentText(seg)" />
                    } @else {
                      <span class="truncate">{{ segmentText(seg) }}</span>
                    }
                  </button>
                }
              </span>
            </div>
          }
          @for (row of s.piled; track row.clusterId) {
            <fl-alert tone="warning" title="Replicas piled on one server">
              {{ row.most }} of the {{ row.replicas }} {{ row.cluster }} replicas run on
              <span class="fl-mono">{{ row.piledOn }}</span>. If that server goes down,
              {{ row.cluster }} loses most of {{ s.name }}.
              @if (!guest()) {
                <a
                  alertActions
                  flButton
                  size="sm"
                  [routerLink]="['/apps/applications', s.appId, 'resources']"
                  >Spread across servers</a
                >
              }
            </fl-alert>
          }
        </div>
      </fl-panel>
    }

    @if (fullest().length) {
      <fl-panel title="Fullest servers" [flush]="true">
        <span panelActions class="fl-toolbar__info">{{ fullestBy() }} · whole fleet</span>
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Server</th>
                <th scope="col">Cluster</th>
                <th scope="col">{{ fullestColumn() }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of fullest(); track row.server.id) {
                <tr [class.is-selected]="isFocused(row.server.id)">
                  <td>
                    <button
                      type="button"
                      class="fl-link fl-mono"
                      [title]="row.server.nodeName"
                      (click)="selected.emit({ type: 'server', id: row.server.id })"
                    >
                      {{ row.label }}
                    </button>
                  </td>
                  <td class="text-fl-ink-muted">{{ row.cluster }}</td>
                  @if (pods()) {
                    <td>
                      <span class="flex items-center gap-2">
                        <span class="fl-bar min-w-24 flex-1" aria-hidden="true"
                          ><span [style.width.%]="podShare(row.value)"></span
                        ></span>
                        <span class="fl-num w-8 text-right">{{ textOf(row.value) }}</span>
                      </span>
                    </td>
                  } @else {
                    <td>
                      <fl-usage-bar
                        [percent]="row.value"
                        [label]="fullestColumn() + ' of ' + row.server.nodeName"
                        [warnAt]="full"
                        [criticalAt]="full"
                      />
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
export class TopologyInfraPanelsComponent {
  readonly snapshot = input.required<TopologyResponseDto>();
  readonly focus = input<TopologyFocus | null>(null);
  readonly colorBy = input<TopologyColorBy>('memory');
  readonly guest = input(false);
  readonly selected = output<TopologyFocus>();

  protected readonly spread = computed(() => {
    const focus = this.focus();
    if (focus?.type !== 'app') return null;
    const t = this.snapshot();
    const app = t.apps.find((a) => a.id === focus.id);
    if (!app) return null;
    const rows = replicaSpread(t, app.id);
    return {
      appId: app.id,
      name: app.displayName,
      rows,
      replicas: rows.reduce((sum, r) => sum + r.replicas, 0),
      servers: new Set(rows.flatMap((r) => r.segments.map((s) => s.serverId))).size,
      piled: rows
        .filter((r) => r.piledOn)
        .map((r) => ({ ...r, most: Math.max(...r.segments.map((s) => s.count)) })),
    };
  });

  protected readonly fullestBy = computed(() => {
    const by = this.colorBy();
    if (by === 'pods') return 'replicas';
    return by === 'cpu' ? 'CPU' : 'memory';
  });

  protected readonly fullest = computed(() => fullestServers(this.snapshot(), this.colorBy()));

  protected readonly full = FULL_PCT;
  protected readonly pods = computed(() => this.colorBy() === 'pods');
  protected readonly fullestColumn = computed(() => {
    const by = this.fullestBy();
    return by.charAt(0).toUpperCase() + by.slice(1);
  });

  private readonly maxPods = computed(() =>
    Math.max(1, ...this.snapshot().servers.map((s) => s.podCount)),
  );

  protected podShare(value: number): number {
    return (value / this.maxPods()) * 100;
  }

  protected segmentText(seg: { label: string; count: number }): string {
    return seg.count > 1 ? `${seg.label} ×${seg.count}` : seg.label;
  }

  protected isFocused(serverId: string): boolean {
    const f = this.focus();
    return f?.type === 'server' && f.id === serverId;
  }

  protected textOf(value: number): string {
    return this.pods() ? `${value}` : `${Math.round(value)}%`;
  }
}
