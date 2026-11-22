import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { HistoryWindow, HistoryZoom, ScalingApiService } from '../../service/scaling-api.service';
import { ScalingDecision } from '../../model/scaling-group.models';
import { FleetHistoryPoint, SectionGroup } from '../../model/scaling-section.models';
import { FleetLoadChartComponent } from '../scaling/fleet-load-chart.component';
import { FleetHistoryComponent } from '../scaling/fleet-history.component';
import { outcomeText } from '../scaling/fleet-history.geometry';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { ScalingGroupStore } from './scaling-group.store';
import { ago } from './now-format';
import { HistoryDecisionLog, LogFilter, LogRow } from './history-decision-log';
import { outcomeTone } from './scaling-tabs-format';
import { SectionFailureComponent, SectionSkeletonComponent } from './section-states.component';

const PAGE = 50;

@Component({
  selector: 'app-scaling-history-tab',
  imports: [
    FleetHistoryComponent,
    FleetLoadChartComponent,
    FlPanel,
    FlEmptyState,
    FlButton,
    HistoryDecisionLog,
    SectionFailureComponent,
    SectionSkeletonComponent,
  ],
  host: { class: 'fl-stack' },
  template: `
    @if (group(); as g) {
      <div class="fl-stack" data-testid="tab-history">
        <fl-panel title="Fleet over time">
          @if (!historyLoading() && !historyFailed()) {
            <div
              panelActions
              class="fl-segmented"
              role="group"
              aria-label="Span"
              data-testid="history-window"
            >
              @for (w of windows; track w) {
                <button
                  type="button"
                  [attr.aria-pressed]="store.historyWindow() === w"
                  (click)="store.historyWindow.set(w); store.historyZoom.set(null)"
                  [attr.data-testid]="'history-window-' + w"
                >
                  {{ windowLabel[w] }}
                </button>
              }
            </div>
          }

          <div class="flex flex-col gap-4">
            <p class="m-0 max-w-prose text-fl-body-sm text-fl-ink-muted" data-testid="history-lead">
              {{ lead() }}
            </p>

            @if (historyLoading()) {
              <app-section-skeleton
                variant="table"
                [count]="4"
                label="the fleet over time"
                testid="history"
              />
            } @else if (historyFailed()) {
              <app-section-failure
                [message]="historyFailed() ?? ''"
                testid="history"
                (retry)="store.reload()"
              />
            } @else {
              @if (store.historyZoom(); as z) {
                <p
                  class="m-0 flex flex-wrap items-center gap-2 text-fl-caption text-fl-ink-muted"
                  data-testid="history-zoom"
                >
                  <span>Zoomed to {{ zoomLabel(z) }}</span>
                  <button
                    flButton="ghost"
                    size="sm"
                    type="button"
                    (click)="store.historyZoom.set(null)"
                    data-testid="history-zoom-reset"
                  >
                    Reset
                  </button>
                </p>
              } @else {
                <p class="m-0 text-fl-caption text-fl-ink-muted">
                  Drag across the chart to zoom into a stretch.
                </p>
              }
              <app-fleet-history
                [points]="points()"
                [decisions]="chartDecisions()"
                [monthlyCap]="cap()"
                (zoomed)="store.historyZoom.set($event)"
              />
              <app-fleet-load-chart [points]="points()" />

              @if (unpricedNote(); as note) {
                <p
                  class="m-0 max-w-prose text-fl-body-sm text-fl-ink-muted"
                  data-testid="unbilled-note"
                >
                  {{ note }}
                </p>
              }

              @if (orphanNote(); as note) {
                <p
                  class="m-0 max-w-prose text-fl-body-sm text-fl-ink-muted"
                  data-testid="orphan-note"
                >
                  {{ note }}
                </p>
              }
            }
          </div>
        </fl-panel>

        <app-history-decision-log
          [rows]="log()"
          [filters]="filters"
          [filter]="filter()"
          [loading]="decisionsLoading()"
          [failed]="decisionsFailed()"
          [more]="more()"
          [paging]="paging()"
          (filterChange)="setFilter($event)"
          (retry)="store.reload()"
          (older)="loadOlder()"
        />
      </div>
    } @else {
      <fl-panel data-testid="tab-history-no-group">
        <fl-empty-state title="No such group" />
      </fl-panel>
    }
  `,
})
export class ScalingHistoryTabComponent {
  protected readonly store = inject(ScalingGroupStore);
  private readonly api = inject(ScalingApiService);

  protected readonly windows: HistoryWindow[] = ['1h', '24h', '7d', '30d'];
  protected readonly windowLabel: Record<HistoryWindow, string> = {
    '1h': 'Last hour',
    '24h': '24 hours',
    '7d': '7 days',
    '30d': '30 days',
  };

  protected readonly filters: readonly (LogFilter & { outcome?: string })[] = [
    { key: 'all', label: 'All', outcome: undefined },
    { key: 'nodes', label: 'Nodes', outcome: 'nodes' },
    { key: 'alarms', label: 'Alarms', outcome: 'alerted' },
    { key: 'declines', label: 'Declines', outcome: 'declined' },
    { key: 'changes', label: 'Changes', outcome: 'changed' },
  ];
  protected readonly filter = signal<string>('all');
  /** Rows read past the store's first page, or for a filter the store does not apply. */
  private readonly extra = signal<ScalingDecision[] | null>(null);
  protected readonly paging = signal(false);
  private readonly exhausted = signal(false);

  protected readonly group = computed<SectionGroup | null>(() => this.store.group().data);

  protected readonly historyLoading = computed(() => this.store.history().loading);
  protected readonly historyFailed = computed(() => this.store.history().failed);
  protected readonly decisionsLoading = computed(() => this.store.decisions().loading);
  protected readonly decisionsFailed = computed(() => this.store.decisions().failed);

  private readonly history = computed(() => this.store.history().data);

  protected readonly points = computed<FleetHistoryPoint[]>(() => this.history()?.points ?? []);

  protected readonly decisions = computed<ScalingDecision[]>(
    () => this.store.decisions().data ?? [],
  );

  /** Decisions of the zoomed stretch itself, not the latest page, so the markers read for it. */
  private readonly zoomDecisions = rxResource({
    params: () => {
      const g = this.group();
      const z = this.store.historyZoom();
      return g && z
        ? { id: g.id, since: z.from.toISOString(), until: z.to.toISOString() }
        : undefined;
    },
    stream: ({ params }) =>
      this.api.decisions(params.id, 200, { since: params.since, until: params.until }),
  });

  protected readonly chartDecisions = computed<ScalingDecision[]>(() =>
    this.store.historyZoom() ? (this.zoomDecisions.value() ?? []) : this.decisions(),
  );

  protected zoomLabel(z: HistoryZoom): string {
    const day = (d: Date) => d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    const time = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return day(z.from) === day(z.to)
      ? `${day(z.from)}, ${time(z.from)} – ${time(z.to)}`
      : `${day(z.from)} ${time(z.from)} – ${day(z.to)} ${time(z.to)}`;
  }

  private readonly groupId = computed(() => this.group()?.id ?? null);

  private readonly shown = computed<ScalingDecision[]>(() =>
    this.filter() === 'all' && this.extra() === null ? this.decisions() : (this.extra() ?? []),
  );

  protected readonly more = computed(() => !this.exhausted() && this.shown().length >= PAGE);

  constructor() {
    effect(() => {
      this.groupId();
      untracked(() => {
        this.extra.set(null);
        this.exhausted.set(false);
        this.filter.set('all');
      });
    });
  }

  protected async setFilter(key: string): Promise<void> {
    this.filter.set(key);
    this.exhausted.set(false);
    if (key === 'all') {
      this.extra.set(null);
      return;
    }
    this.extra.set(await this.page());
  }

  protected async loadOlder(): Promise<void> {
    const rows = this.shown();
    const last = rows.reduce<string | undefined>(
      (min, d) => (!min || Date.parse(d.at) < Date.parse(min) ? d.at : min),
      undefined,
    );
    this.paging.set(true);
    try {
      const older = await this.page(last);
      if (older.length < PAGE) this.exhausted.set(true);
      this.extra.set([...rows, ...older]);
    } finally {
      this.paging.set(false);
    }
  }

  private async page(before?: string): Promise<ScalingDecision[]> {
    const g = this.group();
    if (!g) return [];
    const outcome = this.filters.find((f) => f.key === this.filter())?.outcome;
    return firstValueFrom(this.api.decisions(g.id, PAGE, { outcome, before }));
  }

  protected readonly cap = computed<number | null>(
    () => this.group()?.limits.maxMonthlyCost ?? null,
  );

  protected readonly unpricedNote = computed<string | null>(() => {
    const points = this.points();
    if (!points.length) return null;

    const unpriced = Math.max(...points.map((p) => p.unpricedNodes));
    if (unpriced === 0) return null;

    const all = points.every((p) => p.unpricedNodes >= p.nodes);
    if (this.group()?.capability.billing === 'none') {
      return 'The spend view is flat at zero and stays there. Flui never saw a bill for these machines, and a run rate it invented would be worse than no line at all.';
    }
    if (all) {
      return 'The spend view is flat at zero because no node in this window carries a price: unpriced, not free. Nothing here says the fleet cost nothing.';
    }
    return `The spend line covers only the priced nodes: up to ${unpriced} of them carry no price in this window, so what it draws is a floor rather than the bill.`;
  });

  protected readonly orphanNote = computed<string | null>(() => {
    const history = this.history();
    if (!history?.orphanedIntervals) return null;

    const open = history.orphanedOpenIntervals
      ? ` ${history.orphanedOpenIntervals} of them are still open, which is the one case where counting can overstate today.`
      : '';
    return `${history.orphanedIntervals} billing intervals in this window belong to nodes whose row no longer exists. They are counted, because the interval is what billing charged for.${open}`;
  });

  protected readonly lead = computed(() => {
    const g = this.group();
    if (!g) return '';

    if (g.capability.canProvision) {
      return 'Every addition, replacement, removal, decline and alarm on one axis, against the fleet it changed. One band per machine type, because "3 nodes" does not tell you whether the next app will fit.';
    }

    const what = g.capability.hasCatalogue
      ? 'an alarm Flui raised, naming a machine, or one somebody created in the provider panel and joined'
      : 'an alarm Flui raised, naming a requirement, or a machine somebody attached';

    return `Nothing here added anything. Every entry is ${what}. That makes this the only record of who changed the fleet and why, and the most useful of the four tabs on a cluster like this one.`;
  });

  protected readonly log = computed<LogRow[]>(() => {
    const now = Date.now();
    return [...this.shown()]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .map((decision) => ({
        decision,
        when: `${new Date(decision.at).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })} · ${ago(decision.at, now)} ago${
          decision.repeats && decision.repeats > 1 && decision.since
            ? ` · ×${decision.repeats} since ${new Date(decision.since).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
            : ''
        }`,
        outcome: `${decision.force} · ${outcomeText(decision.outcome)}`,
        tone: outcomeTone(decision.outcome),
      }));
  });
}
