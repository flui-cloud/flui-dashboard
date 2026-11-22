import { Component, computed, input } from '@angular/core';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-usage-status-badge',
  imports: [FlStatus],
  host: { class: 'inline-flex' },
  template: `<fl-status [tone]="inUse() ? 'success' : 'neutral'" [label]="label()" />`,
})
export class UsageStatusBadgeComponent {
  inUse = input.required<boolean>();

  readonly label = computed(() => (this.inUse() ? 'In use' : 'Unused'));
}
