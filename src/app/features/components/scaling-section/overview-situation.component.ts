import { Component, computed, input } from '@angular/core';
import { ClusterScalingRow } from '../../model/scaling-section.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlMetric, FlMetricStrip, MetricTone } from '../../../ui/patterns/metric-strip';
import { eurMonth, oldestAlarm } from './overview-format';

interface Card {
  id: string;
  label: string;
  value: string;
  caption: string | undefined;
  attention: boolean;
  tone: MetricTone;
}

@Component({
  selector: 'app-overview-situation',
  imports: [FlAlert, FlMetric, FlMetricStrip],
  host: { class: 'fl-stack' },
  template: `
    <fl-metric-strip data-testid="situation">
      @for (card of cards(); track card.id) {
        <fl-metric
          [label]="card.label"
          [value]="card.value"
          [caption]="card.caption"
          [tone]="card.tone"
          [attr.data-testid]="'tile-' + card.id"
          [attr.data-attention]="card.attention ? 'yes' : 'no'"
        />
      }
    </fl-metric-strip>

    @if (needing() > 0) {
      <fl-alert tone="warning" [title]="needingTitle()" data-testid="situation-alert">
        Each one is marked in the table below. An open alarm names a node waiting to be added by
        hand.
      </fl-alert>
    }
  `,
})
export class OverviewSituationComponent {
  readonly rows = input.required<ClusterScalingRow[]>();

  protected readonly needing = computed(
    () => this.rows().filter((r) => r.needsPerson !== null).length,
  );

  protected readonly needingTitle = computed(() => {
    const n = this.needing();
    return `${n} of ${this.rows().length} ${n === 1 ? 'cluster needs' : 'clusters need'} a person`;
  });

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
    const untracked = tracked === null ? 'No cluster carries one' : undefined;

    return [
      {
        id: 'needs-person',
        label: 'Need a person',
        value: `${needing}`,
        caption: `of ${all.length} clusters`,
        attention: needing > 0,
        tone: needing > 0 ? 'warning' : 'default',
      },
      {
        id: 'alarms',
        label: 'Open alarms',
        value: `${alarms}`,
        caption: oldest ? `Oldest ${oldest}` : undefined,
        attention: alarms > 0,
        tone: alarms > 0 ? 'warning' : 'default',
      },
      {
        id: 'spend',
        label: 'Billed to Flui',
        value: tracked === null ? 'No bill' : eurMonth(tracked),
        caption: overCap ? `${overCap} over cap` : untracked,
        attention: overCap > 0,
        tone: overCap > 0 ? 'warning' : 'default',
      },
    ];
  });
}
