import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ScalingDecision } from '../../model/scaling-group.models';
import {
  FleetHistoryPoint,
  SectionGroup,
} from '../../model/scaling-section.models';
import { FleetHistoryComponent } from '../scaling/fleet-history.component';
import { ScalingGroupStore } from './scaling-group.store';
import { TABLE, ago } from './now-format';
import {
  SectionFailureComponent,
  SectionSkeletonComponent,
} from './section-states.component';

interface LogRow {
  decision: ScalingDecision;
  when: string;
  outcomePill: string;
}

@Component({
  selector: 'app-scaling-history-tab',
  standalone: true,
  imports: [
    FleetHistoryComponent,
    SectionFailureComponent,
    SectionSkeletonComponent,
  ],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (group(); as g) {
      <div class="space-y-6" data-testid="tab-history">
        <p class="m-0 max-w-prose text-[13px] text-muted-foreground" data-testid="history-lead">
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
          <app-fleet-history
            [points]="points()"
            [decisions]="decisions()"
            [monthlyCap]="cap()"
          />

          @if (unpricedNote(); as note) {
            <p class="m-0 max-w-prose text-[13px] text-muted-foreground" data-testid="unbilled-note">
              {{ note }}
            </p>
          }

          @if (orphanNote(); as note) {
            <p class="m-0 max-w-prose text-[13px] text-muted-foreground" data-testid="orphan-note">
              {{ note }}
            </p>
          }
        }

        <section class="space-y-2" data-testid="decision-log">
          <h2 class="text-label m-0">Decision log</h2>

          @if (decisionsLoading()) {
            <app-section-skeleton
              variant="table"
              [count]="3"
              label="the decision log"
              testid="decisions"
            />
          } @else if (decisionsFailed()) {
            <app-section-failure
              [message]="decisionsFailed() ?? ''"
              testid="decisions"
              (retry)="store.reload()"
            />
          } @else {
            <div [class]="t.card">
              <div [class]="t.scroll">
                <table [class]="t.table">
                  <caption [class]="t.captionTop">
                    Newest first, and every row carries its age. The latest row is
                    where the group stands: an alarm is replaced by whatever it
                    decides next, including the pass after somebody attached a
                    machine by hand.
                  </caption>
                  <thead>
                    <tr [class]="t.headRow">
                      <th scope="col" [class]="t.th">When</th>
                      <th scope="col" [class]="t.th">Force · outcome</th>
                      <th scope="col" [class]="t.th">Saw</th>
                      <th scope="col" [class]="t.th">Did · why</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of log(); track row.decision.id) {
                      <tr
                        [class]="t.row"
                        [attr.data-testid]="'decision-row-' + row.decision.id"
                        [attr.data-outcome]="row.decision.outcome"
                      >
                        <th scope="row" [class]="t.td + ' whitespace-nowrap font-normal'">
                          <span class="tabular-nums">{{ row.when }}</span>
                        </th>
                        <td [class]="t.td">
                          <span [class]="t.pill + ' w-fit ' + row.outcomePill">
                            {{ row.decision.force }} · {{ row.decision.outcome }}
                          </span>
                        </td>
                        <td [class]="t.tdMuted">{{ row.decision.saw }}</td>
                        <td [class]="t.td">
                          <span class="flex flex-col gap-0.5">
                            <span>{{ row.decision.did }}</span>
                            <span [class]="t.note">{{ row.decision.why }}</span>
                          </span>
                        </td>
                      </tr>
                    } @empty {
                      <tr [class]="t.row">
                        <td [class]="t.tdMuted" colspan="4" data-testid="log-empty">
                          Nothing decided yet. A group that has never had to act has
                          no record, which is not the same as a group that failed to
                          look.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </section>
      </div>
    } @else {
      <p class="m-0 text-sm text-muted-foreground" data-testid="tab-history-no-group">
        No such group.
      </p>
    }
  `,
})
export class ScalingHistoryTabComponent {
  protected readonly store = inject(ScalingGroupStore);

  protected readonly t = TABLE;

  protected readonly group = computed<SectionGroup | null>(
    () => this.store.group().data,
  );

  protected readonly historyLoading = computed(() => this.store.history().loading);
  protected readonly historyFailed = computed(() => this.store.history().failed);
  protected readonly decisionsLoading = computed(() => this.store.decisions().loading);
  protected readonly decisionsFailed = computed(() => this.store.decisions().failed);

  private readonly history = computed(() => this.store.history().data);

  protected readonly points = computed<FleetHistoryPoint[]>(
    () => this.history()?.points ?? [],
  );

  protected readonly decisions = computed<ScalingDecision[]>(
    () => this.store.decisions().data ?? [],
  );

  protected readonly cap = computed<number | null>(
    () => this.group()?.limits.maxMonthlyCost ?? null
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
      return 'The spend view is flat at zero because no node in this window carries a price — unpriced, not free. Nothing here says the fleet cost nothing.';
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
      return 'Every purchase, replacement, removal, decline and alarm on one axis, against the fleet it changed. The bands are one per shape, because a total says "3 nodes" and which three is what tells you whether the next pod fits.';
    }

    const what = g.capability.hasCatalogue
      ? 'an alarm Flui raised, naming a shape, or a machine somebody bought from the provider panel and joined'
      : 'an alarm Flui raised, naming a requirement, or a machine somebody attached';

    return `Nothing here bought anything. Every entry is ${what} — which makes this the only record of who changed the fleet and why, and the most useful of the four tabs on a cluster like this one.`;
  });

  protected readonly log = computed<LogRow[]>(() => {
    const now = Date.now();
    return [...this.decisions()]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .map((decision) => ({
        decision,
        when: `${new Date(decision.at).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })} · ${ago(decision.at, now)} ago`,
        outcomePill: this.outcomePill(decision.outcome),
      }));
  });

  private outcomePill(outcome: ScalingDecision['outcome']): string {
    switch (outcome) {
      case 'added':
      case 'replaced':
        return 'badge-success';
      case 'removed':
        return 'bg-muted text-muted-foreground';
      case 'alerted':
        return 'badge-error';
      case 'declined':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
    }
  }
}
