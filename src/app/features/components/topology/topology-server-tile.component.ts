import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NETWORK_LABEL, Tile, TileDensity } from './topology-tiles';
import { TileLook } from './topology-tile';
import { percent } from './topology-format';

/** One server: a card while a group has few, a tile once it has many. Same colour either way. */
@Component({
  selector: 'app-topology-server-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @switch (density()) {
      @case ('card') {
        <span class="card-surface relative flex h-full overflow-hidden text-left">
          <span class="w-[3px] flex-none" [style.background]="stripe()" aria-hidden="true"></span>
          <span class="flex min-w-0 flex-1 flex-col gap-2 p-3">
            <span class="flex items-start justify-between gap-2">
              <span class="min-w-0">
                <span class="block truncate font-mono text-sm font-semibold text-foreground" [title]="tile().server.nodeName">{{ tile().label }}</span>
                <span class="text-sub block truncate">{{ subtitle() }}</span>
              </span>
              <span class="flex-none rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold"
                    [style.background]="look().background" [style.color]="look().color">{{ tile().valueText }}</span>
            </span>
            <span class="grid grid-cols-[3.25rem_minmax(0,1fr)_2.5rem] items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              <span>Memory</span>
              <span class="block h-1.5 rounded-full bg-muted"><span class="block h-1.5 rounded-full" [style.width.%]="mem() ?? 0" [style.background]="barColor(mem())"></span></span>
              <span class="text-right font-mono text-foreground">{{ pct(mem()) }}</span>
              <span>CPU</span>
              <span class="block h-1.5 rounded-full bg-muted"><span class="block h-1.5 rounded-full" [style.width.%]="cpu() ?? 0" [style.background]="barColor(cpu())"></span></span>
              <span class="text-right font-mono text-foreground">{{ pct(cpu()) }}</span>
            </span>
            <span class="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{{ tile().server.podCount }} replica{{ tile().server.podCount === 1 ? '' : 's' }}</span>
              <span class="truncate">{{ network() }}</span>
            </span>
          </span>
        </span>
      }
      @case ('medium') {
        <span class="flex h-full flex-col justify-between rounded-md border p-2 text-left font-mono text-[11px] font-medium leading-tight"
              [style.background]="look().background" [style.color]="look().color" [style.border-color]="look().border">
          <span class="line-clamp-2 break-words" [title]="tile().server.nodeName">{{ wrapped() }}</span>
          <span class="flex items-center justify-between">
            <span>{{ tile().valueText }}</span>
            @if (tile().server.architecture === 'arm') {
              <span class="rounded-sm px-0.5 text-[8px] uppercase ring-1 ring-current">arm</span>
            }
          </span>
        </span>
      }
      @default {
        <span class="flex h-full flex-col justify-between rounded-md border p-1.5 text-left font-mono text-[10px] font-medium leading-tight"
              [style.background]="look().background" [style.color]="look().color" [style.border-color]="look().border">
          <span class="truncate" [title]="tile().server.nodeName">{{ tile().label }}</span>
          <span class="flex items-center justify-between">
            <span class="opacity-90">{{ tile().valueText }}</span>
            @if (tile().server.architecture === 'arm') {
              <span class="rounded-sm px-0.5 text-[8px] uppercase opacity-90 ring-1 ring-current">arm</span>
            }
          </span>
        </span>
      }
    }
    @if (tile().replicas) {
      <span class="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style="background: hsl(var(--brand)); color: hsl(var(--primary-foreground)); box-shadow: 0 0 0 2px hsl(var(--card))">{{ tile().replicas }}</span>
    }
  `,
})
export class TopologyServerTileComponent {
  readonly tile = input.required<Tile>();
  readonly look = input.required<TileLook>();
  readonly density = input<TileDensity>('compact');

  protected readonly mem = computed(() => this.tile().server.capacity?.usedMemPct ?? null);
  protected readonly cpu = computed(() => this.tile().server.capacity?.usedCpuPct ?? null);
  /** Lets a long name wrap after a hyphen rather than in the middle of a word. */
  protected readonly wrapped = computed(() => this.tile().label.replaceAll('-', '-\u200B'));
  protected readonly network = computed(() => NETWORK_LABEL[this.tile().network]);
  protected readonly subtitle = computed(() => {
    const s = this.tile().server;
    const role = s.role === 'control-plane' ? 'control plane' : 'worker';
    return [role, s.serverType, s.architecture === 'arm' ? 'arm' : s.architecture].filter(Boolean).join(' · ');
  });

  /** The stripe carries the colour mode; for network it is the network's own colour. */
  protected readonly stripe = computed(() => {
    const look = this.look();
    return look.border !== 'transparent' ? look.border : look.background;
  });

  protected pct(value: number | null): string {
    return percent(value);
  }

  protected barColor(value: number | null): string {
    return (value ?? 0) >= 90 ? 'hsl(var(--destructive))' : 'hsl(var(--brand))';
  }
}
