import { Component, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucidePause, lucideRotateCcw, lucideTriangleAlert } from '@ng-icons/lucide';
import { ScalingApiService } from '../../service/scaling-api.service';
import { PurchaseLogComponent } from './purchase-log.component';
import { ScalingNowGiveBackComponent } from './now-give-back.component';
import { ClusterScalingRow, SectionGroup } from '../../model/scaling-section.models';
import { ScalingGroupStore } from './scaling-group.store';
import { ago, eurMonth } from './now-format';
import { SectionFailureComponent, SectionSkeletonComponent } from './section-states.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlMetricStrip } from '../../../ui/patterns/metric-strip';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

interface StatCard {
  id: string;
  label: string;
  value: string;
  caption: string;
  warn?: boolean;
}

type PurchaseState = 'buying' | 'joined' | 'failed';

const PURCHASE_STATUS: Record<PurchaseState, { tone: StatusTone; label: string }> = {
  buying: { tone: 'progress', label: 'Adding a node' },
  joined: { tone: 'success', label: 'Node joined' },
  failed: { tone: 'error', label: 'Node not added' },
};

@Component({
  selector: 'app-scaling-now-summary',
  imports: [
    FlAlert,
    FlButton,
    FlIcon,
    FlMetricStrip,
    FlPanel,
    FlStatus,
    SectionFailureComponent,
    SectionSkeletonComponent,
    PurchaseLogComponent,
    ScalingNowGiveBackComponent,
  ],
  providers: [provideIcons({ lucidePause, lucideRotateCcw, lucideTriangleAlert })],
  host: { class: 'fl-stack' },
  template: `
    @if (loading()) {
      <app-section-skeleton
        variant="cards"
        [count]="4"
        label="this group's readings"
        testid="strip"
      />
    } @else if (failed()) {
      <app-section-failure [message]="failed() ?? ''" testid="strip" (retry)="store.reload()" />
    } @else {
      <fl-metric-strip data-testid="strip">
        @for (card of cards(); track card.id) {
          <div
            class="fl-metric"
            [class.fl-metric--warning]="card.warn"
            [attr.data-testid]="'tile-' + card.id"
          >
            <span class="fl-metric__label">{{ card.label }}</span>
            <span class="fl-metric__value" [attr.data-testid]="'tile-value-' + card.id">
              @if (card.warn) {
                <fl-icon name="lucideTriangleAlert" />
              }
              {{ card.value }}
            </span>
            @if (card.caption) {
              <span class="fl-metric__caption" [attr.data-testid]="'tile-note-' + card.id">
                {{ card.caption }}
              </span>
            }
          </div>
        }
      </fl-metric-strip>

      @if (group().purchase; as purchase) {
        <fl-panel title="Node purchase" data-testid="purchase-progress">
          <div class="flex flex-col gap-3">
            <div class="fl-row">
              <fl-status
                [tone]="purchaseStatus(purchase.state).tone"
                [label]="purchaseStatus(purchase.state).label"
              />
              <span class="text-fl-body-sm text-fl-ink">
                {{ purchase.says }}
                @if (purchase.state === 'joined' && purchase.finishedAt) {
                  <span class="text-fl-ink-muted"
                    >, joined at {{ clock(purchase.finishedAt) }}</span
                  >
                }
              </span>
            </div>
            @if (purchase.state === 'buying') {
              <span
                class="fl-bar"
                role="progressbar"
                aria-label="Node purchase progress"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-valuenow]="purchase.progress"
                ><span [style.width.%]="purchase.progress"></span
              ></span>
            }
            <app-purchase-log [operationId]="purchase.operationId" />
          </div>
        </fl-panel>
      }

      <fl-alert
        [tone]="pending() ? 'warning' : 'info'"
        [title]="pending() ? 'Something has nowhere to run' : 'Current state'"
        data-testid="state-line"
      >
        {{ state() }}
      </fl-alert>

      @if (group().purchaseHeld; as hold) {
        <fl-alert
          tone="warning"
          [title]="hold.until ? 'Machine sold out' : 'Adding a node failed'"
          data-testid="purchase-held"
        >
          @if (hold.until) {
            <span class="block">
              The machine was sold out {{ heldAge() }} ago and nothing was created. Flui reads
              availability again at {{ clockOf(hold.until) }}.
            </span>
          } @else {
            <span class="block">
              A node failed to be added {{ heldAge() }} ago. Nothing more is added until you try
              again.
            </span>
          }
          @if (hold.error) {
            <span class="mt-1 block break-words fl-mono">{{ hold.error }}</span>
          }
          @if (retryError()) {
            <span class="mt-1 block text-fl-danger">{{ retryError() }}</span>
          }
          <button
            alertActions
            flButton
            size="sm"
            type="button"
            [disabled]="retrying()"
            (click)="retry()"
            data-testid="retry-purchase"
          >
            <fl-icon name="lucideRotateCcw" [size]="14" />
            {{ retrying() ? 'Asking…' : 'Try again' }}
          </button>
        </fl-alert>
      } @else if (giveBack(); as back) {
        <app-scaling-now-give-back [group]="group()" [alarm]="back.alarm" [age]="back.age" />
      } @else if (alarm(); as open) {
        <fl-alert tone="warning" [title]="'Alarm open ' + open.age" data-testid="open-alarm">
          @if (!preview()?.blocked) {
            {{ open.asks }}
          }
        </fl-alert>
      }

      @if (held(); as reason) {
        <p
          class="m-0 flex items-center gap-2 text-fl-body-sm text-fl-ink-muted"
          data-testid="opportunity-held"
        >
          <fl-icon name="lucidePause" [size]="14" />
          <span>Opportunity held: {{ reason }}</span>
        </p>
      }
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

  protected readonly preview = computed(() => this.store.preview().data);
  private readonly row = computed(() => this.store.row().data);

  protected readonly pending = computed(() => this.preview()?.pending ?? null);
  protected readonly held = computed(() => this.preview()?.opportunityHeldBecause ?? null);

  private readonly manual = computed(() => !this.group().capability.canProvision);

  private readonly withheld = computed(
    () => this.group().capability.canProvision && !this.group().acts.acts,
  );

  protected readonly retrying = signal(false);
  protected readonly retryError = signal<string | null>(null);

  protected clockOf(at: Date): string {
    return at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

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
      this.retryError.set(
        e?.error?.message ?? e?.message ?? 'Could not ask the group to try again.',
      );
    } finally {
      this.retrying.set(false);
    }
  }

  protected readonly giveBack = computed(() => {
    const open = this.row()?.openAlarm ?? null;
    return open?.kind === 'give-back' && open.giveBack
      ? { alarm: open.giveBack, age: ago(open.since, Date.now()) }
      : null;
  });

  protected readonly alarm = computed<{ asks: string; age: string } | null>(() => {
    const open = this.row()?.openAlarm ?? null;
    return open ? { asks: open.asks, age: ago(open.since, Date.now()) } : null;
  });

  protected readonly cards = computed<StatCard[]>(() => {
    const row = this.row();
    return [this.nodesCard(row), this.spendCard(row), this.pendingCard(), this.ordersCard()];
  });

  private nodesCard(row: ClusterScalingRow | null): StatCard {
    const bounds = this.group().bounds;

    const most = this.manual() ? `max ${bounds.max}, reported not enforced` : `max ${bounds.max}`;

    return {
      id: 'nodes',
      label: 'Nodes',
      value: row ? `${row.nodes}` : '—',
      caption: `min ${bounds.min} · target ${bounds.desired} · ${most}`,
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

    let against = 'no spending ceiling';
    if (cap !== null) {
      against =
        row.monthlyEur > cap
          ? `over its spending ceiling of €${cap.toFixed(2)}`
          : `spending ceiling €${cap.toFixed(2)}`;
    }

    const unpriced = row.unpricedNodes;
    const nodeWord = unpriced === 1 ? 'node carries' : 'nodes carry';
    const floor = unpriced ? `at least — ${unpriced} ${nodeWord} no price · ` : '';

    return {
      id: 'spend',
      label: 'Spend',
      value: eurMonth(row.monthlyEur),
      caption: `${floor}${against}`,
      warn: cap !== null && row.monthlyEur > cap,
    };
  }

  /**
   * The cluster did not say what is waiting. One reading for the whole page:
   * the card and the sentence above it both say "not known" rather than one
   * of them claiming calm.
   */
  protected readonly unasked = computed(() => {
    const row = this.row();
    return row !== null && row.pendingPods === null && !this.pending();
  });

  private pendingCard(): StatCard {
    const group = this.group();
    const stuck = this.pending();
    const row = this.row();
    const unasked = this.unasked();
    const alreadyPending = stuck ? 1 : 0;
    const counted = row ? Math.max(row.pendingPods ?? 0, alreadyPending) : null;
    const waiting = stuck
      ? `${stuck.app} · ${stuck.cpu} · ${stuck.memory}, waited more than ${group.settleSeconds}s`
      : `after ${group.settleSeconds}s of waiting, checked every minute`;

    return {
      id: 'pending',
      label: 'Nowhere to run',
      value: counted === null || unasked ? '—' : `${counted}`,
      caption: unasked ? 'the cluster could not be asked' : waiting,
      warn: !unasked && (counted ?? 0) > 0,
    };
  }

  private ordersCard(): StatCard {
    const orders = this.group().standingOrders;
    const blocked = orders.filter((o) => o.drainable !== null && !o.drainable.ok).length;
    const blockedCaption = blocked ? `${blocked} blocked` : 'none blocked';

    return {
      id: 'orders',
      label: 'Standing orders',
      value: `${orders.length}`,
      caption: orders.length === 0 ? '' : blockedCaption,
      warn: blocked > 0,
    };
  }

  protected purchaseStatus(state: PurchaseState): { tone: StatusTone; label: string } {
    return PURCHASE_STATUS[state];
  }

  protected clock(at: Date): string {
    return at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  protected readonly state = computed(() => {
    const group = this.group();
    if (group.purchase?.state === 'buying') {
      return this.buyingState(group.purchase.shape);
    }
    const fleet = this.row()?.nodes ?? null;
    const floor = group.bounds.min;
    const belowFloor = fleet !== null && fleet < floor;
    const under = belowFloor
      ? ` The fleet is also ${fleet} where the floor is ${floor}, and the floor is held now rather than approached.`
      : '';
    const stuck = this.pending();
    if (!stuck) {
      return this.idleState(belowFloor, fleet, floor, under);
    }
    return this.stuckState(`${stuck.app} has nowhere to run`, under);
  });

  private buyingState(shape: string | null | undefined): string {
    const pending = this.pending();
    return pending
      ? `${pending.app} waits for the ${shape ?? 'node'} on its way.`
      : 'A node is on its way.';
  }

  private idleState(
    belowFloor: boolean,
    fleet: number | null,
    floor: number,
    under: string,
  ): string {
    if (this.unasked()) {
      return `The cluster could not be asked whether anything is waiting, so Flui cannot say that everything is running.${under}`;
    }
    if (belowFloor) {
      return `Everything is running, but the fleet is ${fleet} where the floor is ${floor}. The floor is held immediately, so this is already an alarm.`;
    }
    return 'Everything is running. Nothing for Flui to do.';
  }

  private stuckState(since: string, under: string): string {
    const chosen = this.preview()?.chosen ?? null;
    if (!chosen) {
      const blocked = this.preview()?.blocked?.headline;
      return blocked
        ? `${since}. ${blocked}.${under}`
        : `${since} — nothing this group may add can be had, so it raises an alarm and adds nothing.${under}`;
    }
    if (this.manual()) {
      return `${since} — it would name ${chosen.shape} in ${chosen.region} and raise an alarm. Nothing here can add it.${under}`;
    }
    if (this.withheld()) {
      return `${since} — a ${chosen.shape} in ${chosen.region} would fit, and this group is set to tell you rather than add it.${under}`;
    }
    return `${since} — Flui would add a ${chosen.shape} in ${chosen.region}.${under}`;
  }
}
