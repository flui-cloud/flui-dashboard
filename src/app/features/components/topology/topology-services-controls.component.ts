import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideMaximize2,
  lucideMinimize2,
  lucideMinus,
  lucidePlus,
  lucideScan,
} from '@ng-icons/lucide';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyBoxBy, TopologyFleetBy, TopologyHops, TopologyViewState } from './topology-state';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSegmented } from '../../../ui/patterns/filter-bar';
import { TopologyGraph } from './topology-graph';

/** What sits on the service map's edges: where you are, zoom, and the choices of the level shown. */
@Component({
  selector: 'app-topology-services-controls',
  imports: [FlButton, FlIcon, FlSegmented],
  providers: [
    provideIcons({ lucidePlus, lucideMinus, lucideScan, lucideMaximize2, lucideMinimize2 }),
  ],
  host: { class: 'contents' },
  template: `
    <nav
      class="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-1 text-fl-body-sm"
      aria-label="Level"
    >
      @for (crumb of crumbs(); track crumb.label; let last = $last) {
        <button
          type="button"
          class="rounded-fl-sm bg-fl-surface px-1.5 py-0.5 hover:bg-fl-surface-hover focus-visible:shadow-fl-focus focus-visible:outline-none"
          [class.font-semibold]="last"
          [class.text-fl-ink]="last"
          [class.text-fl-accent]="!last"
          [attr.aria-current]="last ? 'location' : null"
          (click)="changed.emit(crumb.state)"
        >
          {{ crumb.label }}
        </button>
        @if (!last) {
          <span class="text-fl-ink-muted" aria-hidden="true">/</span>
        }
      }
    </nav>
    <div class="absolute right-3 top-3 z-10 flex gap-1">
      <button
        flButton
        size="sm"
        type="button"
        [iconOnly]="true"
        aria-label="Zoom in"
        (click)="zoomed.emit(1.2)"
      >
        <fl-icon name="lucidePlus" />
      </button>
      <button
        flButton
        size="sm"
        type="button"
        [iconOnly]="true"
        aria-label="Zoom out"
        (click)="zoomed.emit(1 / 1.2)"
      >
        <fl-icon name="lucideMinus" />
      </button>
      <button
        flButton
        size="sm"
        type="button"
        [iconOnly]="true"
        aria-label="Fit to view"
        title="Fit to view"
        (click)="fitted.emit()"
      >
        <fl-icon name="lucideScan" />
      </button>
      <button
        flButton
        size="sm"
        type="button"
        [iconOnly]="true"
        [attr.aria-label]="expanded() ? 'Exit full window' : 'Full window'"
        [title]="expanded() ? 'Exit full window (Esc)' : 'Full window'"
        [attr.aria-pressed]="expanded()"
        (click)="expandToggled.emit()"
      >
        <fl-icon [name]="expanded() ? 'lucideMinimize2' : 'lucideMaximize2'" />
      </button>
    </div>
    @if (state().level === 'fleet' && snapshot().apps.length) {
      <div
        class="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2 text-fl-body-sm text-fl-ink-muted"
      >
        <span>Show</span>
        <fl-segmented
          label="Fleet drawn by"
          [options]="fleetChoices"
          [value]="fleetBy()"
          (valueChange)="pickFleet($event)"
        />
        @if (fleetBy() === 'apps' && boxChoices().length > 1) {
          <span class="ml-2">Group by</span>
          <fl-segmented
            label="Group by"
            [options]="boxChoices()"
            [value]="state().boxBy"
            (valueChange)="pickBox($event)"
          />
        }
      </div>
    }
    @if (graph().level === 'app') {
      <div
        class="absolute bottom-3 left-3 z-10 flex items-center gap-2 text-fl-body-sm text-fl-ink-muted"
      >
        <span>Neighbours</span>
        <fl-segmented
          label="Neighbours"
          [options]="hopChoices"
          [value]="'' + state().hops"
          (valueChange)="pickHops($event)"
        />
      </div>
    }
    @if (graph().filtered) {
      <p
        class="absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-fl-md border border-fl-border bg-fl-surface py-1 pl-3 pr-1 text-fl-body-sm text-fl-ink"
      >
        Showing problems and their neighbours
        <button
          flButton="ghost"
          size="sm"
          type="button"
          data-testid="topology-show-all"
          (click)="changed.emit(graph().level === 'fleet' ? { problems: false } : { all: true })"
        >
          Show all
        </button>
      </p>
    } @else if (graph().filterable) {
      <p class="absolute bottom-3 right-3 z-10">
        <button
          flButton
          size="sm"
          type="button"
          data-testid="topology-show-problems"
          (click)="changed.emit({ problems: true })"
        >
          Show problems only
        </button>
      </p>
    }
    @if (graph().collapsedFrom) {
      <p
        class="absolute bottom-3 left-3 z-10 rounded-fl-md border border-fl-border bg-fl-surface px-3 py-1 text-fl-body-sm text-fl-ink-muted"
      >
        Too many to draw here: showing the level above
      </p>
    }
  `,
})
export class TopologyServicesControlsComponent {
  readonly snapshot = input.required<TopologyResponseDto>();
  readonly state = input.required<TopologyViewState>();
  readonly graph = input.required<TopologyGraph>();
  readonly fleetBy = input.required<'apps' | 'clusters'>();
  readonly changed = output<Partial<TopologyViewState>>();
  readonly zoomed = output<number>();
  readonly fitted = output<void>();
  readonly expanded = input(false);
  readonly expandToggled = output<void>();

  protected readonly hopChoices = [
    { value: '1', label: 'Direct' },
    { value: '2', label: 'Two steps' },
  ];
  protected readonly boxChoices = computed(() => [
    { value: 'cluster' as const, label: 'Clusters' },
    ...(this.snapshot().projects.length ? [{ value: 'project' as const, label: 'Projects' }] : []),
    ...(this.snapshot().servers.length ? [{ value: 'server' as const, label: 'Servers' }] : []),
  ]);
  protected readonly fleetChoices = [
    { value: 'clusters' as const, label: 'Clusters' },
    { value: 'apps' as const, label: 'Apps' },
  ];

  protected pickFleet(value: string): void {
    this.changed.emit({ fleetBy: value as TopologyFleetBy, all: false });
  }

  protected pickBox(value: string): void {
    this.changed.emit({ boxBy: value as TopologyBoxBy });
  }

  protected pickHops(value: string): void {
    this.changed.emit({ hops: Number(value) as TopologyHops });
  }

  protected readonly crumbs = computed(() => {
    const s = this.state();
    const t = this.snapshot();
    const crumbs: { label: string; state: Partial<TopologyViewState> }[] = [
      { label: 'Fleet', state: { level: 'fleet', cluster: null, app: null, focus: null } },
    ];
    if (s.level !== 'fleet' && s.cluster) {
      crumbs.push({
        label: t.clusters.find((c) => c.id === s.cluster)?.name ?? 'Cluster',
        state: { level: 'cluster', app: null, focus: null },
      });
    }
    if (s.level === 'stack' && s.focus?.type === 'stack') {
      crumbs.push({
        label: t.stacks.find((x) => x.id === s.focus!.id)?.name ?? 'Stack',
        state: {},
      });
    }
    const centre = s.level === 'app' ? t.apps.find((a) => a.id === s.app) : null;
    if (centre) {
      const stack = t.stacks.find((x) => x.id === centre.stackId);
      if (stack && stack.appIds.length > 1 && stack.name !== centre.displayName) {
        crumbs.push({
          label: stack.name,
          state: {
            level: 'stack',
            cluster: centre.clusterId,
            app: null,
            focus: { type: 'stack', id: stack.id },
          },
        });
      }
      crumbs.push({ label: centre.displayName, state: {} });
    }
    return crumbs;
  });
}
