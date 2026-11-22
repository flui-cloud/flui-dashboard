import { Component, computed, input } from '@angular/core';
import { ReconciliationStatus } from '../../model/firewall-v2.models';
import { FlStatus } from '../../../ui/primitives/status';
import { reconciliationState } from '../cluster/cluster-firewall-format';

@Component({
  selector: 'app-reconciliation-status-badge',
  imports: [FlStatus],
  host: { class: 'inline-flex' },
  template: `<fl-status [tone]="state().tone" [label]="state().label" />`,
})
export class ReconciliationStatusBadgeComponent {
  status = input.required<ReconciliationStatus | string>();

  protected readonly state = computed(() => reconciliationState(this.status()));
}
