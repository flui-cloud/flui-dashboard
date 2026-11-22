import { Component, computed, input } from '@angular/core';
import { ReconciliationStatus } from '../../model/firewall-v2.models';
import { FlStatus } from '../../../ui/primitives/status';
import { driftState } from '../cluster/cluster-firewall-format';

@Component({
  selector: 'app-drift-indicator',
  imports: [FlStatus],
  host: { class: 'block' },
  template: `<fl-status [tone]="state().tone" [label]="state().label" />`,
})
export class DriftIndicatorComponent {
  hasDrift = input.required<boolean>();
  status = input.required<ReconciliationStatus | string>();
  showDetails = input<boolean>(false);
  desiredHash = input<string>();
  lastAppliedHash = input<string>();

  protected readonly state = computed(() => driftState(this.hasDrift(), this.status()));
}
