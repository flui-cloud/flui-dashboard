import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyColorBy, TopologyFocus } from './topology-state';
import { FULL_PCT, fullestServers, replicaSpread } from './topology-tiles';

@Component({
  selector: 'app-topology-infra-panels',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4 xl:grid-cols-2">
      @if (spread(); as s) {
        <section class="card-surface space-y-3 p-4" aria-label="Replica spread">
          <header class="flex items-baseline justify-between gap-2">
            <h2 class="text-sm font-semibold text-foreground">Replica spread · {{ s.name }}</h2>
            <span class="text-sub">{{ s.replicas }} replicas · {{ s.servers }} servers · {{ s.rows.length }} cluster{{ s.rows.length === 1 ? '' : 's' }}</span>
          </header>
          @for (row of s.rows; track row.clusterId) {
            <div class="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3">
              <span class="truncate text-xs font-medium text-foreground">{{ row.cluster }}</span>
              <span class="flex gap-1">
                @for (seg of row.segments; track seg.serverId) {
                  <button type="button"
                          class="h-6 min-w-0 truncate rounded px-1.5 font-mono text-[10px] font-semibold"
                          [style.flex]="seg.count"
                          [style.background]="seg.piled ? 'hsl(var(--warn))' : 'hsl(var(--brand))'"
                          style="color: hsl(var(--primary-foreground))"
                          [attr.aria-label]="seg.label + ', ' + seg.count + ' replicas'"
                          (click)="selected.emit({ type: 'server', id: seg.serverId })">
                    {{ seg.label }}{{ seg.count > 1 ? ' ×' + seg.count : '' }}
                  </button>
                }
              </span>
            </div>
          }
          @for (row of s.piled; track row.clusterId) {
            <div class="flex gap-3 rounded-lg border p-3 text-sm" style="border-color: hsl(var(--warn)); background: hsl(var(--warn) / 0.08)" role="note">
              <span class="space-y-2">
                <span class="block text-foreground">
                  {{ row.most }} of the {{ row.replicas }} {{ row.cluster }} replicas run on
                  <span class="font-mono">{{ row.piledOn }}</span>. If that server goes down, {{ row.cluster }} loses most of {{ s.name }}.
                </span>
                @if (!guest()) {
                  <a class="card-link mt-0" [routerLink]="['/apps/applications', s.appId, 'resources']">Spread across servers</a>
                }
              </span>
            </div>
          }
        </section>
      }

      @if (fullest().length) {
      <section class="card-surface space-y-2 p-4" aria-label="Fullest servers">
        <header class="flex items-baseline justify-between gap-2">
          <h2 class="text-sm font-semibold text-foreground">Fullest servers</h2>
          <span class="text-sub">{{ fullestBy() }} · whole fleet</span>
        </header>
        @for (row of fullest(); track row.server.id) {
          <button type="button" class="grid w-full grid-cols-[7rem_6rem_minmax(0,1fr)_3rem] items-center gap-2 rounded-md px-1 py-1 text-left text-xs hover:bg-muted"
                  (click)="selected.emit({ type: 'server', id: row.server.id })">
            <span class="truncate font-mono text-foreground" [title]="row.server.nodeName">{{ row.label }}</span>
            <span class="text-sub truncate">{{ row.cluster }}</span>
            <span class="block h-1.5 rounded-full bg-muted">
              <span class="block h-1.5 rounded-full" [style.width.%]="barOf(row.value)"
                    [style.background]="isFull(row.value) ? 'hsl(var(--destructive))' : 'hsl(var(--brand))'"></span>
            </span>
            <span class="text-right font-mono text-foreground">{{ textOf(row.value) }}</span>
          </button>
        }
      </section>
      }
    </div>
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

  private readonly maxPods = computed(() => Math.max(1, ...this.snapshot().servers.map((s) => s.podCount)));

  protected barOf(value: number): number {
    return this.colorBy() === 'pods' ? (value / this.maxPods()) * 100 : Math.min(100, value);
  }

  protected isFull(value: number): boolean {
    return this.colorBy() !== 'pods' && value >= FULL_PCT;
  }

  protected textOf(value: number): string {
    return this.colorBy() === 'pods' ? `${value}` : `${Math.round(value)}%`;
  }
}
