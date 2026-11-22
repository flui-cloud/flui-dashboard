import { Component, computed, inject } from '@angular/core';
import { ScalingModeComponent } from './scaling-mode.component';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingNowFleetComponent } from './now-fleet.component';
import { ScalingNowLadderComponent } from './now-ladder.component';
import { ScalingNowOrdersComponent } from './now-orders.component';
import { ScalingNowAddOrderComponent } from './now-add-order.component';
import { ScalingNowSummaryComponent } from './now-summary.component';
import { ScalingNowRoomComponent } from './now-room.component';
import { ScalingNowBlockedComponent } from './now-blocked.component';
import { ScalingGroupStore } from './scaling-group.store';
import { FlEmptyState } from '../../../ui/patterns/states';

@Component({
  selector: 'app-scaling-now-tab',
  imports: [
    ScalingModeComponent,
    ScalingNowFleetComponent,
    ScalingNowLadderComponent,
    ScalingNowOrdersComponent,
    ScalingNowAddOrderComponent,
    ScalingNowSummaryComponent,
    ScalingNowRoomComponent,
    ScalingNowBlockedComponent,
    FlEmptyState,
  ],
  host: { class: 'block' },
  template: `
    @if (group(); as g) {
      <div class="fl-stack" data-testid="tab-now">
        <app-scaling-mode [group]="g" (switched)="store.reload()">
          An app with nowhere to run is answered in seconds; a cheaper machine coming back is waited
          for, and that wait stops while anything is stuck.
        </app-scaling-mode>

        <app-scaling-now-summary [group]="g" />
        <app-scaling-now-blocked [group]="g" />
        <app-scaling-now-room [group]="g" />
        <app-scaling-now-ladder [group]="g" />
        <app-scaling-now-orders [group]="g">
          <app-scaling-now-add-order [group]="g" />
        </app-scaling-now-orders>
        <app-scaling-now-fleet [group]="g" />
      </div>
    } @else {
      <fl-empty-state
        title="No such group"
        body="This scaling group does not exist or was removed."
        data-testid="tab-now-no-group"
      />
    }
  `,
})
export class ScalingNowTabComponent {
  protected readonly store = inject(ScalingGroupStore);

  protected readonly group = computed<SectionGroup | null>(() => this.store.group().data);
}
