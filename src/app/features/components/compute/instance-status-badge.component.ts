import { Component, computed, input } from '@angular/core';
import { FlStatus } from '../../../ui/primitives/status';
import { instanceStatusLabel, instanceStatusTone } from './instance-status';

@Component({
  selector: 'app-instance-status-badge',
  imports: [FlStatus],
  host: { class: 'inline-flex' },
  template: `<fl-status [tone]="tone()" [label]="label()" />`,
})
export class InstanceStatusBadgeComponent {
  readonly status = input.required<string>();

  protected readonly tone = computed(() => instanceStatusTone(this.status()));
  protected readonly label = computed(() => instanceStatusLabel(this.status()));
}
