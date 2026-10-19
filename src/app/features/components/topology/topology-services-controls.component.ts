import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMaximize2, lucideMinimize2, lucideMinus, lucidePlus, lucideScan } from '@ng-icons/lucide';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyViewState } from './topology-state';
import { TopologyGraph } from './topology-graph';

/** What sits on the service map's edges: where you are, zoom, and the choices of the level shown. */
@Component({
  selector: 'app-topology-services-controls',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucidePlus, lucideMinus, lucideScan, lucideMaximize2, lucideMinimize2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <nav class="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-1 text-sm" aria-label="Level">
      @for (crumb of crumbs(); track crumb.label; let last = $last) {
        <button type="button" class="rounded px-1.5 py-0.5 hover:bg-muted"
                [class.font-semibold]="last" [class.text-foreground]="last" [class.text-muted-foreground]="!last"
                (click)="changed.emit(crumb.state)">{{ crumb.label }}</button>
        @if (!last) { <span class="text-muted-foreground" aria-hidden="true">/</span> }
      }
    </nav>
    <div class="absolute right-3 top-3 z-10 flex gap-1">
      <button type="button" class="rounded-md border border-border bg-card p-1.5 hover:bg-muted" aria-label="Zoom in" (click)="zoomed.emit(1.2)"><ng-icon name="lucidePlus" class="h-4 w-4" /></button>
      <button type="button" class="rounded-md border border-border bg-card p-1.5 hover:bg-muted" aria-label="Zoom out" (click)="zoomed.emit(1 / 1.2)"><ng-icon name="lucideMinus" class="h-4 w-4" /></button>
      <button type="button" class="rounded-md border border-border bg-card p-1.5 hover:bg-muted" aria-label="Fit to view" title="Fit to view" (click)="fitted.emit()"><ng-icon name="lucideScan" class="h-4 w-4" /></button>
      <button type="button" class="rounded-md border border-border bg-card p-1.5 hover:bg-muted"
              [attr.aria-label]="expanded() ? 'Exit full window' : 'Full window'" [title]="expanded() ? 'Exit full window (Esc)' : 'Full window'"
              [attr.aria-pressed]="expanded()" (click)="expandToggled.emit()">
        <ng-icon [name]="expanded() ? 'lucideMinimize2' : 'lucideMaximize2'" class="h-4 w-4" />
      </button>
    </div>
    @if (state().level === 'fleet' && snapshot().apps.length) {
      <div class="absolute bottom-3 left-3 z-10 flex items-center gap-2 text-xs text-muted-foreground" role="group" aria-label="Fleet drawn by">
        <span>Show</span>
        <span class="flex rounded-md border border-border bg-card p-0.5">
          @for (choice of fleetChoices; track choice.value) {
            <button type="button" class="rounded px-2 py-0.5 font-medium"
                    [class.bg-muted]="fleetBy() === choice.value" [class.text-foreground]="fleetBy() === choice.value"
                    [attr.aria-pressed]="fleetBy() === choice.value"
                    (click)="changed.emit({ fleetBy: choice.value, all: false })">{{ choice.label }}</button>
          }
        </span>
        @if (fleetBy() === 'apps' && snapshot().projects.length) {
          <span class="ml-2">Group by</span>
          <span class="flex rounded-md border border-border bg-card p-0.5">
            @for (choice of boxChoices; track choice.value) {
              <button type="button" class="rounded px-2 py-0.5 font-medium"
                      [class.bg-muted]="state().boxBy === choice.value" [class.text-foreground]="state().boxBy === choice.value"
                      [attr.aria-pressed]="state().boxBy === choice.value"
                      (click)="changed.emit({ boxBy: choice.value })">{{ choice.label }}</button>
            }
          </span>
        }
      </div>
    }
    @if (graph().level === 'app') {
      <div class="absolute bottom-3 left-3 z-10 flex items-center gap-2 text-xs text-muted-foreground" role="group" aria-label="Neighbours">
        <span>Neighbours</span>
        <span class="flex rounded-md border border-border bg-card p-0.5">
          @for (n of hopChoices; track n) {
            <button type="button" class="rounded px-2 py-0.5 font-medium"
                    [class.bg-muted]="state().hops === n" [class.text-foreground]="state().hops === n"
                    [attr.aria-pressed]="state().hops === n"
                    (click)="changed.emit({ hops: n })">{{ n === 1 ? 'Direct' : 'Two steps' }}</button>
          }
        </span>
      </div>
    }
    @if (graph().filtered) {
      <p class="absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-xs text-foreground">
        Showing problems and their neighbours
        <button type="button" class="rounded-full px-2 py-0.5 font-medium text-primary hover:bg-muted" data-testid="topology-show-all"
                (click)="changed.emit(graph().level === 'fleet' ? { problems: false } : { all: true })">Show all</button>
      </p>
    } @else if (graph().filterable) {
      <p class="absolute bottom-3 right-3 z-10 flex items-center rounded-full border border-border bg-card p-1 text-xs text-foreground">
        <button type="button" class="rounded-full px-2 py-0.5 font-medium text-primary hover:bg-muted" data-testid="topology-show-problems"
                (click)="changed.emit({ problems: true })">Show problems only</button>
      </p>
    }
    @if (graph().collapsedFrom) {
      <p class="badge badge-pending absolute bottom-3 left-3 z-10">Too many to draw here: showing the level above</p>
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

  protected readonly hopChoices = [1, 2] as const;
  protected readonly boxChoices = [
    { value: 'cluster' as const, label: 'Clusters' },
    { value: 'project' as const, label: 'Projects' },
  ];
  protected readonly fleetChoices = [
    { value: 'clusters' as const, label: 'Clusters' },
    { value: 'apps' as const, label: 'Apps' },
  ];

  protected readonly crumbs = computed(() => {
    const s = this.state();
    const t = this.snapshot();
    const crumbs: { label: string; state: Partial<TopologyViewState> }[] = [
      { label: 'Fleet', state: { level: 'fleet', cluster: null, app: null, focus: null } },
    ];
    if (s.level !== 'fleet' && s.cluster) {
      crumbs.push({ label: t.clusters.find((c) => c.id === s.cluster)?.name ?? 'Cluster', state: { level: 'cluster', app: null, focus: null } });
    }
    if (s.level === 'stack' && s.focus?.type === 'stack') {
      crumbs.push({ label: t.stacks.find((x) => x.id === s.focus!.id)?.name ?? 'Stack', state: {} });
    }
    const centre = s.level === 'app' ? t.apps.find((a) => a.id === s.app) : null;
    if (centre) {
      const stack = t.stacks.find((x) => x.id === centre.stackId);
      if (stack && stack.appIds.length > 1 && stack.name !== centre.displayName) {
        crumbs.push({
          label: stack.name,
          state: { level: 'stack', cluster: centre.clusterId, app: null, focus: { type: 'stack', id: stack.id } },
        });
      }
      crumbs.push({ label: centre.displayName, state: {} });
    }
    return crumbs;
  });
}
