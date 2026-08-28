import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ClusterScalingRow } from '../../model/scaling-section.models';
import { eurMonth, oldestAlarm } from './overview-format';

interface Card {
  id: string;
  label: string;
  value: string;
  suffix: string | null;
  caption: string | null;
  attention: boolean;
  emphasis: boolean;
}

@Component({
  selector: 'app-overview-situation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="m-0 grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="situation">
      @for (card of cards(); track card.id) {
        <div
          class="rounded-lg border border-border bg-card px-4 py-3"
          [attr.data-testid]="'tile-' + card.id"
          [attr.data-attention]="card.attention ? 'yes' : 'no'"
        >
          <dt class="m-0 text-xs text-muted-foreground">{{ card.label }}</dt>
          <dd class="m-0 mt-0.5">
            <span
              class="text-2xl font-bold tabular-nums"
              [class]="card.emphasis ? 'status-degraded' : 'text-foreground'"
              [attr.data-testid]="'tile-value-' + card.id"
              >{{ card.value
              }}@if (card.suffix; as suffix) {<span
                class="ml-1.5 text-sm font-normal text-muted-foreground"
                >{{ suffix }}</span
              >}</span
            >
            @if (card.caption; as caption) {
              <span class="mt-0.5 block text-xs text-muted-foreground">{{ caption }}</span>
            }
          </dd>
        </div>
      }
    </dl>
  `,
})
export class OverviewSituationComponent {
  readonly rows = input.required<ClusterScalingRow[]>();

  protected readonly needing = computed(
    () => this.rows().filter((r) => r.needsPerson !== null).length,
  );

  private readonly oldest = computed(() =>
    oldestAlarm(
      this.rows().map((r) => r.openAlarm?.since),
      Date.now(),
    ),
  );

  protected readonly cards = computed<Card[]>(() => {
    const all = this.rows();
    const needing = this.needing();
    const alarms = all.filter((r) => r.openAlarm !== null).length;
    const oldest = this.oldest();
    const priced = all.filter((r) => r.monthlyEur !== null);
    const tracked = priced.length
      ? priced.reduce((sum, r) => sum + (r.monthlyEur as number), 0)
      : null;
    const overCap = all.filter(
      (r) => r.monthlyCap !== null && r.monthlyEur !== null && r.monthlyEur > r.monthlyCap,
    ).length;
    const untracked = tracked === null ? 'no cluster carries one' : null;

    return [
      {
        id: 'needs-person',
        label: 'Need a person',
        value: `${needing}`,
        suffix: `of ${all.length}`,
        caption: null,
        attention: needing > 0,
        emphasis: needing > 0,
      },
      {
        id: 'alarms',
        label: 'Open alarms',
        value: `${alarms}`,
        suffix: oldest ? `oldest ${oldest}` : null,
        caption: null,
        attention: alarms > 0,
        emphasis: alarms > 0,
      },
      {
        id: 'spend',
        label: 'Billed to Flui',
        value: tracked === null ? 'No bill' : eurMonth(tracked),
        suffix: overCap ? `${overCap} over cap` : untracked,
        caption: null,
        attention: overCap > 0,
        emphasis: false,
      },
    ];
  });
}
