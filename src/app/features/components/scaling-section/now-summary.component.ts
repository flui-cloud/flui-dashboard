import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { ScalingApiService } from '../../service/scaling-api.service';
import {
  lucideBell,
  lucideCircleAlert,
  lucideCircleCheck,
  lucidePause,
  lucideRotateCcw,
} from '@ng-icons/lucide';
import {
  ClusterScalingRow,
  SectionGroup,
} from '../../model/scaling-section.models';
import { ScalingGroupStore } from './scaling-group.store';
import { ago, eurMonth } from './now-format';
import {
  SectionFailureComponent,
  SectionSkeletonComponent,
} from './section-states.component';

interface StatCard {
  id: string;
  label: string;
  value: string;
  caption: string;
}

@Component({
  selector: 'app-scaling-now-summary',
  standalone: true,
  imports: [
    NgIcon,
    HlmButtonDirective,
    SectionFailureComponent,
    SectionSkeletonComponent,
  ],
  providers: [
    provideIcons({
      lucideBell,
      lucideCircleAlert,
      lucideCircleCheck,
      lucidePause,
      lucideRotateCcw,
    }),
  ],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <app-section-skeleton
        variant="cards"
        [count]="4"
        label="this group's readings"
        testid="strip"
      />
    } @else if (failed()) {
      <app-section-failure
        [message]="failed() ?? ''"
        testid="strip"
        (retry)="store.reload()"
      />
    } @else {
      <div class="space-y-3">
        <dl
          class="m-0 grid grid-cols-2 gap-3 xl:grid-cols-4"
          data-testid="strip"
        >
          @for (card of cards(); track card.id) {
            <div
              class="rounded-lg border border-border bg-card px-4 py-3"
              [attr.data-testid]="'tile-' + card.id"
            >
              <dt class="text-label">{{ card.label }}</dt>
              <dd class="m-0">
                <span
                  class="block text-2xl font-bold tabular-nums text-foreground"
                  [attr.data-testid]="'tile-value-' + card.id"
                >
                  {{ card.value }}
                </span>
                @if (card.caption) {
                  <span
                    class="mt-0.5 block text-[12px] text-muted-foreground"
                    [attr.data-testid]="'tile-note-' + card.id"
                  >
                    {{ card.caption }}
                  </span>
                }
              </dd>
            </div>
          }
        </dl>

        <p
          class="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
          data-testid="state-line"
        >
          <ng-icon
            [name]="pending() ? 'lucideCircleAlert' : 'lucideCircleCheck'"
            class="h-4 w-4 shrink-0 translate-y-0.5"
            [class]="pending() ? 'text-amber-500' : 'text-muted-foreground'"
          />
          <span class="text-foreground">{{ state() }}</span>
        </p>

        @if (group().purchaseHeld; as hold) {
          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-sm"
            data-testid="purchase-held"
          >
            <ng-icon
              name="lucideBell"
              class="h-4 w-4 shrink-0 text-amber-500"
            />
            <div class="min-w-0 flex-1">
              <p class="m-0 text-foreground">
                A purchase failed {{ heldAge() }} ago — nothing more is bought
                until you try again.
              </p>
              @if (hold.error) {
                <p class="m-0 break-words text-[13px] text-muted-foreground">
                  {{ hold.error }}
                </p>
              }
              @if (retryError()) {
                <p class="m-0 text-[13px] text-red-600 dark:text-red-400">
                  {{ retryError() }}
                </p>
              }
            </div>
            <button
              hlmBtn
              size="sm"
              variant="outline"
              [disabled]="retrying()"
              (click)="retry()"
              data-testid="retry-purchase"
            >
              <ng-icon name="lucideRotateCcw" class="mr-1.5 h-3.5 w-3.5" />
              {{ retrying() ? 'Asking…' : 'Try again' }}
            </button>
          </div>
        } @else if (alarm(); as open) {
          <p
            class="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-sm"
            data-testid="open-alarm"
          >
            <ng-icon
              name="lucideBell"
              class="h-4 w-4 shrink-0 translate-y-0.5 text-amber-500"
            />
            <span class="text-foreground"
              >Open {{ open.age }} — {{ open.asks }}</span
            >
          </p>
        }

        @if (held(); as reason) {
          <p
            class="m-0 flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted-foreground"
            data-testid="opportunity-held"
          >
            <ng-icon
              name="lucidePause"
              class="h-3.5 w-3.5 shrink-0 translate-y-0.5"
            />
            <span>Opportunity held — {{ reason }}</span>
          </p>
        }
      </div>
    }
  `,
})
export class ScalingNowSummaryComponent {
  protected readonly store = inject(ScalingGroupStore);
  private readonly api = inject(ScalingApiService);

  readonly group = input.required<SectionGroup>();

  protected readonly loading = computed(
    () => this.store.preview().loading || this.store.row().loading,
  );

  protected readonly failed = computed(
    () => this.store.preview().failed ?? this.store.row().failed,
  );

  private readonly preview = computed(() => this.store.preview().data);
  private readonly row = computed(() => this.store.row().data);

  protected readonly pending = computed(() => this.preview()?.pending ?? null);
  protected readonly held = computed(
    () => this.preview()?.opportunityHeldBecause ?? null,
  );

  private readonly manual = computed(
    () => !this.group().capability.canProvision,
  );

  private readonly withheld = computed(
    () => this.group().capability.canProvision && !this.group().acts.acts,
  );

  protected readonly retrying = signal(false);
  protected readonly retryError = signal<string | null>(null);

  protected readonly heldAge = computed(() => {
    const hold = this.group().purchaseHeld;
    return hold ? ago(hold.failedAt.toISOString(), Date.now()) : '';
  });

  /**
   * Buys nothing by itself: the group may buy again from the next pass, inside
   * the same ceilings, and the page shows what that pass decides.
   */
  protected async retry(): Promise<void> {
    this.retrying.set(true);
    this.retryError.set(null);
    try {
      await firstValueFrom(this.api.retryPurchase(this.group().id));
      this.store.reload();
    } catch (err: unknown) {
      const e = err as { error?: { message?: string }; message?: string };
      this.retryError.set(e?.error?.message ?? e?.message ?? 'Could not ask the group to try again.');
    } finally {
      this.retrying.set(false);
    }
  }

  protected readonly alarm = computed<{ asks: string; age: string } | null>(
    () => {
      const open = this.row()?.openAlarm ?? null;
      return open
        ? { asks: open.asks, age: ago(open.since, Date.now()) }
        : null;
    },
  );

  protected readonly cards = computed<StatCard[]>(() => {
    const row = this.row();
    return [
      this.nodesCard(row),
      this.spendCard(row),
      this.pendingCard(),
      this.ordersCard(),
    ];
  });

  private nodesCard(row: ClusterScalingRow | null): StatCard {
    const bounds = this.group().bounds;

    const ceiling = this.manual()
      ? `ceiling ${bounds.max}, reported not enforced`
      : `ceiling ${bounds.max}`;

    return {
      id: 'nodes',
      label: 'Nodes',
      value: row ? `${row.nodes}` : '—',
      caption: `floor ${bounds.min} · target ${bounds.desired} · ${ceiling}`,
    };
  }

  private spendCard(row: ClusterScalingRow | null): StatCard {
    const group = this.group();
    const cap = group.limits.maxMonthlyCost;

    if (group.capability.billing === 'none') {
      return {
        id: 'spend',
        label: 'Spend',
        value: "operator's own",
        caption: 'not billed by Flui',
      };
    }

    if (!row) {
      return { id: 'spend', label: 'Spend', value: '—', caption: 'not read' };
    }

    if (row.monthlyEur === null) {
      return {
        id: 'spend',
        label: 'Spend',
        value: 'not priced',
        caption: `no price is known for ${row.unpricedNodes || row.nodes} of its nodes`,
      };
    }

    let against = 'no cap';
    if (cap !== null) {
      against = row.monthlyEur > cap ? `over its €${cap} cap` : `cap €${cap}`;
    }

    const unpriced = row.unpricedNodes;
    const nodeWord = unpriced === 1 ? 'node carries' : 'nodes carry';
    const floor = unpriced
      ? `at least — ${unpriced} ${nodeWord} no price · `
      : '';

    return {
      id: 'spend',
      label: 'Spend',
      value: eurMonth(row.monthlyEur),
      caption: `${floor}${against}`,
    };
  }

  private pendingCard(): StatCard {
    const group = this.group();
    const stuck = this.pending();
    const row = this.row();
    const unasked = row !== null && row.pendingPods === null && !stuck;
    const alreadyPending = stuck ? 1 : 0;
    const counted = row ? Math.max(row.pendingPods ?? 0, alreadyPending) : null;
    const waiting = stuck
      ? `${stuck.app} · ${stuck.cpu} · ${stuck.memory}, waited more than ${group.settleSeconds}s`
      : `after ${group.settleSeconds}s of waiting`;

    return {
      id: 'pending',
      label: 'Nowhere to run',
      value: counted === null || unasked ? '—' : `${counted}`,
      caption: unasked ? 'the cluster could not be asked' : waiting,
    };
  }

  private ordersCard(): StatCard {
    const orders = this.group().standingOrders;
    const blocked = orders.filter(
      (o) => o.drainable !== null && !o.drainable.ok,
    ).length;
    const blockedCaption = blocked ? `${blocked} blocked` : 'none blocked';

    return {
      id: 'orders',
      label: 'Standing orders',
      value: `${orders.length}`,
      caption: orders.length === 0 ? '' : blockedCaption,
    };
  }

  protected readonly state = computed(() => {
    const group = this.group();
    const stuck = this.pending();
    const chosen = this.preview()?.chosen ?? null;
    const fleet = this.row()?.nodes ?? null;

    const under =
      fleet !== null && fleet < group.bounds.min
        ? ` The fleet is also ${fleet} where the floor is ${group.bounds.min}, and the floor is held now rather than approached.`
        : '';

    if (!stuck) {
      if (fleet !== null && fleet < group.bounds.min) {
        return `Everything is running, but the fleet is ${fleet} where the floor is ${group.bounds.min}. The floor is held immediately, so this is already an alarm.`;
      }
      return 'Everything is running. Nothing for Flui to do.';
    }

    const since = `${stuck.app} has nowhere to run`;

    if (!chosen) {
      return `${since} — no machine fits, so it raises an alarm and buys nothing.${under}`;
    }
    if (this.manual()) {
      return `${since} — it would name ${chosen.shape} in ${chosen.region} and raise an alarm. Nothing here can buy it.${under}`;
    }
    if (this.withheld()) {
      return `${since} — a ${chosen.shape} in ${chosen.region} would fit, and this group is set to tell you rather than buy it.${under}`;
    }
    return `${since} — Flui would buy a ${chosen.shape} in ${chosen.region}.${under}`;
  });
}
