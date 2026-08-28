import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
          label="Two forces, one fleet"
          labelClass="text-label"
          testid="two-forces"
        >
          Urgency runs when a pod cannot schedule: seconds, one pass, never
          waiting for a better price. Opportunity runs when a preferred or
          cheaper shape comes back: hours or days, and the waiting is the whole
          mechanism. Urgency always wins, and while a pod is pending the patient
          side stands down entirely.
        </app-explain>

        <app-scaling-now-summary [group]="g" />
        <app-scaling-now-ladder [group]="g" />
        <app-scaling-now-orders [group]="g" />
        <app-scaling-now-fleet [group]="g" />
      </div>
    } @else {
      <p class="m-0 text-sm text-muted-foreground" data-testid="tab-now-no-group">
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
}
