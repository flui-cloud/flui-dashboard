import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { paletteFromDocument } from './topology-export';
import { downloadView } from './topology-view-export';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { TopologyStore } from './topology.store';
import { TopologyFocus } from './topology-state';
import { TopologyInspectorComponent } from './topology-inspector.component';
import { TopologyListComponent } from './topology-list.component';
import { TopologyInfrastructureComponent } from './topology-infrastructure.component';
import { TopologyInfraPanelsComponent } from './topology-infra-panels.component';
import { TopologyChoiceComponent } from './topology-choice.component';
import { TopologyServicesComponent } from './topology-services.component';
import { TopologyCapacityComponent } from './topology-capacity.component';
import { TopologyRequestPathComponent } from './topology-request-path.component';
import { destinationsFor } from './topology-navigation';
import { Router } from '@angular/router';
import {
  TopologySurfaceRevision,
  buildTopologySurface,
  presentedContent,
} from './topology-surface';

@Component({
  selector: 'app-topology-page',
  standalone: true,
  imports: [
    TopologyInspectorComponent,
    TopologyListComponent,
    TopologyInfrastructureComponent,
    TopologyInfraPanelsComponent,
    TopologyChoiceComponent,
    TopologyServicesComponent,
    TopologyCapacityComponent,
    TopologyRequestPathComponent,
  ],
  providers: [TopologyStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'clear()' },
  template: `
    <div class="flex h-full flex-col gap-4 p-4 sm:p-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-foreground">Topology</h1>
          @if (store.snapshot(); as t) {
            <p class="text-sub mt-1 flex flex-wrap items-center gap-x-2">
              <span>{{ t.stats.totalClusters }} clusters</span>
              <span aria-hidden="true">·</span>
              <span>{{ t.stats.totalServers }} servers</span>
              <span aria-hidden="true">·</span>
              <span>{{ t.stats.totalApps }} apps</span>
              <span class="ml-2 inline-flex items-center gap-1.5">
                <span class="h-1.5 w-1.5 rounded-full" [class]="store.live() ? 'dot-healthy' : 'dot-pending'"></span>
                {{ store.live() ? 'Live' : 'Connecting' }}
              </span>
            </p>
          }
        </div>
        <div class="flex flex-wrap items-center gap-3">
          @if (store.snapshot()?.projects?.length) {
            <label class="flex items-center gap-2 text-xs">
              <span class="text-muted-foreground">Project</span>
              <select class="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                      [value]="store.state().project ?? ''"
                      (change)="store.update({ project: $any($event.target).value || null })">
                <option value="">All projects</option>
                @for (p of store.snapshot()!.projects; track p.id) {
                  <option [value]="p.id" [selected]="store.state().project === p.id">{{ p.name }}</option>
                }
              </select>
            </label>
          }
          <button type="button" class="h-8 rounded-md border px-3 text-xs font-medium"
                  [class.border-border]="!store.systemApps.shownOnMap()" [class.bg-card]="!store.systemApps.shownOnMap()"
                  [class.text-muted-foreground]="!store.systemApps.shownOnMap()"
                  [style.border-color]="store.systemApps.shownOnMap() ? 'hsl(var(--brand))' : null"
                  [style.color]="store.systemApps.shownOnMap() ? 'hsl(var(--brand))' : null"
                  [attr.aria-pressed]="store.systemApps.shownOnMap()"
                  title="The apps Flui itself runs. Shown to whoever sees every cluster."
                  (click)="store.systemApps.toggleOnMap()">System apps</button>
          <app-topology-choice label="View" [choices]="views" [value]="store.state().view"
                               (changed)="store.update({ view: $any($event) })" />
          <app-topology-choice label="Show as" [choices]="layouts" [value]="store.state().list ? 'list' : 'map'"
                               (changed)="store.update({ list: $event === 'list' })" />
          <button type="button" class="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  [disabled]="!store.snapshot() || exporting() || !exportable()"
                  [title]="exportable() ? 'Save the map you are looking at as an image' : 'Open the map to export it'"
                  (click)="exportImage()">
            {{ exporting() ? 'Exporting…' : 'Export image' }}
          </button>
        </div>
      </header>

      @if (store.error(); as error) {
        <p class="card-surface p-4 text-sm status-error" role="alert">{{ error }}</p>
      } @else if (store.loading()) {
        <div class="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div class="skeleton h-96"></div>
          <div class="skeleton h-96"></div>
        </div>
      } @else {
        <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <main class="min-h-0 space-y-4 overflow-y-auto">
            @if (drillView(); as d) {
              @if (d.kind === 'capacity') {
                <app-topology-capacity [snapshot]="d.snapshot" [clusterId]="d.id" [focus]="store.focus()"
                                       (selected)="select($event)" (back)="store.update({ drill: null })" />
              } @else {
                <app-topology-request-path [snapshot]="d.snapshot" [appId]="d.id" (back)="store.update({ drill: null })" />
              }
            } @else if (store.state().list) {
              <app-topology-list
                [snapshot]="store.snapshot()"
                [focus]="store.focus()"
                [project]="store.state().project"
                (selected)="select($event)" />
            } @else if (store.snapshot(); as t) {
              @if (store.state().view === 'services') {
                <app-topology-services
                  [snapshot]="t"
                  [state]="store.state()"
                  [focus]="store.focus()"
                  (selected)="select($event)"
                  (opened)="open($event)"
                  (levelChanged)="store.update($event)" />
              } @else {
              <app-topology-infrastructure
                [snapshot]="t"
                [focus]="store.focus()"
                [colorBy]="store.state().colorBy"
                [groupBy]="store.state().groupBy"
                [project]="store.state().project"
                (selected)="select($event)"
                (opened)="open($event)"
                (colorByChanged)="store.update({ colorBy: $event })"
                (groupByChanged)="store.update({ groupBy: $event })" />
              <app-topology-infra-panels
                [snapshot]="t"
                [focus]="store.focus()"
                [colorBy]="store.state().colorBy"
                [guest]="store.guest()"
                (selected)="select($event)" />
              }
            }
          </main>
          <app-topology-inspector
            class="min-h-0 lg:sticky lg:top-0"
            [snapshot]="store.snapshot()"
            [focus]="store.focus()"
            [destinations]="store.destinations()"
            [guest]="store.guest()"
            (selected)="select($event)"
            (cleared)="clear()"
            (drilled)="store.update($event)" />
        </div>
      }
    </div>
  `,
})
export class TopologyPageComponent implements OnInit, OnDestroy {
  protected readonly store = inject(TopologyStore);
  private readonly router = inject(Router);
  protected readonly views = [
    { value: 'services', label: 'Services' },
    { value: 'infrastructure', label: 'Infrastructure' },
  ];
  protected readonly layouts = [
    { value: 'map', label: 'Map' },
    { value: 'list', label: 'List' },
  ];
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly mask = inject(MaskModeService);
  protected readonly exporting = signal(false);

  protected readonly drillView = computed(() => {
    const s = this.store.state();
    const snapshot = this.store.snapshot();
    if (!s.drill || !snapshot) return null;
    if (s.drill === 'capacity' && s.cluster) return { kind: 'capacity' as const, id: s.cluster, snapshot };
    if (s.drill === 'path' && s.focus?.type === 'app') return { kind: 'path' as const, id: s.focus.id, snapshot };
    return null;
  });
  private readonly surfaceRevision = new TopologySurfaceRevision();

  private readonly surface = computed(() => {
    const input = {
      snapshot: this.store.snapshot(),
      state: this.store.state(),
      focus: this.store.focus(),
    };
    return buildTopologySurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => this.currentSurface.set(this.surface()));
  }

  ngOnInit(): void {
    void this.store.load();
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  protected select(focus: TopologyFocus): void {
    this.store.select(focus);
  }

  protected open(focus: TopologyFocus): void {
    const open = destinationsFor(focus, this.store.snapshot(), this.store.guest()).open;
    if (open) void this.router.navigate(open.commands, { queryParams: open.queryParams });
    else this.store.select(focus);
  }

  private readonly servicesView = viewChild(TopologyServicesComponent);
  private readonly infrastructureView = viewChild(TopologyInfrastructureComponent);

  /** Only a map can be exported: the list and the drill-downs have their own pages to print. */
  protected readonly exportable = computed(() => !this.store.state().list && !this.drillView());

  /** The map exactly as it stands: lens, level, selection, project, mask. */
  protected async exportImage(): Promise<void> {
    const t = this.store.snapshot();
    if (!t) return;
    const state = this.store.state();
    const project = t.projects.find((p) => p.id === state.project)?.name;
    const colour = state.colorBy === 'pods' ? 'replicas' : state.colorBy;
    const where =
      state.view === 'infrastructure'
        ? ['Infrastructure', colour]
        : [
            'Services',
            t.clusters.find((c) => c.id === state.cluster && state.level !== 'fleet')?.name,
            t.apps.find((a) => a.id === state.app && state.level === 'app')?.displayName,
          ];
    const header = {
      title: ['Topology', ...where, project].filter(Boolean).join(' · '),
      subtitle: `${t.stats.totalClusters} clusters · ${t.stats.totalServers} servers · ${t.stats.totalApps} apps · ${new Date().toLocaleString()}`,
      masked: this.mask.enabled(),
    };
    const palette = paletteFromDocument();
    const view =
      state.view === 'infrastructure'
        ? this.infrastructureView()?.exportView(palette, header)
        : this.servicesView()?.exportView(palette, header);
    if (!view) return;
    this.exporting.set(true);
    try {
      await downloadView(view, `flui-topology-${state.view}.png`);
    } finally {
      this.exporting.set(false);
    }
  }

  protected clear(): void {
    if (this.store.state().focus) this.store.select(null);
  }
}
