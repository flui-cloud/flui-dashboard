import { Component, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ScalingApiService } from '../../service/scaling-api.service';
import { withoutOrder } from './standing-order-write';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { ReplacePlan, StandingOrder } from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingGroupStore } from './scaling-group.store';
import { CatalogueState, STATE_LABEL, STATE_TONE, heldFor } from './now-format';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { ConfirmService } from '../../../ui/overlays/confirm';

const REPLACE_PLAN: ReplacePlan = {
  steps: [
    {
      at: 1,
      does: 'Ask whether the old node can be emptied',
      note: 'Before spending. Adding first and finding out after means paying for two nodes for good.',
    },
    { at: 2, does: 'Add the new node and wait for it to join' },
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
  stateTone: StatusTone;
  where: string;
  status: OrderStatus;
  statusNote: string;
  statusTone: StatusTone;
  blocked: BlockedBy[];
  cleared: string;
}

@Component({
  selector: 'app-scaling-now-orders',
  imports: [ExplainComponent, FlPanel, FlEmptyState, FlTable, FlButton, FlStatus, FlTag],
  host: { class: 'block' },
  template: `
    <fl-panel
      title="Standing orders"
      [count]="rows().length || null"
      [flush]="true"
      data-testid="orders"
    >
      <ng-container panelActions><ng-content /></ng-container>

      @if (rows().length === 0) {
        <fl-empty-state
          title="No standing orders"
          [body]="emptyLine()"
          [compact]="true"
          data-testid="orders-empty"
        />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Availability</th>
                <th scope="col">
                  <app-explain [floating]="true" label="Status" labelClass="" testid="status-why">
                    Nothing breaks if one never fires: the fleet just costs more than it had to.
                    They stand down while an app is waiting to run.
                  </app-explain>
                </th>
                <th scope="col">Blocked by</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.order.kind + row.order.shape) {
                <tr [attr.data-testid]="'order-' + row.order.kind + '-' + row.order.shape">
                  <th scope="row" class="font-normal">
                    <span class="flex flex-col gap-0.5">
                      <span class="flex items-center gap-2">
                        <fl-tag [attr.data-testid]="'order-kind-' + row.order.kind">{{
                          row.order.kind
                        }}</fl-tag>
                        <span class="fl-mono">{{ row.shape }}</span>
                      </span>
                      @if (row.kindNote) {
                        <span class="text-fl-caption text-fl-ink-muted">{{ row.kindNote }}</span>
                      }
                    </span>
                  </th>
                  <td>
                    <fl-status
                      [tone]="row.stateTone"
                      [label]="row.where"
                      data-testid="order-state"
                    />
                  </td>
                  <td>
                    <span class="flex flex-col gap-0.5">
                      <fl-status
                        [tone]="row.statusTone"
                        [label]="row.status"
                        [attr.data-testid]="'order-status-' + row.order.kind"
                      />
                      @if (row.statusNote) {
                        <span class="text-fl-caption text-fl-ink-muted">{{ row.statusNote }}</span>
                      }
                    </span>
                  </td>
                  <td class="is-wrap">
                    @if (row.blocked.length) {
                      <span class="flex flex-col gap-1.5">
                        @for (blocker of row.blocked; track blocker.what) {
                          <span class="flex flex-col gap-0.5" data-testid="blocker">
                            <span class="fl-mono">{{ blocker.what }}</span>
                            @if (blocker.fix; as fix) {
                              <span class="text-fl-caption text-fl-ink-muted">{{ fix }}</span>
                            }
                          </span>
                        }
                        @if (row.cleared) {
                          <span
                            class="text-fl-caption text-fl-ink-muted"
                            data-testid="drain-cleared"
                          >
                            Cleared: {{ row.cleared }}
                          </span>
                        }
                      </span>
                    } @else {
                      <span class="text-fl-ink-muted">—</span>
                    }
                  </td>
                  <td class="is-fit">
                    @if (row.order.kind === 'expand') {
                      <button
                        flButton="ghost"
                        size="sm"
                        type="button"
                        [disabled]="cancelling()"
                        (click)="cancel(row.order)"
                        [attr.data-testid]="'order-cancel-' + row.order.shape"
                      >
                        Cancel, and lower the target back
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (replaces()) {
        <div class="border-t border-fl-border px-4 py-3">
          <app-explain
            [floating]="true"
            label="What a replacement does, in order. An expansion does none of it."
            labelClass="text-fl-body-sm font-medium text-fl-ink"
            testid="replace-plan"
          >
            @for (step of plan; track step.at) {
              <span class="block" [attr.data-testid]="'plan-step-' + step.at">
                {{ step.at }}. {{ step.does }}{{ step.note ? '. ' + step.note : '' }}
              </span>
            }
          </app-explain>
        </div>
      }
    </fl-panel>
  `,
})
export class ScalingNowOrdersComponent {
  private readonly store = inject(ScalingGroupStore);
  private readonly api = inject(ScalingApiService);
  private readonly confirm = inject(ConfirmService);

  protected readonly cancelling = signal(false);

  protected async cancel(order: StandingOrder): Promise<void> {
    const index = this.group().standingOrders.indexOf(order);
    if (index < 0) return;
    const ok = await this.confirm.confirm({
      title: 'Cancel this standing order?',
      body: `This removes the standing order for ${order.shape} and lowers the group's target back.`,
      confirmLabel: 'Cancel order',
      destructive: true,
    });
    if (!ok) return;
    this.cancelling.set(true);
    try {
      await firstValueFrom(
        this.api.updateGroup(this.group().id, withoutOrder(this.group(), index)),
      );
      this.store.reload();
    } finally {
      this.cancelling.set(false);
    }
  }

  readonly group = input.required<SectionGroup>();

  private readonly held = computed(() => this.store.preview().data?.opportunityHeldBecause ?? null);

  protected readonly replaces = computed(() =>
    this.group().standingOrders.some((o) => o.kind === 'replace'),
  );

  protected readonly plan = REPLACE_PLAN.steps;

  protected readonly emptyLine = computed(() => {
    const group = this.group();
    if (!group.capability.hasCatalogue) {
      return 'There is no catalogue to wait on. A machine arrives when a person attaches one.';
    }
    if (!group.capability.canProvision) {
      return 'Nothing here can add nodes, so the patient force has nothing to act with.';
    }
    return 'The fleet keeps whatever urgency added.';
  });

  protected readonly rows = computed<OrderRow[]>(() =>
    this.group().standingOrders.map((order) => {
      const outlook = order.outlook;
      const state: CatalogueState = outlook?.state ?? 'unknown';
      const blocked = this.blockersFor(order);
      const status = this.statusOf(order, blocked);

      return {
        order,
        shape: `${order.shape} · ${order.region === 'any' ? 'any region' : order.region} ×${order.wanted}`,
        kindNote: order.kind === 'expand' ? '' : `would drain ${order.replaces ?? 'a node'}`,
        state,
        stateTone: STATE_TONE[state],
        where: outlook?.sinceHours
          ? `${STATE_LABEL[state]} · ${heldFor(outlook.sinceHours)}`
          : STATE_LABEL[state],
        status,
        statusNote: this.statusNote(status, order),
        statusTone: this.statusTone(status),
        blocked,
        cleared: order.drainable?.cleared.join(' · ') ?? '',
      };
    }),
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
    const up = order.outlook?.upIn ?? [];
    const ready = order.region === 'any' ? up.length > 0 : up.includes(order.region);
    return ready ? 'Ready' : 'Waiting';
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

  private statusTone(status: OrderStatus): StatusTone {
    switch (status) {
      case 'Stood down':
        return 'neutral';
      case 'Blocked':
        return 'error';
      case 'Waiting':
        return 'warning';
      case 'Ready':
        return 'success';
    }
  }
}
