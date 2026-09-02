import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideCircleAlert,
  lucideCircleCheck,
} from '@ng-icons/lucide';

import { ClusterScalingRow } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { loadedOf } from '../scaling-section/section-reading';
import {
  SectionFailureComponent,
  SectionSkeletonComponent,
} from '../scaling-section/section-states.component';

interface Tile {
  id: string;
  label: string;
  value: string;
  note: string;
  tone: 'plain' | 'attention';
}

function since(iso: string | null, now: number): string {
  if (iso === null) return '—';
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  return hours >= 48 ? `${Math.round(hours / 24)}d` : `${hours}h`;
}

function eurMonth(value: number): string {
  return `€${value.toFixed(2)}/mo`;
}

@Component({
  selector: 'cluster-scaling-tab',
  standalone: true,
  imports: [NgIcon, SectionFailureComponent, SectionSkeletonComponent],
  providers: [
    provideIcons({ lucideArrowRight, lucideCircleAlert, lucideCircleCheck }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-surface space-y-4 p-6" data-testid="cluster-scaling-tab">
      @if (loading()) {
        <app-section-skeleton
          variant="cards"
          [count]="4"
          label="this cluster's scaling"
          testid="cluster-scaling"
        />
      } @else if (failed()) {
        <app-section-failure
          [message]="failed() ?? ''"
          testid="cluster-scaling"
          (retry)="rowRes.reload()"
        />
      } @else {
        @if (row(); as row) {
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-baseline gap-2">
            <h2 class="m-0 text-lg font-semibold tracking-tight text-foreground">Scaling</h2>
            <span class="font-mono text-[13px] text-muted-foreground" data-testid="subject">
              {{ row.clusterName }} · {{ row.capability.provider }}
            </span>
          </div>
        </header>

        <dl class="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="strip">
          @for (tile of tiles(); track tile.id) {
            <div
              class="rounded-lg border border-border bg-card px-4 py-3"
              [attr.data-testid]="'tile-' + tile.id"
              [attr.data-tone]="tile.tone"
            >
              <dt class="m-0 text-xs text-muted-foreground">{{ tile.label }}</dt>
              <dd class="m-0 mt-0.5">
                <span
                  class="text-2xl font-bold tabular-nums"
                  [class]="tile.tone === 'attention' ? 'status-degraded' : 'text-foreground'"
                  [attr.data-testid]="'tile-value-' + tile.id"
                >
                  {{ tile.value }}
                </span>
                <span class="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {{ tile.note }}
                </span>
              </dd>
            </div>
          }
        </dl>

        <p
          class="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-border px-3 py-2 text-sm"
          [class]="row.needsPerson ? 'bg-muted/50' : 'bg-card'"
          data-testid="state-line"
        >
          <ng-icon
            [name]="row.needsPerson ? 'lucideCircleAlert' : 'lucideCircleCheck'"
            class="h-4 w-4 shrink-0 translate-y-0.5"
            [class]="row.needsPerson ? 'status-degraded' : 'text-muted-foreground'"
          />
          <span class="text-foreground">{{ state() }}</span>
        </p>

        @if (row.openAlarm; as alarm) {
          <p
            class="m-0 max-w-prose text-[13px] leading-relaxed text-muted-foreground"
            data-testid="alarm"
          >
            <span class="font-medium text-foreground">The alarm asks</span>
            {{ alarm.asks }} Unanswered for
            <span class="font-medium tabular-nums text-foreground" data-testid="alarm-age">{{
              alarmAge()
            }}</span
            >. It is where the group stands, not a queued item: it goes when the
            group decides something else — including the pass after somebody
            attaches a machine by hand.
          </p>
        }

        <p
          class="m-0 max-w-prose text-[13px] leading-relaxed text-muted-foreground"
          data-testid="how-it-grows"
        >
          {{ howItGrows() }}
        </p>

        <div class="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button
            type="button"
            (click)="handOff()"
            class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="hand-off"
          >
            <span>{{ row.groupId ? 'Manage scaling' : 'Set up scaling' }}</span>
            <ng-icon name="lucideArrowRight" class="h-4 w-4" />
          </button>
          <span class="text-[12px] text-muted-foreground">
            Bounds, purchases, the market and the decision log all live in Scaling.
            @if (row.groupCount > 1) {
              This cluster holds {{ row.groupCount }} groups; the figures above are
              the first one's.
            }
          </span>
        </div>
        } @else {
          <p class="m-0 text-sm text-muted-foreground" data-testid="no-such-cluster">
            The API has no scaling row for this cluster. Either it is gone, or
            this build does not serve the route.
          </p>
        }
      }
    </div>
  `,
})
export class ClusterScalingTabComponent {
  private readonly api = inject(ScalingApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly parent = this.route.parent ?? this.route;
  private readonly params = toSignal(this.parent.paramMap, {
    initialValue: this.parent.snapshot.paramMap,
  });

  private readonly now = Date.now();

  protected readonly clusterId = computed(() => this.params().get('id'));

  protected readonly rowRes = rxResource({
    params: () => this.clusterId() ?? undefined,
    stream: ({ params }) => this.api.row(params),
  });

  private readonly loaded = loadedOf<ClusterScalingRow>(
    this.rowRes,
    "This cluster's scaling",
  );

  protected readonly loading = computed(() => this.loaded().loading);
  protected readonly failed = computed(() => this.loaded().failed);
  protected readonly row = computed(() => this.loaded().data);

  protected readonly alarmAge = computed(() =>
    since(this.row()?.openAlarm?.since ?? null, this.now),
  );

  private readonly buys = computed(() => this.row()?.capability.canProvision ?? false);
  private readonly names = computed(() => this.row()?.capability.hasCatalogue ?? false);

  protected readonly tiles = computed<Tile[]>(() => {
    const row = this.row();
    if (!row) return [];
    const bounds = row.bounds;
    const enforced = this.buys() ? '' : ', reported not enforced';
    const boundsNote = bounds
      ? `floor ${bounds.min} · target ${bounds.desired} · ceiling ${bounds.max}${enforced}`
      : 'no bounds set';
    const ordersNote = this.buys()
      ? `${row.openOrders} purchases open · ${row.blockedOrders} blocked`
      : 'no purchases here — alarms only';
    const lastDecision = row.lastDecisionAt
      ? `${since(row.lastDecisionAt, this.now)} ago`
      : 'never';

    return [
      {
        id: 'fleet',
        label: 'Nodes',
        value: `${row.nodes}`,
        note: boundsNote,
        tone: !bounds || row.nodes < bounds.min || row.nodes > bounds.max ? 'attention' : 'plain',
      },
      this.spendTile(row),
      {
        id: 'pending',
        label: 'Pods pending',
        value: row.pendingPods === null ? '—' : `${row.pendingPods}`,
        note:
          row.pendingPods === null ? 'the cluster could not be asked' : ordersNote,
        tone:
          (row.pendingPods ?? 0) > 0 || row.blockedOrders > 0
            ? 'attention'
            : 'plain',
      },
      {
        id: 'alarm',
        label: 'Open alarm',
        value: row.openAlarm ? this.alarmAge() : 'none',
        note: row.openAlarm
          ? `unanswered since ${row.openAlarm.since.slice(0, 10)}`
          : `last decision ${lastDecision}`,
        tone: row.openAlarm ? 'attention' : 'plain',
      },
    ];
  });

  private spendTile(row: ClusterScalingRow): Tile {
    const cap = row.monthlyCap;
    const spend = row.monthlyEur;

    if (spend === null) {
      const billed = row.capability.billing === 'none';
      return {
        id: 'spend',
        label: 'Spend',
        value: billed ? 'No bill' : 'Not priced',
        note: billed
          ? 'your machines — Flui is never billed'
          : `no price is known for ${row.unpricedNodes || row.nodes} of its nodes`,
        tone: 'plain',
      };
    }

    const over = cap !== null && spend > cap;
    let note = 'no cap set';
    if (cap !== null) {
      note = over
        ? `€${(spend - cap).toFixed(2)} over its €${cap} cap`
        : `€${(cap - spend).toFixed(2)} under its €${cap} cap`;
    }

    return {
      id: 'spend',
      label: 'Spend',
      value: eurMonth(spend),
      note: row.unpricedNodes ? `at least — ${note}` : note,
      tone: over ? 'attention' : 'plain',
    };
  }

  protected readonly state = computed(() => {
    const row = this.row();
    if (!row) return '';
    if (row.needsPerson) return row.needsPerson;
    return `Within its bounds, and nothing is waiting on you. ${
      this.buys() ? 'Flui will buy a node if one is needed.' : 'An alarm will name what to add.'
    }`;
  });

  protected readonly howItGrows = computed(() => {
    const row = this.row();
    if (!row) return '';
    if (this.buys()) {
      return `Flui buys nodes for this cluster through the ${row.capability.provider} API, billed by the hour.`;
    }
    if (this.names()) {
      return `Flui cannot create servers at ${row.capability.provider}. It reads the catalogue, so an alarm can name the shape and its price — you buy it, then the node joins. Billed by the month.`;
    }
    return 'These machines are yours. There is no catalogue to name a shape from and no bill for Flui to see, so an alarm can only state what the machine has to hold.';
  });

  protected handOff(): void {
    const row = this.row();
    if (!row) return;
    if (row.groupId) {
      void this.router.navigate(['/scaling', row.groupId]);
      return;
    }
    void this.router.navigate(['/scaling'], {
      queryParams: { cluster: row.clusterId },
    });
  }
}
