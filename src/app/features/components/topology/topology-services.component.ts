import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyFocus, TopologyViewState } from './topology-state';
import { GraphEdge, GraphNode, litBy, projectLit, topologyGraph } from './topology-graph';
import { GraphLayout, layoutGraph } from './topology-layout';
import { edgeLabelAt, edgePath, edgeWidth } from './topology-edges';
import { servicesSvg } from './topology-services-export';
import { PanZoom } from './topology-pan-zoom';
import { TopologyGraphNodeComponent } from './topology-graph-node.component';
import { TopologyServicesControlsComponent } from './topology-services-controls.component';
import { CHIP_H, CHIP_W, placementStrip } from './topology-placement';
import { ExportPalette } from './topology-export';
import { ExportHeader } from './topology-view-export';
import { kitTone } from './topology-kit';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-topology-services',
  imports: [
    FlPanel,
    FlStatus,
    FlLoadingState,
    TopologyGraphNodeComponent,
    TopologyServicesControlsComponent,
  ],
  host: { class: 'fl-stack' },
  styles: [
    `
      .viewport {
        height: 38rem;
      }
      .edge {
        stroke: var(--fl-ink-muted);
        stroke-opacity: 0.5;
      }
      .edge--measured {
        stroke: var(--fl-ink-secondary);
        stroke-opacity: 0.7;
      }
      .edge--failing {
        stroke: var(--fl-danger);
        stroke-opacity: 0.85;
      }
      .placement {
        stroke: var(--fl-ink-muted);
        stroke-opacity: 0.6;
      }
      .flow {
        stroke: var(--fl-accent);
        stroke-dasharray: 6 54;
        animation: topology-flow 2.4s linear infinite;
      }
      @keyframes topology-flow {
        to {
          stroke-dashoffset: -60;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .flow {
          animation: none;
        }
      }
    `,
  ],
  template: `
    <fl-panel [flush]="true">
      <div
        #viewport
        class="touch-none select-none overflow-hidden bg-fl-surface"
        [class]="expanded() ? 'fixed inset-0 z-50' : 'viewport relative rounded-fl-lg'"
        (wheel)="view.wheel($event, viewport.getBoundingClientRect())"
        (pointerdown)="view.start($event)"
        (pointermove)="view.move($event)"
        (pointerup)="view.end()"
        (pointerleave)="view.end()"
        (keydown)="move($event)"
      >
        <app-topology-services-controls
          [snapshot]="snapshot()"
          [state]="state()"
          [graph]="graph()"
          [fleetBy]="fleetBy()"
          [expanded]="expanded()"
          (expandToggled)="expanded.update((on) => !on)"
          (changed)="levelChanged.emit($event)"
          (zoomed)="zoomStep($event)"
          (fitted)="fit()"
        />

        @if (layout(); as l) {
          <div
            class="absolute left-0 top-0 origin-top-left"
            [style.transform]="view.transform()"
            [style.width.px]="l.width"
            [style.height.px]="l.height"
          >
            @for (region of regions(); track region.id) {
              @if (l.nodes.get(region.id); as at) {
                <div
                  class="absolute rounded-fl-lg border bg-fl-surface-subtle transition-opacity"
                  [class.border-dashed]="region.dashed"
                  [class.border-fl-accent]="isFocused(region)"
                  [class.border-fl-border]="!isFocused(region)"
                  [class.opacity-40]="dimRegion(region)"
                  [style.left.px]="at.x"
                  [style.top.px]="at.y"
                  [style.width.px]="l.sizes.get(region.id)?.width"
                  [style.height.px]="l.sizes.get(region.id)?.height"
                >
                  <button
                    type="button"
                    class="absolute left-3 right-3 top-2.5 flex items-center gap-2 rounded-fl-sm px-1.5 py-1 text-left hover:bg-fl-surface-hover focus-visible:shadow-fl-focus focus-visible:outline-none"
                    [attr.aria-label]="region.label + ', ' + region.sub + ', ' + region.tone"
                    [attr.aria-pressed]="isFocused(region)"
                    data-node
                    (pointerdown)="$event.stopPropagation()"
                    (click)="pickRegion(region)"
                    (dblclick)="drill(region)"
                    (keydown.enter)="drill(region)"
                  >
                    <fl-status class="flex-none" [tone]="kit(region.tone)" label="" />
                    <span class="truncate text-fl-body-sm font-semibold text-fl-ink">{{
                      region.label
                    }}</span>
                    <span class="truncate text-fl-caption text-fl-ink-muted">{{ region.sub }}</span>
                    @if (region.problems) {
                      <fl-status class="flex-none" tone="error" [label]="'' + region.problems" />
                    }
                  </button>
                </div>
              }
            }
            <svg
              class="absolute inset-0 overflow-visible"
              [attr.width]="l.width"
              [attr.height]="l.height"
              aria-hidden="true"
            >
              @if (strip(); as p) {
                @for (line of p.lines; track $index) {
                  <path
                    class="placement"
                    [attr.d]="line"
                    fill="none"
                    stroke-width="1"
                    stroke-dasharray="2 4"
                  />
                }
              }
              @for (edge of graph().edges; track edge.id) {
                <g [attr.opacity]="dimEdge(edge) ? 0.12 : 1">
                  <path
                    class="edge"
                    [class.edge--measured]="edge.measured && !edge.failing"
                    [class.edge--failing]="edge.failing"
                    [attr.d]="pathOf(l, edge)"
                    fill="none"
                    [attr.stroke-width]="widthOf(edge)"
                  />
                  @if (edge.measured && !edge.failing) {
                    <path
                      class="flow"
                      [attr.d]="pathOf(l, edge)"
                      fill="none"
                      [attr.stroke-width]="widthOf(edge) + 0.25"
                      stroke-linecap="round"
                    />
                  }
                </g>
              }
            </svg>
            @for (edge of graph().edges; track edge.id) {
              @if (labelAt(l, edge); as at) {
                <span
                  class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-fl-sm border border-fl-border bg-fl-surface px-1 font-mono text-fl-caption text-fl-ink-muted"
                  [class.opacity-10]="dimEdge(edge)"
                  [style.left.px]="at.x"
                  [style.top.px]="at.y"
                  >{{ edge.label }}</span
                >
              }
            }
            @if (strip(); as p) {
              <span
                class="absolute whitespace-nowrap text-fl-caption text-fl-ink-muted"
                [style.left.px]="p.chips[0].x"
                [style.top.px]="p.chips[0].y + chipH + 8"
                >{{ p.appName }} runs on</span
              >
              @for (chip of p.chips; track chip.serverId) {
                <button
                  type="button"
                  class="absolute flex items-center gap-2 rounded-fl-md border bg-fl-surface px-3 text-left hover:bg-fl-surface-hover focus-visible:shadow-fl-focus focus-visible:outline-none"
                  [class.border-dashed]="!isServerFocused(chip.serverId)"
                  [class.border-fl-border]="!isServerFocused(chip.serverId)"
                  [class.border-fl-accent]="isServerFocused(chip.serverId)"
                  [style.left.px]="chip.x"
                  [style.top.px]="chip.y"
                  [style.width.px]="chipW"
                  [style.height.px]="chipH"
                  [attr.aria-label]="chip.label + ', ' + chip.count + ' replicas'"
                  title="Double-click to see it among every server"
                  (pointerdown)="$event.stopPropagation()"
                  (click)="selected.emit({ type: 'server', id: chip.serverId })"
                  (dblclick)="
                    levelChanged.emit({
                      view: 'infrastructure',
                      focus: { type: 'app', id: p.appId },
                    })
                  "
                >
                  <fl-status class="flex-none" [tone]="kit(chip.tone)" label="" />
                  <span class="min-w-0 flex-1 truncate font-mono text-fl-caption text-fl-ink">{{
                    chip.label
                  }}</span>
                  <span class="flex-none font-mono text-fl-caption text-fl-ink-muted"
                    >×{{ chip.count }}</span
                  >
                </button>
              }
            }
            @for (node of drawn(); track node.id) {
              @if (l.nodes.get(node.id); as at) {
                <button
                  type="button"
                  class="absolute rounded-fl-md text-left transition-opacity focus-visible:shadow-fl-focus focus-visible:outline-none"
                  [class.opacity-20]="dimNode(node)"
                  [style.left.px]="at.x"
                  [style.top.px]="at.y"
                  [style.width.px]="node.width"
                  [style.height.px]="node.height"
                  [attr.aria-label]="node.label + ', ' + node.sub + ', ' + node.tone"
                  [attr.aria-pressed]="isFocused(node)"
                  data-node
                  (pointerdown)="$event.stopPropagation()"
                  (click)="node.focus && selected.emit(node.focus)"
                  (dblclick)="drill(node)"
                  (keydown.enter)="drill(node)"
                >
                  <app-topology-graph-node [node]="node" [selected]="isFocused(node)" />
                </button>
              }
            }
          </div>
        } @else {
          <div class="absolute inset-x-0 top-16 px-6">
            <fl-loading-state [rows]="6" />
          </div>
        }
      </div>
    </fl-panel>
  `,
})
export class TopologyServicesComponent {
  readonly snapshot = input.required<TopologyResponseDto>();
  readonly state = input.required<TopologyViewState>();
  readonly focus = input<TopologyFocus | null>(null);
  readonly selected = output<TopologyFocus>();
  readonly opened = output<TopologyFocus>();
  readonly levelChanged = output<Partial<TopologyViewState>>();

  protected readonly fleetBy = computed(() =>
    this.graph().nodes.some((n) => n.kind === 'region') ? 'apps' : 'clusters',
  );
  protected readonly regions = computed(() =>
    this.graph().nodes.filter((n) => n.kind === 'region'),
  );
  protected readonly drawn = computed(() => this.graph().nodes.filter((n) => n.kind !== 'region'));
  protected readonly chipW = CHIP_W;
  protected readonly chipH = CHIP_H;
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  protected readonly graph = computed(() => topologyGraph(this.snapshot(), this.state()));
  protected readonly layout = signal<GraphLayout | null>(null);
  protected readonly view = new PanZoom();
  protected readonly expanded = signal(false);
  private readonly lit = computed(() => {
    const graph = this.graph();
    const focus = this.focus();
    const centred = graph.level === 'app' && focus?.type === 'app' && focus.id === this.state().app;
    const byFocus = centred ? null : litBy(graph, focus);
    const project = this.state().project;
    if (byFocus || !project) return byFocus;
    const nodes = projectLit(this.snapshot(), graph, project);
    return {
      nodes,
      edges: new Set(
        graph.edges.filter((e) => nodes.has(e.from) && nodes.has(e.to)).map((e) => e.id),
      ),
    };
  });
  protected readonly strip = computed(() => {
    const graph = this.graph();
    const layout = this.layout();
    if (!layout) return null;
    const focus = this.focus();
    const selected =
      focus?.type === 'app' ? graph.nodes.find((n) => n.kind === 'app' && n.id === focus.id) : null;
    const node =
      selected ?? (graph.level === 'app' ? graph.nodes.find((n) => n.center) : undefined);
    if (!node) return null;
    const others = graph.nodes
      .filter((n) => n.id !== node.id && layout.nodes.has(n.id))
      .map((n) => ({ ...layout.nodes.get(n.id)!, width: n.width, height: n.height }));
    return placementStrip(this.snapshot(), layout, node.id, node, others);
  });
  private fittedFor = '';
  private refocusNodes = false;

  constructor() {
    const resize = new ResizeObserver(() => this.fit());
    effect((onCleanup) => {
      resize.observe(this.viewport().nativeElement);
      onCleanup(() => resize.disconnect());
    });
    const leave = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.expanded()) return;
      event.stopPropagation();
      this.expanded.set(false);
    };
    document.addEventListener('keydown', leave, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('keydown', leave, true));
    effect(() => {
      const graph = this.graph();
      void layoutGraph(graph).then((layout) => {
        this.layout.set(layout);
        if (untracked(() => this.refocusNodes)) requestAnimationFrame(() => this.refocus());
        const key = `${graph.level}|${this.state().cluster}|${this.state().app}|${graph.nodes.length}`;
        if (untracked(() => this.fittedFor) !== key) {
          this.fittedFor = key;
          requestAnimationFrame(() => this.fit());
        }
      });
    });
  }

  protected pathOf(layout: GraphLayout, edge: GraphEdge): string {
    return edgePath(this.graph(), layout, edge);
  }

  protected labelAt(layout: GraphLayout, edge: GraphEdge) {
    return edgeLabelAt(this.graph(), layout, edge);
  }

  protected readonly kit = kitTone;
  protected readonly widthOf = edgeWidth;

  exportView(
    palette: ExportPalette,
    header: ExportHeader,
  ): { svg: string; width: number; height: number } | null {
    const layout = this.layout();
    if (!layout) return null;
    return servicesSvg(
      {
        graph: this.graph(),
        layout,
        strip: this.strip(),
        dimRegion: (n) => this.dimRegion(n),
        dimNode: (n) => this.dimNode(n),
        dimEdge: (e) => this.dimEdge(e),
        isFocused: (n) => this.isFocused(n),
      },
      palette,
      header,
    );
  }

  protected dimRegion(region: GraphNode): boolean {
    const project = this.state().project;
    return !!project && !projectLit(this.snapshot(), this.graph(), project).has(region.id);
  }

  protected dimNode(node: GraphNode): boolean {
    const lit = this.lit();
    return !!lit && !lit.nodes.has(node.id);
  }

  protected dimEdge(edge: GraphEdge): boolean {
    const lit = this.lit();
    return !!lit && !lit.edges.has(edge.id);
  }

  protected pickRegion(region: GraphNode): void {
    if (region.focus) {
      this.selected.emit(region.focus);
      return;
    }
    const id = region.id.slice('region:'.length);
    const project = this.snapshot().projects.some((p) => p.id === id) ? id : null;
    this.levelChanged.emit({ project: this.state().project === project ? null : project });
  }

  protected isServerFocused(id: string): boolean {
    const f = this.focus();
    return f?.type === 'server' && f.id === id;
  }

  protected isFocused(node: GraphNode): boolean {
    const f = this.focus();
    return !!f && node.focus?.type === f.type && node.focus.id === f.id;
  }

  private refocus(): void {
    this.refocusNodes = false;
    const host = this.viewport().nativeElement;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    host.querySelector<HTMLElement>('[data-node]')?.focus();
  }

  protected drill(node: GraphNode): void {
    this.refocusNodes = this.viewport().nativeElement.contains(document.activeElement);
    if (node.drill) this.levelChanged.emit(node.drill);
    else if (node.focus) this.opened.emit(node.focus);
  }

  protected fit(): void {
    const layout = this.layout();
    if (!layout) return;
    const height = layout.height + (untracked(() => this.strip())?.extra ?? 0);
    this.view.fit(this.viewport().nativeElement.getBoundingClientRect(), {
      width: layout.width,
      height,
    });
  }

  protected zoomStep(factor: number): void {
    this.view.step(factor);
  }

  protected move(event: KeyboardEvent): void {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const target = event.target as HTMLElement;
    if (!step || !('node' in target.dataset)) return;
    const nodes = Array.from(
      this.viewport().nativeElement.querySelectorAll<HTMLElement>('[data-node]'),
    );
    const next = nodes[nodes.indexOf(target) + step];
    if (next) {
      next.focus();
      event.preventDefault();
    }
  }
}
