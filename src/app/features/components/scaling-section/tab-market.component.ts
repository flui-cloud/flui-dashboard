import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideClock } from '@ng-icons/lucide';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { AvailabilityOutlook } from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';
import { GroupDraftStore } from './group-draft.store';
import { ScalingGroupStore } from './scaling-group.store';
import {
  SectionFailureComponent,
  SectionSkeletonComponent,
} from './section-states.component';
import {
  CatalogueState,
  STALE_AFTER_SECONDS,
  STATE_LABEL,
  STATE_PILL,
  TABLE,
  heldFor,
  readingAge,
  refusesWholeCatalogue,
} from './scaling-tabs-format';

type Allowance = 'preferred' | 'not-listed' | 'refused-by-limit';

interface MarketRow {
  shape: string;
  state: CatalogueState;
  stateLabel: string;
  up: string[];
  down: string[];
  age: string;
  stale: boolean;
  allowance: Allowance;
  rank: number | null;
  awaited: boolean;
}

@Component({
  selector: 'app-scaling-market-tab',
  standalone: true,
  imports: [
    NgIcon,
    RouterLink,
    ExplainComponent,
    SectionFailureComponent,
    SectionSkeletonComponent,
  ],
  providers: [provideIcons({ lucideClock })],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (group(); as g) {
      <section class="space-y-3" data-testid="market-tab">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 class="text-label m-0">Catalogue</h2>
          <p class="m-0 text-[12px] text-muted-foreground" data-testid="market-provider">
            Read from
            <span class="font-mono text-foreground">{{ g.capability.provider }}</span
            >, which owns it — not from {{ g.clusterName }}. Another provider's
            catalogue can disagree with this one.
          </p>
        </div>

        @if (!g.capability.hasCatalogue) {
          <div class="card-surface p-6" data-testid="market-none">
            <p class="m-0 max-w-prose text-sm text-foreground">
              There is no market to read.
            </p>
            <p class="mt-1.5 max-w-prose text-sm text-muted-foreground">
              {{ g.clusterName }} runs your own machines. {{ g.capability.provider }}
              publishes no shapes and no prices, and it never will, so there is
              nothing here to be up or down. What a node has to hold is on the
              group tab instead.
            </p>
            <a
              [routerLink]="['/scaling', g.id, 'group']"
              class="card-link"
              data-testid="market-none-to-group"
            >
              What a machine has to hold
            </a>
          </div>
        } @else if (loading()) {
          <app-section-skeleton
            variant="table"
            [count]="4"
            label="the catalogue"
            testid="market"
          />
        } @else if (failed()) {
          <app-section-failure [message]="failed() ?? ''" testid="market" (retry)="store.reload()" />
        } @else {
          <p class="m-0 max-w-prose text-[13px] leading-relaxed text-muted-foreground"
             data-testid="informs-not-decides">
            The catalogue informs; it never decides. {{ g.capability.provider }}
            accepts or refuses at the moment of purchase, with your credentials —
            a shape listed as up here can still be refused.
          </p>

          @if (unread(); as catalogue) {
            <p
              class="m-0 max-w-prose border-l-2 border-l-border py-1 pl-3 text-[13px] leading-relaxed text-muted-foreground"
              [attr.data-reading]="catalogue.reading"
              data-testid="market-reading"
            >
              {{ catalogue.says }}
            </p>
          }

          @if (refusesEverything()) {
            <p
              class="m-0 max-w-prose border-l-2 border-l-destructive py-1 pl-3 text-[13px] leading-relaxed text-destructive"
              data-testid="market-refused-banner"
            >
              Every shape below is excluded before availability is even consulted:
              this group accepts hourly billing only and
              {{ g.capability.provider }} bills by the month.
              <a [routerLink]="['/scaling', g.id, 'group']" class="underline">
                Turn that limit off on the group tab.
              </a>
            </p>
          }

          <div [class]="t.card">
            <div [class]="t.scroll">
              <table [class]="t.table">
                <caption [class]="t.caption">
                  Every row carries the age of its own reading. Nothing here is
                  live.
                </caption>
                <thead>
                  <tr [class]="t.headRow">
                    <th scope="col" [class]="t.th">Shape</th>
                    <th scope="col" [class]="t.th">State</th>
                    <th scope="col" [class]="t.th">Up in</th>
                    <th scope="col" [class]="t.th">Down in</th>
                    <th scope="col" [class]="t.thNum">
                      <app-explain
                        label="Read"
                        labelClass="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                        testid="read-why"
                      >
                        How old this reading is. It is never omitted and never
                        rounded to "now": a shape read ten minutes ago may have
                        sold out since, and the purchase is what finds out.
                      </app-explain>
                    </th>
                    <th scope="col" [class]="t.th">In this group</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows(); track row.shape) {
                    <tr
                      [class]="t.row"
                      [attr.data-testid]="'shape-' + row.shape"
                      [attr.data-state]="row.state"
                    >
                      <th scope="row" [class]="t.td + ' font-normal'">
                        <span [class]="t.mono">{{ row.shape }}</span>
                      </th>
                      <td [class]="t.td">
                        <span
                          [class]="t.pill + ' w-fit ' + pill(row.state)"
                          [attr.data-testid]="'state-' + row.shape"
                        >
                          {{ row.stateLabel }}
                        </span>
                      </td>
                      <td [class]="t.td">
                        @if (row.up.length) {
                          <span class="flex flex-wrap gap-1">
                            @for (region of row.up; track region) {
                              <span
                                class="status-healthy inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                                [attr.data-testid]="'up-' + row.shape + '-' + region"
                              >
                                <span class="dot-healthy h-1.5 w-1.5 rounded-full"></span>
                                {{ region }}
                              </span>
                            }
                          </span>
                        } @else {
                          <span class="text-muted-foreground">nowhere</span>
                        }
                      </td>
                      <td [class]="t.td">
                        @if (row.down.length) {
                          <span class="flex flex-wrap gap-1">
                            @for (region of row.down; track region) {
                              <span
                                class="status-error inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                                [attr.data-testid]="'down-' + row.shape + '-' + region"
                              >
                                <span class="dot-error h-1.5 w-1.5 rounded-full"></span>
                                {{ region }}
                              </span>
                            }
                          </span>
                        } @else {
                          <span class="text-muted-foreground">nowhere</span>
                        }
                      </td>
                      <td [class]="t.tdNum">
                        <span
                          class="inline-flex items-center gap-1 tabular-nums"
                          [class]="
                            row.stale
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground'
                          "
                          [attr.data-testid]="'read-' + row.shape"
                        >
                          <ng-icon name="lucideClock" class="h-3 w-3" />
                          {{ row.age }}
                        </span>
                      </td>
                      <td [class]="t.td">
                        <span
                          class="flex flex-col gap-0.5"
                          [attr.data-testid]="'allowed-' + row.shape"
                          [attr.data-allowance]="row.allowance"
                        >
                          @switch (row.allowance) {
                            @case ('preferred') {
                              <span class="tabular-nums text-foreground">
                                preference {{ row.rank }}
                              </span>
                            }
                            @case ('refused-by-limit') {
                              <span class="text-destructive">refused by limit</span>
                            }
                            @default {
                              <span class="text-muted-foreground">not on the list</span>
                            }
                          }
                          @if (row.awaited) {
                            <span [class]="t.note">a standing order waits on it</span>
                          }
                        </span>
                      </td>
                    </tr>
                  } @empty {
                    <tr [class]="t.row">
                      <td [class]="t.tdMuted" colspan="6" data-testid="market-empty">
                        {{ emptyLine() }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </section>
    } @else {
      <section class="card-surface p-6" data-testid="market-tab-unknown">
        <h2 class="m-0 text-base font-medium text-foreground">No such scaling group</h2>
        <p class="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Nothing is configured under
          <span class="font-mono text-foreground">{{ groupId() ?? 'no id' }}</span
          >, so there is no provider whose catalogue to read.
        </p>
        <a routerLink="/scaling" class="card-link" data-testid="back-to-scaling">
          Back to every cluster
        </a>
      </section>
    }
  `,
})
export class ScalingMarketTabComponent {
  protected readonly store = inject(ScalingGroupStore);
  private readonly drafts = inject(GroupDraftStore);

  protected readonly t = TABLE;

  protected readonly groupId = this.store.groupId;

  protected readonly loading = computed(() => this.store.catalogue().loading);
  protected readonly failed = computed(() => this.store.catalogue().failed);

  protected readonly group = computed<SectionGroup | null>(() => {
    const id = this.groupId();
    return this.drafts.draft(id)?.group() ?? this.store.group().data;
  });

  protected readonly reading = computed(() => this.store.catalogue().data ?? null);

  protected readonly unread = computed(() => {
    const catalogue = this.reading();
    return catalogue && catalogue.reading !== 'read' ? catalogue : null;
  });

  protected readonly refusesEverything = computed(() => {
    const g = this.group();
    return g ? refusesWholeCatalogue(g.capability, g.limits.hourlyBillingOnly) : false;
  });

  protected readonly rows = computed<MarketRow[]>(() => {
    const g = this.group();
    if (!g) return [];

    const outlook = this.store.outlook();
    const awaited = new Set(g.standingOrders.map((o) => o.shape));
    const refused = this.refusesEverything();
    const allowed = g.shapes;
    const rest = Object.keys(outlook)
      .filter((shape) => !allowed.includes(shape))
      .sort((a, b) => a.localeCompare(b));

    return [...allowed, ...rest].map((shape): MarketRow => {
      const reading: AvailabilityOutlook | undefined = outlook[shape];
      const index = allowed.indexOf(shape);
      const age = reading?.ageSeconds ?? null;
      const onList = index !== -1;
      const state: CatalogueState = reading?.state ?? 'unknown';
      const held = reading?.sinceHours ? heldFor(reading.sinceHours) : '';

      return {
        shape,
        state,
        stateLabel: held ? `${STATE_LABEL[state]} · ${held}` : STATE_LABEL[state],
        up: reading?.upIn ?? [],
        down: reading?.downIn ?? [],
        age: readingAge(age),
        stale: age === null || age > STALE_AFTER_SECONDS,
        allowance: this.allowance(onList, refused),
        rank: onList ? index + 1 : null,
        awaited: awaited.has(shape),
      };
    });
  });

  protected readonly emptyLine = computed(() => {
    const catalogue = this.reading();
    if (!catalogue) return 'Nothing has been read yet.';
    if (catalogue.reading !== 'read') return catalogue.says;
    return `${catalogue.provider}'s catalogue was read and names no shape this group could buy. That is an answer about the group's list, not about the market.`;
  });

  protected pill(state: CatalogueState): string {
    return STATE_PILL[state];
  }

  private allowance(onList: boolean, refused: boolean): Allowance {
    if (!onList) return 'not-listed';
    return refused ? 'refused-by-limit' : 'preferred';
  }
}
