import { Component, computed, input } from '@angular/core';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

export type FirmnessLevel = 'declared' | 'derived' | 'circumstantial';

@Component({
  selector: 'app-firmness-badge',
  imports: [FlStatus],
  host: { class: 'inline-flex', '[attr.title]': 'hint()' },
  template: `<fl-status [tone]="tone()" [label]="label()" />`,
})
export class FirmnessBadgeComponent {
  readonly level = input.required<FirmnessLevel>();

  readonly label = computed(() => {
    switch (this.level()) {
      case 'declared':
        return 'Declared';
      case 'derived':
        return 'Derived';
      default:
        return 'Circumstantial';
    }
  });

  readonly hint = computed(() => {
    switch (this.level()) {
      case 'declared':
        return 'The repository states this directly: a Dockerfile line, a config key, a lockfile entry.';
      case 'derived':
        return 'Computed from other declared facts, not read directly.';
      default:
        return 'A weak signal, such as a library import or a filename pattern. Check it before you trust it.';
    }
  });

  readonly tone = computed<StatusTone>(() => (this.level() === 'declared' ? 'success' : 'warning'));
}
