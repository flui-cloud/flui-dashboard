import { Component, computed, input } from '@angular/core';
import { CatalogInstallResponseDto } from '../../../core/api/model/models';
import { FlStatus } from '../../../ui/primitives/status';
import { installState } from './catalog-view';

@Component({
  selector: 'app-catalog-install-status-badge',
  imports: [FlStatus],
  host: { class: 'inline-flex' },
  template: `<fl-status [tone]="meta().tone" [label]="meta().label" />`,
})
export class CatalogInstallStatusBadgeComponent {
  readonly status = input.required<CatalogInstallResponseDto.StatusEnum>();

  readonly meta = computed(() => installState(this.status()));
}
