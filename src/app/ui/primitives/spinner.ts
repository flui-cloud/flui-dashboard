import { Component, input } from '@angular/core';

@Component({
  selector: 'fl-spinner',
  host: { class: 'fl-spinner', role: 'status', '[attr.aria-label]': 'label()' },
  template: ``,
})
export class FlSpinner {
  readonly label = input('Loading');
}
