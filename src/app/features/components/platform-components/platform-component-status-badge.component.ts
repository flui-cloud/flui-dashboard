import { Component, computed, input } from '@angular/core';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  healthy: { label: 'Healthy', tone: 'success' },
  degraded: { label: 'Degraded', tone: 'warning' },
  missing: { label: 'Missing', tone: 'error' },
};

@Component({
  selector: 'app-platform-component-status-badge',
  imports: [FlStatus],
  template: `<fl-status [tone]="view().tone" [label]="view().label" />`,
})
export class PlatformComponentStatusBadgeComponent {
  status = input.required<string>();

  protected readonly view = computed(
    () => STATUS[this.status()] ?? { label: this.status(), tone: 'neutral' as StatusTone },
  );
}
