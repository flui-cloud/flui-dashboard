import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyColorBy, TopologyFocus, TopologyGroupBy } from './topology-state';
import { NETWORK_LABEL, NetworkKind, Tile, TileDensity, tileGroups } from './topology-tiles';
import { tileLook } from './topology-tile';
import { ExportPalette } from './topology-export';
import { ExportHeader, esc, fit, frame, resolveColor } from './topology-view-export';
import { TopologyNetworkStripComponent } from './topology-network-strip.component';
import { TopologyChoiceComponent } from './topology-choice.component';
import { TopologyServerTileComponent } from './topology-server-tile.component';

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
  card: { width: 'minmax(13rem, 15rem)', height: '8.5rem' },
  medium: { width: '7rem', height: '4.5rem' },
  compact: { width: '4.5rem', height: '3.5rem' },
};

@Component({
  selector: 'app-topology-infrastructure',
  standalone: true,
  imports: [TopologyNetworkStripComponent, TopologyChoiceComponent, TopologyServerTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <app-topology-choice label="Group by" [choices]="groupChoices" [value]="groupBy()"
                             (changed)="groupByChanged.emit($any($event))" />
        <app-topology-choice label="Color by" [choices]="colorChoices" [value]="colorBy()"
                             (changed)="colorByChanged.emit($any($event))" />
      </div>

      @if (colorBy() === 'network') {
        <app-topology-network-strip [snapshot]="snapshot()" [focus]="focus()" (selected)="selected.emit($event)" />
      }

      @if (!snapshot().servers.length) {
        <section class="card-surface space-y-1 p-6" aria-label="No servers">
          <h2 class="text-sm font-semibold text-foreground">{{ silent() ? 'No server could be read' : 'No server yet' }}</h2>
          <p class="text-sub">
            {{ silent() ? silent() + ' of ' + snapshot().clusters.length + ' clusters are not answering. Their servers appear here as soon as they do.' : 'Servers appear here once a cluster has some.' }}
          </p>
        </section>
      }

      <div class="flex flex-wrap items-start gap-4" (keydown)="move($event)">
        @for (group of groups(); track group.key) {
          <section class="card-surface p-4 transition-opacity"
                   [class.opacity-50]="group.dimmed"
                   [style.border-color]="group.replicas ? 'hsl(var(--brand))' : null"
                   [attr.aria-label]="group.name + ', ' + group.meta">
            <header class="mb-3 flex items-baseline gap-2">
              @if (group.clusterId) {
                <button type="button" class="text-sm font-semibold text-foreground hover:underline"
                        (click)="selected.emit({ type: 'cluster', id: group.clusterId })">{{ group.name }}</button>
              } @else {
                <span class="text-sm font-semibold text-foreground">{{ group.name }}</span>
              }
              <span class="text-sub">{{ group.meta }}</span>
              @if (group.replicas) {
                <span class="ml-auto text-xs font-semibold" style="color: hsl(var(--brand))">{{ group.replicas }} replica{{ group.replicas === 1 ? '' : 's' }}</span>
              }
            </header>
            <div class="grid" [class.gap-3]="group.density === 'card'" [class.gap-1.5]="group.density !== 'card'"
                 [style.grid-template-columns]="'repeat(' + group.columns + ', ' + SIZE[group.density].width + ')'">
              @for (tile of group.tiles; track tile.server.id) {
                <button type="button"
                        class="relative rounded-lg text-left transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        [style.height]="SIZE[group.density].height"
                        [style.outline]="tile.replicas || tile.focused ? '1px solid hsl(var(--brand))' : null"
                        [style.outline-offset.px]="2"
                        [class.opacity-30]="tile.dimmed"
                        [attr.data-columns]="group.columns"
                        [attr.aria-label]="ariaOf(tile)"
                        [attr.aria-pressed]="tile.focused"
                        (click)="selected.emit({ type: 'server', id: tile.server.id })"
                        (dblclick)="opened.emit({ type: 'server', id: tile.server.id })">
                  <app-topology-server-tile class="h-full" [tile]="tile" [look]="look(tile)" [density]="group.density" />
                </button>
              }
            </div>
          </section>
        }
      </div>

      @if (snapshot().servers.length) {
      <p class="text-sub flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Legend">
        @if (colorBy() === 'network') {
          @for (kind of networkOrder; track kind) {
            <span class="inline-flex items-center gap-1.5">
              <span class="h-3 w-3 rounded-sm border-2" [style.background]="legendLook(kind).background" [style.border-color]="legendLook(kind).border"></span>
              {{ networkLabel[kind] }}
            </span>
          }
        } @else {
          <span class="inline-flex items-center gap-1.5">
            {{ colorBy() === 'pods' ? 'Fewer replicas' : '30%' }}
            <span class="h-2.5 w-24 rounded-sm" style="background: linear-gradient(90deg, hsl(var(--brand) / 0.12), hsl(var(--brand) / 0.9))"></span>
            {{ colorBy() === 'pods' ? 'More' : '89%' }}
          </span>
          @if (colorBy() !== 'pods') {
            <span class="inline-flex items-center gap-1.5"><span class="h-3 w-3 rounded-sm" style="background: hsl(var(--destructive))"></span> 90% or more</span>
          }
        }
        @if (hasArm()) {
          <span class="inline-flex items-center gap-1.5"><span class="rounded-sm px-0.5 font-mono text-[8px] uppercase ring-1 ring-current">arm</span> Arm server</span>
        }
      </p>
      }
    </div>
  `,
})
export class TopologyInfrastructureComponent {
  readonly snapshot = input.required<TopologyResponseDto>();
  readonly focus = input<TopologyFocus | null>(null);
  readonly colorBy = input<TopologyColorBy>('memory');
  readonly groupBy = input<TopologyGroupBy>('cluster');
  readonly project = input<string | null>(null);

  /** The arm marker is explained only where one is drawn: otherwise the legend reads as a claim. */
  protected readonly hasArm = computed(() => this.snapshot().servers.some((s) => s.architecture === 'arm'));
  protected readonly silent = computed(() => this.snapshot().clusters.filter((c) => c.status === 'down').length);
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
  private readonly maxPods = computed(() =>
    Math.max(0, ...this.snapshot().servers.map((s) => s.podCount)),
  );

  /** The tile map as it stands, as an image: the same groups, colours, highlights and fading. */
  exportView(palette: ExportPalette, header: ExportHeader): { svg: string; width: number; height: number } {
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
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${palette.card}" stroke="${g.replicas ? palette.brand : palette.border}"/>`,
        `<text x="${x + PAD}" y="${y + 28}" font-size="13" font-weight="600" fill="${palette.fg}">${esc(fit(g.name, w - 160, 13))}<tspan font-size="11" font-weight="400" fill="${palette.muted}" dx="8">${esc(g.meta)}</tspan></text>`,
      ];
      g.tiles.forEach((tile, i) => {
        const tx = x + PAD + (i % cols) * (TILE_W + GAP);
        const ty = y + HEAD + Math.floor(i / cols) * (TILE_H + GAP);
        const look = this.look(tile);
        const border = look.border !== 'transparent' ? resolveColor(look.border) : palette.border;
        const ink = resolveColor(look.color);
        const s = tile.server;
        parts.push(
          `<g opacity="${tile.dimmed ? 0.35 : 1}">` +
            `<rect x="${tx}" y="${ty}" width="${TILE_W}" height="${TILE_H}" rx="8" fill="${resolveColor(look.background)}" stroke="${tile.replicas || tile.focused ? palette.brand : border}"/>` +
            `<text x="${tx + 12}" y="${ty + 24}" font-size="13" font-weight="600" font-family="ui-monospace, monospace" fill="${ink}">${esc(fit(tile.label, TILE_W - 70, 13))}</text>` +
            `<text x="${tx + TILE_W - 12}" y="${ty + 24}" text-anchor="end" font-size="12" font-weight="700" fill="${ink}">${esc(tile.valueText)}</text>` +
            `<text x="${tx + 12}" y="${ty + 44}" font-size="11" fill="${ink}" fill-opacity="0.8">${esc(fit([s.role === 'control-plane' ? 'control plane' : 'worker', s.serverType, s.architecture].filter(Boolean).join(' · '), TILE_W - 24, 11))}</text>` +
            `<text x="${tx + 12}" y="${ty + 62}" font-size="11" fill="${ink}" fill-opacity="0.8">${replicaLine(s.podCount, tile.replicas)}</text>` +
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

  protected look(tile: Tile) {
    return tileLook(tile, this.colorBy(), this.maxPods());
  }

  protected legendLook(kind: NetworkKind) {
    return tileLook({ network: kind } as Tile, 'network', 0);
  }

  protected ariaOf(tile: Tile): string {
    const parts = [tile.server.nodeName, tile.server.status, `${tile.valueText} ${this.colorBy()}`];
    if (tile.replicas) parts.push(`${tile.replicas} replicas of the selected app`);
    return parts.join(', ');
  }

  /** Arrows walk the tiles of a group in reading order; up and down jump a row. */
  protected move(event: KeyboardEvent): void {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    const target = event.target as HTMLElement;
    const columns = Number(target.dataset['columns']);
    if (!columns) return;
    const jump = { ArrowUp: -columns, ArrowDown: columns }[event.key] ?? step;
    if (!jump) return;
    const tiles = Array.from(target.parentElement?.querySelectorAll<HTMLElement>('button[data-columns]') ?? []);
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
