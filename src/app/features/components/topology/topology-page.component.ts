import {
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
import { TopologyFocus, TopologyView } from './topology-state';
import { TopologyInspectorComponent } from './topology-inspector.component';
import { TopologyListComponent } from './topology-list.component';
import { TopologyInfrastructureComponent } from './topology-infrastructure.component';
import { TopologyInfraPanelsComponent } from './topology-infra-panels.component';
import { TopologyServicesComponent } from './topology-services.component';
import { TopologyCapacityComponent } from './topology-capacity.component';
import { TopologyRequestPathComponent } from './topology-request-path.component';
import { destinationsFor } from './topology-navigation';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideDownload } from '@ng-icons/lucide';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlChip, FlSegmented } from '../../../ui/patterns/filter-bar';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import {
  TopologySurfaceRevision,
  buildTopologySurface,
  presentedContent,
} from './topology-surface';

@Component({
  selector: 'app-topology-page',
  imports: [
    FlPageHeader,
    FlSegmented,
    FlChip,
    FlButton,
    FlIcon,
    FlStatus,
    FlAlert,
    FlPanel,
    FlLoadingState,
    TopologyInspectorComponent,
    TopologyListComponent,
    TopologyInfrastructureComponent,
    TopologyInfraPanelsComponent,
    TopologyServicesComponent,
    TopologyCapacityComponent,
    TopologyRequestPathComponent,
  ],
  providers: [TopologyStore, provideIcons({ lucideDownload })],
  host: { '(document:keydown.escape)': 'clear()' },
  template: `
    <div class="fl-page h-full">
      <fl-page-header title="Topology">
        @if (store.snapshot(); as t) {
          <ng-container headerMeta>
            <span
              >{{ t.stats.totalClusters }}
              {{ t.stats.totalClusters === 1 ? 'cluster' : 'clusters' }}</span
            >
            <span
              >{{ t.stats.totalServers }}
              {{ t.stats.totalServers === 1 ? 'server' : 'servers' }}</span
            >
            <span>{{ t.stats.totalApps }} {{ t.stats.totalApps === 1 ? 'app' : 'apps' }}</span>
            <fl-status
              [tone]="store.live() ? 'success' : 'progress'"
              [label]="store.live() ? 'Live' : 'Connecting'"
            />
          </ng-container>
        }
        <ng-container headerActions>
          @if (store.snapshot()?.projects?.length) {
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Project"
                [value]="store.state().project ?? ''"
                (change)="pickProject($event)"
              >
                <option value="">All projects</option>
                @for (p of store.snapshot()!.projects; track p.id) {
                  <option [value]="p.id" [selected]="store.state().project === p.id">
                    {{ p.name }}
                  </option>
                }
              </select>
            </span>
          }
          <button
            flChip
            [pressed]="store.systemApps.shownOnMap()"
            title="The apps Flui itself runs. Shown to whoever sees every cluster."
            (click)="store.systemApps.toggleOnMap()"
          >
            System apps
          </button>
          <fl-segmented
            label="View"
            [options]="views"
            [value]="store.state().view"
            (valueChange)="pickView($event)"
          />
          <fl-segmented
            label="Show as"
            [options]="layouts"
            [value]="store.state().list ? 'list' : 'map'"
            (valueChange)="store.update({ list: $event === 'list' })"
          />
          <button
            flButton="ghost"
            type="button"
            [disabled]="!store.snapshot() || exporting() || !exportable()"
            [title]="
              exportable()
                ? 'Save the map you are looking at as an image'
                : 'Open the map to export it'
            "
            (click)="exportImage()"
          >
            <fl-icon name="lucideDownload" />
            {{ exporting() ? 'Exporting…' : 'Export image' }}
          </button>
        </ng-container>
      </fl-page-header>

      @if (store.error(); as error) {
        <fl-alert tone="error" title="Could not load the topology">{{ error }}</fl-alert>
      } @else if (store.loading()) {
        <fl-panel>
          <fl-loading-state [rows]="6" />
        </fl-panel>
      } @else {
        <div class="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row">
          <main class="fl-stack min-h-0 min-w-0 flex-1 overflow-y-auto">
            @if (drillView(); as d) {
              @if (d.kind === 'capacity') {
                <app-topology-capacity
                  [snapshot]="d.snapshot"
                  [clusterId]="d.id"
                  [focus]="store.focus()"
                  (selected)="select($event)"
                  (back)="store.update({ drill: null })"
                />
              } @else {
                <app-topology-request-path
                  [snapshot]="d.snapshot"
                  [appId]="d.id"
                  (back)="store.update({ drill: null })"
                />
              }
            } @else if (store.state().list) {
              <app-topology-list
                [snapshot]="store.snapshot()"
                [focus]="store.focus()"
                [project]="store.state().project"
                (selected)="select($event)"
              />
            } @else if (store.snapshot(); as t) {
              @if (store.state().view === 'services') {
                <app-topology-services
                  [snapshot]="t"
                  [state]="store.state()"
                  [focus]="store.focus()"
                  (selected)="select($event)"
                  (opened)="open($event)"
                  (levelChanged)="store.update($event)"
                />
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
                  (groupByChanged)="store.update({ groupBy: $event })"
                />
                <app-topology-infra-panels
                  [snapshot]="t"
                  [focus]="store.focus()"
                  [colorBy]="store.state().colorBy"
                  [guest]="store.guest()"
                  (selected)="select($event)"
                />
              }
            }
          </main>
          <app-topology-inspector
            class="min-h-0 min-w-0 lg:sticky lg:top-0 lg:w-96 lg:max-w-full lg:flex-none"
            [snapshot]="store.snapshot()"
            [focus]="store.focus()"
            [destinations]="store.destinations()"
            [guest]="store.guest()"
            (selected)="select($event)"
            (cleared)="clear()"
            (drilled)="store.update($event)"
          />
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
    if (s.drill === 'capacity' && s.cluster)
      return { kind: 'capacity' as const, id: s.cluster, snapshot };
    if (s.drill === 'path' && s.focus?.type === 'app')
      return { kind: 'path' as const, id: s.focus.id, snapshot };
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

  protected readonly exportable = computed(() => !this.store.state().list && !this.drillView());

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
      subtitle: `${t.stats.totalClusters} clusters · ${t.stats.totalServers} servers · ${t.stats.totalApps} apps · ${new Date().toLocaleString('en-GB')}`,
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

  protected pickView(view: string): void {
    this.store.update({ view: view as TopologyView });
  }

  protected pickProject(event: Event): void {
    this.store.update({ project: (event.target as HTMLSelectElement).value || null });
  }

  protected clear(): void {
    if (this.store.state().focus) this.store.select(null);
  }
}
