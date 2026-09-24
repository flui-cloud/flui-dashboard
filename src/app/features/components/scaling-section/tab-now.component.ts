import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingNowFleetComponent } from './now-fleet.component';
import { ScalingNowLadderComponent } from './now-ladder.component';
import { ScalingNowOrdersComponent } from './now-orders.component';
import { ScalingNowSummaryComponent } from './now-summary.component';
import { ScalingGroupStore } from './scaling-group.store';

@Component({
  selector: 'app-scaling-now-tab',
  standalone: true,
  imports: [
    ExplainComponent,
    ScalingNowFleetComponent,
    ScalingNowLadderComponent,
    ScalingNowOrdersComponent,
    ScalingNowSummaryComponent,
  ],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (group(); as g) {
      <div class="space-y-6" data-testid="tab-now">
        <app-explain
          [floating]="true"
          [label]="mode(g)"
          labelClass="text-label"
          testid="scaling-mode"
        >
          {{ g.acts.says }} An app with nowhere to run is answered in seconds; a
          cheaper machine coming back is waited for, and that wait stops while
          anything is stuck.
        </app-explain>

        <app-scaling-now-summary [group]="g" />
        <app-scaling-now-ladder [group]="g" />
        <app-scaling-now-orders [group]="g" />
        <app-scaling-now-fleet [group]="g" />
      </div>
    } @else {
      <p
        class="m-0 text-sm text-muted-foreground"
        data-testid="tab-now-no-group"
      >
        No such group.
      </p>
    }
  `,
})
export class ScalingNowTabComponent {
  private readonly store = inject(ScalingGroupStore);

  protected readonly group = computed<SectionGroup | null>(
    () => this.store.group().data,
  );

  /** Which of the three kinds of scaling is armed here. */
  protected mode(group: SectionGroup): string {
    if (!group.capability.canProvision) return 'Alarms only';
    return group.acts.acts ? 'Buys on its own' : 'Alarms, does not buy';
  }
}
