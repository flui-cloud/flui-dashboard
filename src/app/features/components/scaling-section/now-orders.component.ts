import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { ReplacePlan, StandingOrder } from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingGroupStore } from './scaling-group.store';
import {
  CatalogueState,
  STATE_LABEL,
  STATE_PILL,
  TABLE,
  heldFor,
} from './now-format';

const REPLACE_PLAN: ReplacePlan = {
  steps: [
    {
      at: 1,
      does: 'Ask whether the old node can be emptied',
      note: 'Before spending. Buying first and finding out after means paying for two nodes for good.',
    },
    { at: 2, does: 'Buy the new node and wait for it to join' },
    { at: 3, does: 'Cordon the old node, then drain it' },
    {
      at: 4,
      does: 'If the drain refuses: uncordon, keep both, say so loudly',
      note: 'A dedicated app deployed between the check and the drain still stops it. Silence here is a permanent double bill.',
    },
    { at: 5, does: 'Remove the old node' },
  ],
};

type OrderStatus = 'Stood down' | 'Blocked' | 'Waiting' | 'Ready';

interface BlockedBy {
  what: string;
  fix: string | null;
}

interface OrderRow {
  order: StandingOrder;
  shape: string;
  kindNote: string;
  state: CatalogueState;
  where: string;
  status: OrderStatus;
  statusNote: string;
  statusPill: string;
  blocked: BlockedBy[];
  cleared: string;
}

@Component({
  selector: 'app-scaling-now-orders',
  standalone: true,
  imports: [ExplainComponent],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-2" data-testid="orders">
      <h2 class="text-label m-0">Standing orders</h2>

      <div [class]="t.card">
        <div [class]="t.scroll">
          <table [class]="t.table">
            <thead>
              <tr [class]="t.headRow">
                <th scope="col" [class]="t.th">Order</th>
                <th scope="col" [class]="t.th">Availability</th>
                <th scope="col" [class]="t.th">
                  <app-explain
                    label="Status"
                    labelClass="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                    testid="status-why"
                  >
                    Nobody waits on these. If one never fires, nothing breaks —
                    the fleet simply cost more than it had to. While a pod is
                    pending they all stand down: urgency always wins.
                  </app-explain>
                </th>
                <th scope="col" [class]="t.th">Blocked by</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.order.kind + row.order.shape) {
                <tr
                  [class]="t.row"
                  [attr.data-testid]="'order-' + row.order.kind + '-' + row.order.shape"
                >
                  <th scope="row" [class]="t.td + ' font-normal'">
                    <span class="flex flex-col gap-0.5">
                      <span class="flex items-center gap-1.5">
                        <span
                          [class]="t.pill + ' w-fit ' + kindPill(row.order.kind)"
                          [attr.data-testid]="'order-kind-' + row.order.kind"
                        >
                          {{ row.order.kind }}
                        </span>
                        <span [class]="t.mono">{{ row.shape }}</span>
                      </span>
                      @if (row.kindNote) {
                        <span [class]="t.note">{{ row.kindNote }}</span>
                      }
                    </span>
                  </th>
                  <td [class]="t.td">
                    <span [class]="t.pill + ' w-fit ' + pill(row.state)" data-testid="order-state">
                      {{ row.where }}
                    </span>
                  </td>
                  <td [class]="t.td">
                    <span class="flex flex-col gap-0.5">
                      <span
                        [class]="t.pill + ' w-fit ' + row.statusPill"
                        [attr.data-testid]="'order-status-' + row.order.kind"
                      >
                        {{ row.status }}
                      </span>
                      @if (row.statusNote) {
                        <span [class]="t.note">{{ row.statusNote }}</span>
                      }
                    </span>
                  </td>
                  <td [class]="t.td">
                    @if (row.blocked.length) {
                      <span class="flex flex-col gap-1.5">
                        @for (blocker of row.blocked; track blocker.what) {
                          <span class="flex flex-col gap-0.5" data-testid="blocker">
                            <span class="font-mono text-[12px] text-foreground">
                              {{ blocker.what }}
                            </span>
                            @if (blocker.fix; as fix) {
                              <span [class]="t.note">{{ fix }}</span>
                            }
                          </span>
                        }
                        @if (row.cleared) {
                          <span [class]="t.note" data-testid="drain-cleared">
                            Cleared: {{ row.cleared }}
                          </span>
                        }
                      </span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr [class]="t.row">
                  <td [class]="t.tdMuted" colspan="4" data-testid="orders-empty">
                    {{ emptyLine() }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      @if (replaces()) {
        <app-explain
          label="What a replacement does, in order — an expansion does none of it"
          labelClass="text-[12px] font-medium text-foreground"
          testid="replace-plan"
        >
          @for (step of plan; track step.at) {
            <span class="block" [attr.data-testid]="'plan-step-' + step.at">
              {{ step.at }}. {{ step.does }}@if (step.note; as note) { — {{ note }} }
            </span>
          }
        </app-explain>
      }

    </section>
  `,
})
export class ScalingNowOrdersComponent {
  private readonly store = inject(ScalingGroupStore);

  readonly group = input.required<SectionGroup>();

  protected readonly t = TABLE;

  private readonly held = computed(
    () => this.store.preview().data?.opportunityHeldBecause ?? null
  );

  protected readonly replaces = computed(() =>
    this.group().standingOrders.some((o) => o.kind === 'replace')
  );

  protected readonly plan = REPLACE_PLAN.steps;

  protected readonly emptyLine = computed(() => {
    const group = this.group();
    if (!group.capability.hasCatalogue) {
      return 'No standing order. There is no market to wait for — a machine arrives when a person attaches one.';
    }
    if (!group.capability.canProvision) {
      return 'No standing order. Nothing here can buy, so the patient force has nothing to act with.';
    }
    return 'No standing order. The fleet keeps whatever urgency bought.';
  });

  protected readonly rows = computed<OrderRow[]>(() =>
    this.group().standingOrders.map((order) => {
      const outlook = order.outlook;
      const state: CatalogueState = outlook?.state ?? 'unknown';
      const blocked = this.blockersFor(order);
      const status = this.statusOf(order, blocked);

      return {
        order,
        shape: `${order.shape} · ${order.region} ×${order.wanted}`,
        kindNote:
          order.kind === 'expand' ? '' : `would drain ${order.replaces ?? 'a node'}`,
        state,
        where: outlook?.sinceHours
          ? `${STATE_LABEL[state]} · ${heldFor(outlook.sinceHours)}`
          : STATE_LABEL[state],
        status,
        statusNote: this.statusNote(status, order),
        statusPill: this.statusPill(status),
        blocked,
        cleared: order.drainable?.cleared.join(' · ') ?? '',
      };
    })
  );

  private blockersFor(order: StandingOrder): BlockedBy[] {
    const blocked: BlockedBy[] = [];

    if (order.drainable && !order.drainable.ok) {
      for (const blocker of order.drainable.blockers) {
        blocked.push({ what: `Drain: ${blocker.what}`, fix: blocker.fix });
      }
    }

    return blocked;
  }

  private statusOf(order: StandingOrder, blocked: readonly BlockedBy[]): OrderStatus {
    if (this.held()) return 'Stood down';
    if (blocked.length) return 'Blocked';
    return order.outlook?.upIn.includes(order.region) ? 'Ready' : 'Waiting';
  }

  protected pill(state: CatalogueState): string {
    return STATE_PILL[state];
  }

  protected kindPill(kind: StandingOrder['kind']): string {
    return kind === 'expand' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground';
  }

  private statusNote(status: OrderStatus, order: StandingOrder): string {
    switch (status) {
      case 'Stood down':
        return '';
      case 'Blocked':
        return 'cannot be emptied yet';
      case 'Waiting':
        return `waiting for ${order.shape} to come back`;
      case 'Ready':
        return 'would act on the next pass';
    }
  }

  private statusPill(status: OrderStatus): string {
    switch (status) {
      case 'Stood down':
        return 'bg-muted text-muted-foreground';
      case 'Blocked':
        return 'badge-error';
      case 'Waiting':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
      case 'Ready':
        return 'badge-success';
    }
  }
}
