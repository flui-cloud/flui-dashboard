import { Component, computed, input, output } from '@angular/core';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyFocus } from './topology-state';
import { memory, statusLabel, toneOf } from './topology-format';
import { shortName } from './topology-tiles';
import { kitTone } from './topology-kit';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlStatus } from '../../../ui/primitives/status';

type Cell =
  | { kind: 'text'; text: string }
  | { kind: 'num'; text: string }
  | { kind: 'meter'; value: number | null };

interface Column {
  label: string;
  end?: boolean;
}

interface ListRow {
  focus: TopologyFocus;
  label: string;
  detail: string;
  tone: string;
  status: string;
  cells: Cell[];
  mono: boolean;
}

interface ListGroup {
  title: string;
  columns: Column[];
  rows: ListRow[];
}

/** The same fleet as the map, as tables a keyboard and a screen reader can walk. */
@Component({
  selector: 'app-topology-list',
  imports: [FlPanel, FlTable, FlUsageBar, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    @for (group of groups(); track group.title) {
      <fl-panel [title]="group.title" [count]="group.rows.length" [flush]="true">
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Name</th>
                @for (col of group.columns; track col.label) {
                  <th scope="col" [class.is-num]="col.end">{{ col.label }}</th>
                }
                <th scope="col" class="is-fit">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (row of group.rows; track row.focus.type + row.focus.id) {
                <tr [class.is-selected]="isFocused(row.focus)">
                  <td class="fl-cell-name">
                    <button
                      type="button"
                      class="fl-link block max-w-full truncate text-left"
                      [class.fl-mono]="row.mono"
                      [attr.aria-pressed]="isFocused(row.focus)"
                      [attr.aria-label]="row.label + ', ' + row.status"
                      (click)="selected.emit(row.focus)"
                    >
                      {{ row.label }}
                    </button>
                    @if (row.detail) {
                      <span class="block truncate text-fl-caption text-fl-ink-muted">{{
                        row.detail
                      }}</span>
                    }
                  </td>
                  @for (cell of row.cells; track $index) {
                    @switch (cell.kind) {
                      @case ('meter') {
                        <td>
                          @if (cell.value === null) {
                            <span class="text-fl-ink-muted">—</span>
                          } @else {
                            <fl-usage-bar
                              [percent]="cell.value"
                              [label]="group.columns[$index].label + ' of ' + row.label"
                              [warnAt]="75"
                              [criticalAt]="90"
                            />
                          }
                        </td>
                      }
                      @case ('num') {
                        <td class="is-num fl-mono">{{ cell.text }}</td>
                      }
                      @default {
                        <td class="text-fl-ink-muted">{{ cell.text }}</td>
                      }
                    }
                  }
                  <td class="is-fit">
                    <fl-status [tone]="kit(row.tone)" [label]="row.status" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </fl-panel>
    }
  `,
})
export class TopologyListComponent {
  readonly snapshot = input<TopologyResponseDto | null>(null);
  readonly focus = input<TopologyFocus | null>(null);
  readonly project = input<string | null>(null);
  readonly selected = output<TopologyFocus>();

  protected isFocused(f: TopologyFocus): boolean {
    const current = this.focus();
    return !!current && current.type === f.type && current.id === f.id;
  }

  protected readonly kit = kitTone;

  protected readonly groups = computed<ListGroup[]>(() => {
    const t = this.snapshot();
    if (!t) return [];
    const clusterName = (id: string) => t.clusters.find((c) => c.id === id)?.name ?? '';
    const stacks = new Map(t.stacks.map((s) => [s.id, s]));
    const projectName = new Map((t.projects ?? []).map((p) => [p.id, p.name]));
    const project = this.project();
    const text = (value: string): Cell => ({ kind: 'text', text: value });
    const num = (value: number | string): Cell => ({ kind: 'num', text: String(value) });
    const row = (
      focus: TopologyFocus,
      label: string,
      detail: string,
      status: string,
      cells: Cell[],
    ): ListRow => ({
      focus,
      mono: focus.type === 'server',
      label,
      detail,
      cells,
      status: statusLabel(status),
      tone: toneOf(status),
    });

    return [
      {
        title: 'Clusters',
        columns: [
          { label: 'Provider' },
          { label: 'Servers', end: true },
          { label: 'Apps', end: true },
        ],
        rows: t.clusters.map((c) =>
          row({ type: 'cluster', id: c.id }, c.name, '', c.status, [
            text(`${c.provider} · ${c.region}`),
            num(c.counts.servers),
            num(c.counts.apps),
          ]),
        ),
      },
      {
        title: 'Servers',
        columns: [
          { label: 'Cluster' },
          { label: 'Memory' },
          { label: 'CPU' },
          { label: 'Replicas', end: true },
        ],
        rows: t.servers.map((s) =>
          row(
            { type: 'server', id: s.id },
            shortName(
              s.nodeName,
              t.servers.filter((x) => x.clusterId === s.clusterId).map((x) => x.nodeName),
            ),
            [s.role === 'control-plane' ? 'control plane' : 'worker', s.serverType, s.architecture]
              .filter(Boolean)
              .join(' · '),
            s.status,
            [
              text(clusterName(s.clusterId)),
              { kind: 'meter', value: s.capacity?.usedMemPct ?? null },
              { kind: 'meter', value: s.capacity?.usedCpuPct ?? null },
              num(s.podCount),
            ],
          ),
        ),
      },
      {
        title: 'Apps',
        columns: [
          { label: 'Cluster' },
          { label: 'Memory', end: true },
          { label: 'Replicas', end: true },
        ],
        rows: t.apps
          .filter((a) => !project || a.projectId === project)
          .map((a) => {
            const stack = stacks.get(a.stackId);
            const detail = [
              projectName.get(a.projectId ?? ''),
              stack && stack.appIds.length > 1 && stack.name !== a.displayName ? stack.name : '',
            ]
              .filter(Boolean)
              .join(' · ');
            return row({ type: 'app', id: a.id }, a.displayName, detail, a.status, [
              text(clusterName(a.clusterId)),
              num(a.ramRequestMB ? memory(a.ramRequestMB) : '—'),
              num(`×${a.replicaCount}`),
            ]);
          }),
      },
    ];
  });
}
