import {
  ChangeDetectionStrategy,
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
import { edgeLabelAt, edgePath, edgeStroke, edgeWidth } from './topology-edges';
import { servicesSvg } from './topology-services-export';
import { PanZoom } from './topology-pan-zoom';
import { TopologyGraphNodeComponent } from './topology-graph-node.component';
import { TopologyServicesControlsComponent } from './topology-services-controls.component';
import { CHIP_H, CHIP_W, placementStrip } from './topology-placement';
import { ExportPalette } from './topology-export';
import { ExportHeader } from './topology-view-export';

@Component({
  selector: 'app-topology-services',
  standalone: true,
  imports: [TopologyGraphNodeComponent, TopologyServicesControlsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .flow { stroke-dasharray: 6 54; animation: topology-flow 2.4s linear infinite; }
    @keyframes topology-flow { to { stroke-dashoffset: -60; } }
    @media (prefers-reduced-motion: reduce) { .flow { animation: none; } }
  `],
  template: `
    <div #viewport class="card-surface touch-none overflow-hidden select-none"
         [class]="expanded() ? 'fixed inset-0 z-50 rounded-none' : 'relative h-[38rem]'"
         (wheel)="view.wheel($event, viewport.getBoundingClientRect())" (pointerdown)="view.start($event)"
         (pointermove)="view.move($event)" (pointerup)="view.end()" (pointerleave)="view.end()" (keydown)="move($event)">
      <app-topology-services-controls
        [snapshot]="snapshot()" [state]="state()" [graph]="graph()" [fleetBy]="fleetBy()"
        [expanded]="expanded()" (expandToggled)="expanded.update((on) => !on)"
        (changed)="levelChanged.emit($event)" (zoomed)="zoomStep($event)" (fitted)="fit()" />

      @if (layout(); as l) {
        <div class="absolute left-0 top-0 origin-top-left"
             [style.transform]="view.transform()"
             [style.width.px]="l.width" [style.height.px]="l.height">
          @for (region of regions(); track region.id) {
            @if (l.nodes.get(region.id); as at) {
              <div class="absolute rounded-xl border bg-muted/30 transition-opacity"
                   [style.opacity]="dimRegion(region) ? 0.35 : 1"
                   [style.left.px]="at.x" [style.top.px]="at.y"
                   [style.width.px]="l.sizes.get(region.id)?.width" [style.height.px]="l.sizes.get(region.id)?.height"
                   [style.border-style]="region.dashed ? 'dashed' : 'solid'"
                   [style.border-color]="isFocused(region) ? 'hsl(var(--brand))' : 'hsl(var(--border))'">
                <button type="button" class="absolute left-3 top-2.5 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted"
                        [attr.aria-label]="region.label + ', ' + region.sub + ', ' + region.tone"
                        [attr.aria-pressed]="isFocused(region)" data-node
                        (pointerdown)="$event.stopPropagation()"
                        (click)="pickRegion(region)"
                        (dblclick)="drill(region)" (keydown.enter)="drill(region)">
                  <span class="h-2 w-2 flex-none rounded-full" [class]="'dot-' + region.tone"></span>
                  <span class="truncate text-sm font-semibold text-foreground">{{ region.label }}</span>
                  <span class="text-sub truncate">{{ region.sub }}</span>
                  @if (region.problems) {
                    <span class="flex-none rounded-full px-1.5 text-[10px] font-semibold" style="background: hsl(var(--destructive) / 0.12); color: hsl(var(--destructive))">{{ region.problems }}</span>
                  }
                </button>
              </div>
            }
          }
          <svg class="absolute inset-0 overflow-visible" [attr.width]="l.width" [attr.height]="l.height" aria-hidden="true">
            @if (strip(); as p) {
              @for (line of p.lines; track $index) {
                <path [attr.d]="line" fill="none" stroke="hsl(var(--muted-foreground) / 0.55)" stroke-width="1" stroke-dasharray="2 4" />
              }
            }
            @for (edge of graph().edges; track edge.id) {
              <g [style.opacity]="dimEdge(edge) ? 0.12 : 1">
                <path [attr.d]="pathOf(l, edge)" fill="none" [attr.stroke]="strokeOf(edge)" [attr.stroke-width]="widthOf(edge)" />
                @if (edge.measured && !edge.failing) {
                  <path class="flow" [attr.d]="pathOf(l, edge)" fill="none" stroke="hsl(var(--brand))"
                        [attr.stroke-width]="widthOf(edge) + 0.25" stroke-linecap="round" />
                }
              </g>
            }
          </svg>
          @for (edge of graph().edges; track edge.id) {
            @if (labelAt(l, edge); as at) {
              <span class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-1.5 py-px font-mono text-[10px] text-muted-foreground"
                    [style.left.px]="at.x" [style.top.px]="at.y" [style.opacity]="dimEdge(edge) ? 0.12 : 1">{{ edge.label }}</span>
            }
          }
          @if (strip(); as p) {
            <span class="text-label absolute whitespace-nowrap" [style.left.px]="p.chips[0].x" [style.top.px]="p.chips[0].y + chipH + 8">{{ p.appName }} runs on</span>
            @for (chip of p.chips; track chip.serverId) {
              <button type="button" class="absolute flex items-center gap-2 rounded-full border border-dashed border-border bg-card px-3 text-left text-xs hover:bg-muted"
                      [style.left.px]="chip.x" [style.top.px]="chip.y" [style.width.px]="chipW" [style.height.px]="chipH"
                      [style.outline]="isServerFocused(chip.serverId) ? '1px solid hsl(var(--brand))' : null"
                      [attr.aria-label]="chip.label + ', ' + chip.count + ' replicas'"
                      title="Double-click to see it among every server"
                      (pointerdown)="$event.stopPropagation()"
                      (click)="selected.emit({ type: 'server', id: chip.serverId })"
                      (dblclick)="levelChanged.emit({ view: 'infrastructure', focus: { type: 'app', id: p.appId } })">
                <span class="h-1.5 w-1.5 flex-none rounded-full" [class]="'dot-' + chip.tone"></span>
                <span class="min-w-0 flex-1 truncate font-mono text-foreground">{{ chip.label }}</span>
                <span class="flex-none font-mono text-muted-foreground">×{{ chip.count }}</span>
              </button>
            }
          }
          @for (node of drawn(); track node.id) {
            @if (l.nodes.get(node.id); as at) {
              <button type="button" class="absolute rounded-lg text-left transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      [style.left.px]="at.x" [style.top.px]="at.y" [style.width.px]="node.width" [style.height.px]="node.height"
                      [style.opacity]="dimNode(node) ? 0.15 : 1"
                      [style.outline]="isFocused(node) ? '1px solid hsl(var(--brand))' : null"
                      [style.box-shadow]="node.center ? '0 0 0 6px hsl(var(--brand) / 0.12)' : null"
                      [style.outline-offset.px]="2"
                      [attr.aria-label]="node.label + ', ' + node.sub + ', ' + node.tone"
                      [attr.aria-pressed]="isFocused(node)" data-node
                      (pointerdown)="$event.stopPropagation()"
                      (click)="node.focus && selected.emit(node.focus)"
                      (dblclick)="drill(node)" (keydown.enter)="drill(node)">
                <app-topology-graph-node [node]="node" />
              </button>
            }
          }
        </div>
      } @else {
        <div class="skeleton absolute inset-12"></div>
      }
    </div>
  `,
})
export class TopologyServicesComponent {
  readonly snapshot = input.required<TopologyResponseDto>();
  readonly state = input.required<TopologyViewState>();
  readonly focus = input<TopologyFocus | null>(null);
  readonly selected = output<TopologyFocus>();
  readonly opened = output<TopologyFocus>();
  readonly levelChanged = output<Partial<TopologyViewState>>();

  /** What the fleet level shows now, chosen or not. */
  protected readonly fleetBy = computed(() => (this.graph().nodes.some((n) => n.kind === 'region') ? 'apps' : 'clusters'));
  protected readonly regions = computed(() => this.graph().nodes.filter((n) => n.kind === 'region'));
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
    return { nodes, edges: new Set(graph.edges.filter((e) => nodes.has(e.from) && nodes.has(e.to)).map((e) => e.id)) };
  });
  /** In the app level, the servers under the selected app, or under the centre when nothing else is selected. */
  protected readonly strip = computed(() => {
    const graph = this.graph();
    const layout = this.layout();
    if (!layout) return null;
    const focus = this.focus();
    const selected = focus?.type === 'app' ? graph.nodes.find((n) => n.kind === 'app' && n.id === focus.id) : null;
    // Around a centred app the strip is always there; on the fleet's apps it follows the selection.
    const node = selected ?? (graph.level === 'app' ? graph.nodes.find((n) => n.center) : undefined);
    if (!node) return null;
    const others = graph.nodes
      .filter((n) => n.id !== node.id && layout.nodes.has(n.id))
      .map((n) => ({ ...layout.nodes.get(n.id)!, width: n.width, height: n.height }));
    return placementStrip(this.snapshot(), layout, node.id, node, others);
  });
  private fittedFor = '';

  constructor() {
    const resize = new ResizeObserver(() => this.fit());
    effect((onCleanup) => {
      resize.observe(this.viewport().nativeElement);
      onCleanup(() => resize.disconnect());
    });
    // Captured before the page's own Escape, which would also clear the selection.
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

  protected readonly strokeOf = edgeStroke;
  protected readonly widthOf = edgeWidth;

  exportView(palette: ExportPalette, header: ExportHeader): { svg: string; width: number; height: number } | null {
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

  /** Boxes fade only for a project filter: selecting an app inside one must not fade its frame. */
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

  /** A cluster box selects its cluster; a project box narrows the map to that project, or back. */
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

  protected drill(node: GraphNode): void {
    if (node.drill) this.levelChanged.emit(node.drill);
    else if (node.focus) this.opened.emit(node.focus);
  }

  protected fit(): void {
    const layout = this.layout();
    if (!layout) return;
    const height = layout.height + (untracked(() => this.strip())?.extra ?? 0);
    this.view.fit(this.viewport().nativeElement.getBoundingClientRect(), { width: layout.width, height });
  }

  protected zoomStep(factor: number): void {
    this.view.step(factor);
  }

  /** Arrows walk the nodes in drawing order. */
  protected move(event: KeyboardEvent): void {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const target = event.target as HTMLElement;
    if (!step || !('node' in target.dataset)) return;
    const nodes = Array.from(this.viewport().nativeElement.querySelectorAll<HTMLElement>('[data-node]'));
    const next = nodes[nodes.indexOf(target) + step];
    if (next) {
      next.focus();
      event.preventDefault();
    }
  }
}
