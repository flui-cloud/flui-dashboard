import { Component, computed, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideArrowDownRight,
  lucideBoxes,
  lucideBriefcase,
  lucideDatabase,
  lucideGlobe,
  lucideHardDrive,
  lucideImage,
  lucideLayers,
  lucideServer,
  lucideWorkflow,
  lucideZap,
} from '@ng-icons/lucide';
import { GraphNode } from './topology-graph';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { kitTone, toneWord } from './topology-kit';

const ICON: Record<string, string> = {
  database: 'lucideDatabase',
  cache: 'lucideZap',
  storage: 'lucideHardDrive',
  automation: 'lucideWorkflow',
  media: 'lucideImage',
  monitoring: 'lucideActivity',
  web: 'lucideGlobe',
  business: 'lucideBriefcase',
  infra: 'lucideServer',
};

/** One node of the service map: its kind decides what it says, never its colour. */
@Component({
  selector: 'app-topology-graph-node',
  imports: [FlIcon, FlStatus],
  providers: [
    provideIcons({
      lucideActivity,
      lucideArrowDownRight,
      lucideBoxes,
      lucideBriefcase,
      lucideDatabase,
      lucideGlobe,
      lucideHardDrive,
      lucideImage,
      lucideLayers,
      lucideServer,
      lucideWorkflow,
      lucideZap,
    }),
  ],
  host: { class: 'block h-full' },
  template: `
    @switch (node().kind) {
      @case ('internet') {
        <span
          class="flex h-full items-center justify-center gap-2 rounded-fl-md border bg-fl-surface px-3 text-fl-body-sm font-medium text-fl-ink"
          [class.border-fl-accent]="selected()"
          [class.border-fl-border]="!selected()"
        >
          <fl-icon class="text-fl-ink-muted" name="lucideGlobe" />Internet
        </span>
      }
      @case ('pill') {
        <span
          class="flex h-full items-center gap-2 rounded-fl-md border bg-fl-surface px-3"
          [class.border-dashed]="node().dashed"
          [class.border-fl-accent]="selected()"
          [class.border-fl-border]="!selected()"
        >
          <fl-status class="flex-none" [tone]="tone()" label="" />
          <span class="truncate font-mono text-fl-body-sm font-medium text-fl-ink">{{
            node().label
          }}</span>
        </span>
      }
      @default {
        <span
          class="flex h-full flex-col justify-center gap-1 rounded-fl-md border px-3 text-left"
          [class.bg-fl-surface]="!node().muted"
          [class.bg-fl-surface-subtle]="node().muted"
          [class.border-dashed]="node().dashed"
          [class.border-fl-accent]="selected()"
          [class.border-fl-ink-muted]="!selected() && node().center"
          [class.border-fl-border]="!selected() && !node().center"
        >
          <span class="flex min-w-0 items-center gap-2">
            <fl-icon class="flex-none text-fl-ink-muted" [name]="icon()" />
            <span
              class="min-w-0 flex-1 truncate font-mono text-fl-body-sm font-semibold"
              [class.text-fl-ink]="!node().muted"
              [class.text-fl-ink-secondary]="node().muted"
              >{{ node().label }}</span
            >
            @if (node().replicas > 1) {
              <span class="flex-none font-mono text-fl-caption text-fl-ink-muted"
                >×{{ node().replicas }}</span
              >
            }
            @if (showIngress()) {
              @if (node().ingressFailing) {
                <fl-status
                  class="ml-auto flex-none"
                  tone="error"
                  [label]="ingressText()"
                  [attr.aria-label]="'Ingress ' + ingressText()"
                />
              } @else {
                <span
                  class="ml-auto inline-flex flex-none items-center gap-1 font-mono text-fl-caption text-fl-ink-secondary"
                  [attr.aria-label]="'Ingress ' + ingressText()"
                  ><fl-icon name="lucideArrowDownRight" [size]="13" />{{ ingressText() }}</span
                >
              }
            }
          </span>
          <span class="flex min-w-0 items-center gap-2">
            <fl-status class="flex-none" [tone]="tone()" [label]="word()" />
            <span class="min-w-0 flex-1 truncate text-fl-caption text-fl-ink-muted">{{
              node().sub
            }}</span>
            @if (node().problems) {
              <fl-status class="flex-none" tone="error" [label]="'' + node().problems" />
            }
          </span>
          @if (node().dots.length) {
            <span class="flex min-w-0 items-center gap-1">
              @for (dot of node().dots; track $index) {
                <fl-status aria-hidden="true" [tone]="kit(dot)" label="" />
              }
            </span>
          }
        </span>
      }
    }
  `,
})
export class TopologyGraphNodeComponent {
  readonly node = input.required<GraphNode>();
  readonly selected = input(false);

  protected readonly ingressText = computed(() => {
    const rps = this.node().ingress ?? 0;
    return rps >= 10 ? `${Math.round(rps)}/s` : `${rps.toFixed(1)}/s`;
  });

  protected readonly showIngress = computed(() => (this.node().ingress ?? 0) >= 0.05);
  protected readonly tone = computed(() => kitTone(this.node().tone));
  protected readonly word = computed(() => toneWord(this.node().tone));
  protected readonly kit = kitTone;
  protected readonly icon = computed(() => {
    const n = this.node();
    if (n.kind === 'cluster') return 'lucideBoxes';
    if (n.kind === 'stack') return 'lucideLayers';
    return ICON[n.category ?? ''] ?? 'lucideServer';
  });
}
