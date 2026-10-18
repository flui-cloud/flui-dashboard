import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyFocus } from './topology-state';
import { memory, percent, statusLabel, toneOf } from './topology-format';
import { shortName } from './topology-tiles';

type Cell =
  | { kind: 'text'; text: string }
  | { kind: 'num'; text: string }
  | { kind: 'meter'; value: number | null };

interface Column {
  label: string;
  width: string;
  end?: boolean;
}

interface ListRow {
  focus: TopologyFocus;
  label: string;
  detail: string;
  tone: string;
  status: string;
  cells: Cell[];
}

interface ListGroup {
  title: string;
  columns: Column[];
  rows: ListRow[];
}

const STATUS_COLUMN = '5.5rem';

/** The same fleet as the map, as tables a keyboard and a screen reader can walk. */
@Component({
  selector: 'app-topology-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      @for (group of groups(); track group.title) {
        <section class="card-surface overflow-hidden" [attr.aria-label]="group.title">
          <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-border bg-muted/40 px-4 py-2 md:[grid-template-columns:var(--cols)]"
               [style.--cols]="templateOf(group)">
            <h2 class="text-label">{{ group.title }} · {{ group.rows.length }}</h2>
            @for (col of group.columns; track col.label) {
              <span class="text-label hidden md:block" [class.text-right]="col.end">{{ col.label }}</span>
            }
            <span class="text-label text-right">Status</span>
          </div>
          <ul role="list">
            @for (row of group.rows; track row.focus.type + row.focus.id) {
              <li class="border-b border-border last:border-b-0">
                <button type="button"
                        class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-2 text-left text-sm transition-colors hover:bg-muted/60 md:[grid-template-columns:var(--cols)]"
                        [style.--cols]="templateOf(group)"
                        [class.bg-muted]="isFocused(row.focus)"
                        [attr.aria-pressed]="isFocused(row.focus)"
                        [attr.aria-label]="row.label + ', ' + row.status"
                        (click)="selected.emit(row.focus)">
                  <span class="flex min-w-0 items-center gap-2.5">
                    <span class="h-2 w-2 flex-none rounded-full" [class]="'dot-' + row.tone"></span>
                    <span class="min-w-0">
                      <span class="block truncate font-medium text-foreground">{{ row.label }}</span>
                      @if (row.detail) {
                        <span class="block truncate text-xs text-muted-foreground">{{ row.detail }}</span>
                      }
                    </span>
                  </span>
                  @for (cell of row.cells; track $index) {
                    <span class="hidden min-w-0 md:block">
                      @switch (cell.kind) {
                        @case ('meter') {
                          <span class="flex items-center gap-2">
                            <span class="h-1 flex-1 rounded-full bg-muted">
                              <span class="block h-1 rounded-full" [style.width.%]="cell.value ?? 0" [style.background]="meterColor(cell.value)"></span>
                            </span>
                            <span class="w-9 text-right font-mono text-xs tabular-nums text-foreground">{{ pct(cell.value) }}</span>
                          </span>
                        }
                        @case ('num') {
                          <span class="block text-right font-mono text-xs tabular-nums text-foreground">{{ cell.text }}</span>
                        }
                        @default {
                          <span class="block truncate text-muted-foreground">{{ cell.text }}</span>
                        }
                      }
                    </span>
                  }
                  <span class="text-right text-xs font-medium" [class]="'status-' + row.tone">{{ row.status }}</span>
                </button>
              </li>
            }
          </ul>
        </section>
      }
    </div>
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

  protected templateOf(group: ListGroup): string {
    return `minmax(0,1.6fr) ${group.columns.map((c) => c.width).join(' ')} ${STATUS_COLUMN}`;
  }

  protected pct(value: number | null): string {
    return percent(value);
  }

  protected meterColor(value: number | null): string {
    if ((value ?? 0) >= 90) return 'hsl(var(--destructive))';
    if ((value ?? 0) >= 75) return 'hsl(var(--warn))';
    return 'hsl(var(--brand) / 0.7)';
  }

  protected readonly groups = computed<ListGroup[]>(() => {
    const t = this.snapshot();
    if (!t) return [];
    const clusterName = (id: string) => t.clusters.find((c) => c.id === id)?.name ?? '';
    const stacks = new Map(t.stacks.map((s) => [s.id, s]));
    const projectName = new Map((t.projects ?? []).map((p) => [p.id, p.name]));
    const project = this.project();
    const text = (value: string): Cell => ({ kind: 'text', text: value });
    const num = (value: number | string): Cell => ({ kind: 'num', text: String(value) });
    const row = (focus: TopologyFocus, label: string, detail: string, status: string, cells: Cell[]): ListRow => ({
      focus,
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
          { label: 'Provider', width: 'minmax(0,1fr)' },
          { label: 'Servers', width: '4rem', end: true },
          { label: 'Apps', width: '4rem', end: true },
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
          { label: 'Cluster', width: 'minmax(0,1fr)' },
          { label: 'Memory', width: 'minmax(0,1fr)' },
          { label: 'CPU', width: 'minmax(0,1fr)' },
          { label: 'Replicas', width: '4rem', end: true },
        ],
        rows: t.servers.map((s) =>
          row(
            { type: 'server', id: s.id },
            shortName(s.nodeName, t.servers.filter((x) => x.clusterId === s.clusterId).map((x) => x.nodeName)),
            [s.role === 'control-plane' ? 'control plane' : 'worker', s.serverType, s.architecture].filter(Boolean).join(' · '),
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
          { label: 'Cluster', width: 'minmax(0,1fr)' },
          { label: 'Memory', width: '5rem', end: true },
          { label: 'Replicas', width: '4rem', end: true },
        ],
        rows: t.apps.filter((a) => !project || a.projectId === project).map((a) => {
          const stack = stacks.get(a.stackId);
          const detail = [
            projectName.get(a.projectId ?? ''),
            stack && stack.appIds.length > 1 && stack.name !== a.displayName ? stack.name : '',
          ].filter(Boolean).join(' · ');
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
