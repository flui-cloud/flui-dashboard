import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
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

const RING: Record<string, string> = {
  healthy: 'hsl(var(--ok))',
  degraded: 'hsl(var(--warn))',
  error: 'hsl(var(--destructive))',
  pending: 'hsl(var(--muted-foreground))',
};

/** One node of the service map: its kind decides what it says, never its colour. */
@Component({
  selector: 'app-topology-graph-node',
  standalone: true,
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideActivity, lucideBoxes, lucideBriefcase, lucideDatabase, lucideGlobe, lucideHardDrive,
      lucideImage, lucideLayers, lucideServer, lucideWorkflow, lucideZap,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (node().kind) {
      @case ('internet') {
        <span class="flex h-full items-center justify-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground">
          <ng-icon name="lucideGlobe" class="h-4 w-4 text-muted-foreground" />Internet
        </span>
      }
      @case ('pill') {
        <span class="flex h-full items-center gap-2 rounded-full border-2 bg-card px-3 text-sm text-foreground"
              [style.border-style]="node().dashed ? 'dashed' : 'solid'" style="border-color: hsl(var(--border))">
          <span class="h-2 w-2 flex-none rounded-full" [class]="'dot-' + node().tone"></span>
          <span class="truncate font-medium">{{ node().label }}</span>
        </span>
      }
      @default {
        <span class="card-surface flex h-full items-center gap-3 px-3 text-left"
              [class.opacity-75]="node().muted" [style.background]="node().muted ? 'hsl(var(--muted) / 0.5)' : null"
              [style.border-style]="node().dashed ? 'dashed' : 'solid'"
              [style.border-width.px]="node().dashed ? 2 : 1">
          <span class="relative flex h-10 w-10 flex-none items-center justify-center rounded-full border-[1.5px] bg-muted/60"
                [style.border-color]="ring()">
            <ng-icon [name]="icon()" class="h-4 w-4 text-foreground" />
            @if (node().replicas > 1) {
              <span class="absolute -bottom-1.5 -right-2 rounded-full px-1 font-mono text-[10px] font-semibold"
                    style="background: hsl(var(--foreground)); color: hsl(var(--background))">×{{ node().replicas }}</span>
            }
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-foreground">{{ node().label }}</span>
            <span class="text-sub block truncate">{{ node().sub }}</span>
            @if (node().dots.length) {
              <span class="mt-1 flex flex-wrap gap-1" aria-hidden="true">
                @for (dot of node().dots; track $index) {
                  <span class="h-1.5 w-1.5 rounded-full" [class]="'dot-' + dot"></span>
                }
              </span>
            }
          </span>
          @if ((node().ingress ?? 0) >= 0.05) {
            <span class="flex-none rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                  [style.background]="node().ingressFailing ? 'hsl(var(--destructive) / 0.12)' : 'hsl(var(--brand) / 0.12)'"
                  [style.color]="node().ingressFailing ? 'hsl(var(--destructive))' : 'hsl(var(--brand))'"
                  [attr.aria-label]="'Ingress ' + ingressText()">↘ {{ ingressText() }}</span>
          }
          @if (node().problems) {
            <span class="badge badge-error flex-none px-1.5 py-0.5 text-[10px]">{{ node().problems }}</span>
          }
        </span>
      }
    }
  `,
})
export class TopologyGraphNodeComponent {
  readonly node = input.required<GraphNode>();

  protected readonly ingressText = computed(() => {
    const rps = this.node().ingress ?? 0;
    return rps >= 10 ? `${Math.round(rps)}/s` : `${rps.toFixed(1)}/s`;
  });

  protected readonly ring = computed(() => RING[this.node().tone] ?? RING['pending']);
  protected readonly icon = computed(() => {
    const n = this.node();
    if (n.kind === 'cluster') return 'lucideBoxes';
    if (n.kind === 'stack') return 'lucideLayers';
    return ICON[n.category ?? ''] ?? 'lucideServer';
  });
}
