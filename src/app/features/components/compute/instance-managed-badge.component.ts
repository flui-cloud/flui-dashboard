import { Component, computed, input } from '@angular/core';
import { FlStatus } from '../../../ui/primitives/status';
import { InstanceOwnership } from '../../model/instance.models';
import { instanceOwnershipView } from './instance-status';

@Component({
  selector: 'app-instance-managed-badge',
  imports: [FlStatus],
  host: { class: 'inline-flex', '[attr.title]': 'view().hint' },
  template: `<fl-status [tone]="view().tone" [label]="view().label" />`,
})
export class InstanceManagedBadgeComponent {
  readonly ownership = input.required<InstanceOwnership>();

  protected readonly view = computed(() => instanceOwnershipView(this.ownership()));
}
