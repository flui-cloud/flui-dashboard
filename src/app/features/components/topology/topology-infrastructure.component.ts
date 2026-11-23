import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideServer } from '@ng-icons/lucide';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyColorBy, TopologyFocus, TopologyGroupBy } from './topology-state';
import { NETWORK_LABEL, NetworkKind, Tile, TileDensity, tileGroups } from './topology-tiles';
import { tileValueColor, tileValueTone } from './topology-tile';
import { ExportPalette } from './topology-export';
import { ExportHeader, esc, fit, frame, monoFamily } from './topology-view-export';
import { TopologyNetworkStripComponent } from './topology-network-strip.component';
import { TopologyChoiceComponent } from './topology-choice.component';
import { TopologyServerTileComponent } from './topology-server-tile.component';
import { networkTone } from './topology-kit';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';

const COLOR_CHOICES = [
  { value: 'memory', label: 'Memory' },
  { value: 'cpu', label: 'CPU' },
  { value: 'pods', label: 'Replicas' },
  { value: 'network', label: 'Network' },
];
const GROUP_CHOICES = [
  { value: 'cluster', label: 'Cluster' },
  { value: 'provider', label: 'Provider' },
];
const NETWORK_ORDER: NetworkKind[] = ['flui', 'flui-waiting', 'private', 'public'];
const SIZE: Record<TileDensity, { width: string; height: string }> = {
  card: { width: 'minmax(13rem, 15rem)', height: '10rem' },
  medium: { width: '7rem', height: '4.5rem' },
  compact: { width: '4.5rem', height: '3.5rem' },
};

@Component({
  selector: 'app-topology-infrastructure',
  imports: [
    FlPanel,
    FlStatus,
    FlEmptyState,
    TopologyNetworkStripComponent,
    TopologyChoiceComponent,
    TopologyServerTileComponent,
  ],
  providers: [provideIcons({ lucideServer })],
  host: { class: 'fl-stack' },
  template: `
    @if (colorBy() === 'network') {
      <app-topology-network-strip
        [snapshot]="snapshot()"
        [focus]="focus()"
        (selected)="selected.emit($event)"
      />
    }

    <fl-panel title="Servers" [count]="snapshot().servers.length" [flush]="true">
      <div class="fl-toolbar" panelToolbar>
        <div class="fl-toolbar__group">
          <app-topology-choice
            label="Group by"
            [choices]="groupChoices"
            [value]="groupBy()"
            (changed)="pickGroup($event)"
          />
          <app-topology-choice
            label="Show"
            [choices]="colorChoices"
            [value]="colorBy()"
            (changed)="pickColor($event)"
          />
        </div>
      </div>

      @if (!snapshot().servers.length) {
        <fl-empty-state
          icon="lucideServer"
          [title]="silent() ? 'No server could be read' : 'No server yet'"
          [body]="
            silent()
              ? silent() +
                ' of ' +
                snapshot().clusters.length +
                ' clusters are not answering. Their servers appear here as soon as they do.'
              : 'Servers appear here once a cluster has some.'
          "
        />
      } @else {
        <div class="flex flex-wrap items-start gap-4 p-4" (keydown)="move($event)">
          @for (group of groups(); track group.key) {
            <section
              class="rounded-fl-lg border p-4 transition-opacity"
              [class.opacity-50]="group.dimmed"
              [class.border-fl-accent]="group.replicas"
              [class.border-fl-border]="!group.replicas"
              [attr.aria-label]="group.name + ', ' + group.meta"
            >
              <header class="mb-3 flex items-baseline gap-2">
                @if (group.clusterId) {
                  <button
                    type="button"
                    class="fl-link text-fl-body-sm font-semibold"
                    (click)="selected.emit({ type: 'cluster', id: group.clusterId })"
                  >
                    {{ group.name }}
                  </button>
                } @else {
                  <span class="text-fl-body-sm font-semibold text-fl-ink">{{ group.name }}</span>
                }
                <span class="text-fl-caption text-fl-ink-muted">{{ group.meta }}</span>
                @if (group.replicas) {
                  <span class="ml-auto text-fl-caption font-semibold text-fl-accent"
                    >{{ group.replicas }} replica{{ group.replicas === 1 ? '' : 's' }}</span
                  >
                }
              </header>
              <div
                class="grid"
                [class.gap-3]="group.density === 'card'"
                [class.gap-2]="group.density !== 'card'"
                [style.grid-template-columns]="
                  'repeat(' + group.columns + ', ' + SIZE[group.density].width + ')'
                "
              >
                @for (tile of group.tiles; track tile.server.id) {
                  <button
                    type="button"
                    class="rounded-fl-md text-left transition-opacity focus-visible:shadow-fl-focus focus-visible:outline-none"
                    [style.height]="SIZE[group.density].height"
                    [class.opacity-30]="tile.dimmed"
                    [attr.data-columns]="group.columns"
                    [attr.aria-label]="ariaOf(tile)"
                    [attr.aria-pressed]="tile.focused"
                    (click)="selected.emit({ type: 'server', id: tile.server.id })"
                    (dblclick)="opened.emit({ type: 'server', id: tile.server.id })"
                  >
                    <app-topology-server-tile
                      class="h-full"
                      [tile]="tile"
                      [colorBy]="colorBy()"
                      [density]="group.density"
                    />
                  </button>
                }
              </div>
            </section>
          }
        </div>

        <p
          class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-fl-border px-4 py-3 text-fl-caption text-fl-ink-muted"
          aria-label="Legend"
        >
          @if (colorBy() === 'network') {
            @for (kind of networkOrder; track kind) {
              <fl-status [tone]="tone(kind)" [label]="networkLabel[kind]" />
            }
          } @else if (colorBy() !== 'pods') {
            <fl-status tone="error" label="90% or more" />
          } @else {
            <span>Replicas running on each server</span>
          }
          @if (hasArm()) {
            <span class="inline-flex items-center gap-1.5"
              ><span class="rounded-fl-sm border border-fl-border px-0.5 font-mono">arm</span> Arm
              server</span
            >
          }
        </p>
      }
    </fl-panel>
  `,
})
export class TopologyInfrastructureComponent {
  readonly snapshot = input.required<TopologyResponseDto>();
  readonly focus = input<TopologyFocus | null>(null);
  readonly colorBy = input<TopologyColorBy>('memory');
  readonly groupBy = input<TopologyGroupBy>('cluster');
  readonly project = input<string | null>(null);

  protected readonly hasArm = computed(() =>
    this.snapshot().servers.some((s) => s.architecture === 'arm'),
  );
  protected readonly silent = computed(
    () => this.snapshot().clusters.filter((c) => c.status === 'down').length,
  );
  readonly selected = output<TopologyFocus>();
  readonly opened = output<TopologyFocus>();
  readonly colorByChanged = output<TopologyColorBy>();
  readonly groupByChanged = output<TopologyGroupBy>();

  protected readonly colorChoices = COLOR_CHOICES;
  protected readonly groupChoices = GROUP_CHOICES;
  protected readonly networkOrder = NETWORK_ORDER;
  protected readonly networkLabel = NETWORK_LABEL;
  protected readonly SIZE = SIZE;

  protected readonly groups = computed(() =>
    tileGroups(this.snapshot(), this.colorBy(), this.groupBy(), this.focus(), this.project()),
  );

  /** The tile map as it stands, as an image: the same groups, colours, highlights and fading. */
  exportView(
    palette: ExportPalette,
    header: ExportHeader,
  ): { svg: string; width: number; height: number } {
    const TILE_W = 200;
    const TILE_H = 76;
    const GAP = 12;
    const PAD = 16;
    const HEAD = 44;
    const MAX_W = 1400;
    const out: string[] = [];
    let x = 0;
    let y = 0;
    let rowH = 0;
    let width = 0;
    for (const g of this.groups()) {
      const cols = Math.max(1, Math.min(g.columns, g.tiles.length));
      const rows = Math.ceil(g.tiles.length / cols);
      const w = 2 * PAD + cols * TILE_W + (cols - 1) * GAP;
      const h = HEAD + rows * TILE_H + (rows - 1) * GAP + PAD;
      if (x > 0 && x + w > MAX_W) {
        x = 0;
        y += rowH + 20;
        rowH = 0;
      }
      const parts = [
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${palette.card}" stroke="${g.replicas ? palette.brand : palette.border}"/>`,
        `<text x="${x + PAD}" y="${y + 28}" font-size="13" font-weight="600" fill="${palette.fg}">${esc(fit(g.name, w - 160, 13))}<tspan font-size="11" font-weight="400" fill="${palette.muted}" dx="8">${esc(g.meta)}</tspan></text>`,
      ];
      g.tiles.forEach((tile, i) => {
        const tx = x + PAD + (i % cols) * (TILE_W + GAP);
        const ty = y + HEAD + Math.floor(i / cols) * (TILE_H + GAP);
        const value = tileValueColor(palette, tileValueTone(tile, this.colorBy()));
        const s = tile.server;
        parts.push(
          `<g opacity="${tile.dimmed ? 0.35 : 1}">` +
            `<rect x="${tx}" y="${ty}" width="${TILE_W}" height="${TILE_H}" rx="6" fill="${palette.card}" stroke="${tile.replicas || tile.focused ? palette.brand : palette.border}"/>` +
            `<text x="${tx + 12}" y="${ty + 24}" font-size="13" font-weight="600" font-family="${esc(monoFamily())}" fill="${palette.fg}">${esc(fit(tile.label, TILE_W - 70, 13))}</text>` +
            `<text x="${tx + TILE_W - 12}" y="${ty + 24}" text-anchor="end" font-size="12" font-weight="600" fill="${value}">${esc(tile.valueText)}</text>` +
            `<text x="${tx + 12}" y="${ty + 44}" font-size="11" fill="${palette.muted}">${esc(fit([s.role === 'control-plane' ? 'control plane' : 'worker', s.serverType, s.architecture].filter(Boolean).join(' · '), TILE_W - 24, 11))}</text>` +
            `<text x="${tx + 12}" y="${ty + 62}" font-size="11" fill="${palette.muted}">${replicaLine(s.podCount, tile.replicas)}</text>` +
            '</g>',
        );
      });
      out.push(`<g opacity="${g.dimmed ? 0.5 : 1}">${parts.join('')}</g>`);
      x += w + 20;
      rowH = Math.max(rowH, h);
      width = Math.max(width, x - 20);
    }
    return frame(out.join(''), { width, height: y + rowH }, header, palette);
  }

  protected tone(kind: NetworkKind) {
    return networkTone(kind);
  }

  protected pickGroup(value: string): void {
    this.groupByChanged.emit(value as TopologyGroupBy);
  }

  protected pickColor(value: string): void {
    this.colorByChanged.emit(value as TopologyColorBy);
  }

  protected ariaOf(tile: Tile): string {
    const parts = [tile.server.nodeName, tile.server.status, `${tile.valueText} ${this.colorBy()}`];
    if (tile.replicas) parts.push(`${tile.replicas} replicas of the selected app`);
    return parts.join(', ');
  }

  protected move(event: KeyboardEvent): void {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    const target = event.target as HTMLElement;
    const columns = Number(target.dataset['columns']);
    if (!columns) return;
    const jump = { ArrowUp: -columns, ArrowDown: columns }[event.key] ?? step;
    if (!jump) return;
    const tiles = Array.from(
      target.parentElement?.querySelectorAll<HTMLElement>('button[data-columns]') ?? [],
    );
    const next = tiles[tiles.indexOf(target) + jump];
    if (next) {
      next.focus();
      event.preventDefault();
    }
  }
}

function replicaLine(count: number, selected: number): string {
  const total = `${count} replica${count === 1 ? '' : 's'}`;
  return selected ? `${total} · ${selected} selected` : total;
}
