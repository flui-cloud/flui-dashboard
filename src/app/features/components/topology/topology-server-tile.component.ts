import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { FULL_PCT, NETWORK_LABEL, Tile, TileDensity } from './topology-tiles';
import { TopologyColorBy } from './topology-state';
import { networkTone } from './topology-kit';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-topology-server-tile',
  imports: [NgTemplateOutlet, FlUsageBar, FlStatus],
  host: { class: 'block' },
  template: `
    <span
      class="flex h-full flex-col rounded-fl-md border bg-fl-surface text-left"
      [class.border-fl-accent]="highlighted()"
      [class.border-fl-border]="!highlighted()"
      [class.gap-2]="density() === 'card'"
      [class.p-3]="density() === 'card'"
      [class.justify-between]="density() !== 'card'"
      [class.p-2]="density() === 'medium'"
      [class.p-1]="density() === 'compact'"
    >
      @switch (density()) {
        @case ('card') {
          <span class="flex items-start justify-between gap-2">
            <span class="min-w-0">
              <span
                class="block truncate font-mono text-fl-body-sm font-semibold text-fl-ink"
                [title]="tile().server.nodeName"
                >{{ tile().label }}</span
              >
              <span class="block truncate text-fl-caption text-fl-ink-muted">{{ subtitle() }}</span>
            </span>
            <ng-container [ngTemplateOutlet]="value" />
          </span>
          @for (bar of bars(); track bar.name) {
            @if (bar.value === null) {
              <span class="flex justify-between text-fl-caption text-fl-ink-muted">
                <span>No data</span><span>{{ bar.name }}</span>
              </span>
            } @else {
              <fl-usage-bar
                [percent]="bar.value"
                [label]="bar.name + ' of ' + tile().server.nodeName"
                [aside]="bar.name"
                [warnAt]="full"
                [criticalAt]="full"
              />
            }
          }
          <span class="mt-auto flex items-center justify-between gap-2 text-fl-caption">
            <span class="text-fl-ink-muted">{{ replicaLine() }}</span>
            <fl-status
              class="min-w-0 truncate"
              [tone]="networkTone()"
              [label]="network()"
              [title]="network()"
            />
          </span>
        }
        @default {
          <span
            class="font-mono text-fl-caption font-medium text-fl-ink"
            [class.line-clamp-2]="density() === 'medium'"
            [class.break-words]="density() === 'medium'"
            [class.truncate]="density() === 'compact'"
            [title]="tile().server.nodeName"
            >{{ density() === 'medium' ? wrapped() : tile().label }}</span
          >
          @if (percentMode() && tile().value !== null) {
            <span [class.fl-usage--critical]="isFull()"
              ><span class="fl-bar" aria-hidden="true"
                ><span [style.width.%]="barWidth()"></span></span
            ></span>
          }
          <span class="flex items-center justify-between gap-1">
            <ng-container [ngTemplateOutlet]="value" />
            @if (tile().replicas) {
              <span class="font-mono text-fl-caption font-semibold text-fl-accent"
                >×{{ tile().replicas }}</span
              >
            }
            @if (tile().server.architecture === 'arm') {
              <span
                class="rounded-fl-sm border border-fl-border px-0.5 font-mono text-fl-caption text-fl-ink-muted"
                >arm</span
              >
            }
          </span>
        }
      }
    </span>

    <ng-template #value>
      @if (colorBy() === 'network') {
        <fl-status class="min-w-0" [tone]="networkTone()" [label]="tile().valueText" />
      } @else if (isFull()) {
        <fl-status class="flex-none" tone="error" [label]="tile().valueText" />
      } @else {
        <span class="flex-none font-mono text-fl-caption font-semibold text-fl-ink">{{
          tile().valueText
        }}</span>
      }
    </ng-template>
  `,
})
export class TopologyServerTileComponent {
  readonly tile = input.required<Tile>();
  readonly colorBy = input<TopologyColorBy>('memory');
  readonly density = input<TileDensity>('compact');

  protected readonly full = FULL_PCT;
  protected readonly bars = computed(() => {
    const capacity = this.tile().server.capacity;
    return [
      { name: 'Memory', value: capacity?.usedMemPct ?? null },
      { name: 'CPU', value: capacity?.usedCpuPct ?? null },
    ];
  });
  protected readonly wrapped = computed(() => this.tile().label.replaceAll('-', '-​'));
  protected readonly network = computed(() => NETWORK_LABEL[this.tile().network]);
  protected readonly networkTone = computed(() => networkTone(this.tile().network));
  protected readonly highlighted = computed(() => !!this.tile().replicas || this.tile().focused);
  protected readonly percentMode = computed(
    () => this.colorBy() === 'memory' || this.colorBy() === 'cpu',
  );
  protected readonly isFull = computed(
    () => this.percentMode() && (this.tile().value ?? 0) >= FULL_PCT,
  );
  protected readonly barWidth = computed(() => Math.min(100, Math.max(0, this.tile().value ?? 0)));
  protected readonly subtitle = computed(() => {
    const s = this.tile().server;
    const role = s.role === 'control-plane' ? 'control plane' : 'worker';
    return [role, s.serverType, s.architecture].filter(Boolean).join(' · ');
  });
  protected readonly replicaLine = computed(() => {
    const count = this.tile().server.podCount;
    const total = `${count} replica${count === 1 ? '' : 's'}`;
    const selected = this.tile().replicas;
    return selected ? `${total} · ${selected} selected` : total;
  });
}
