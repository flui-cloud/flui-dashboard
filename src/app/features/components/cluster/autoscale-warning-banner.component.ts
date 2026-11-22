import { Component, computed, input, output } from '@angular/core';

import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideZap } from '@ng-icons/lucide';
import { AutoscaleStatus } from '../../model/autoscale.models';
import { AlertTone, FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-autoscale-warning-banner',
  imports: [FlAlert, FlButton, FlIcon],
  providers: [provideIcons({ lucideZap, lucidePlus })],
  host: { class: 'contents' },
  template: `
    @if (visible()) {
      <fl-alert [tone]="tone()" [title]="title()">
        {{ status()?.warningMessage }}
        @if (showActions()) {
          <ng-container alertActions>
            @if (showConfigure()) {
              <button flButton size="sm" type="button" (click)="configure.emit()">
                <fl-icon name="lucideZap" [size]="14" />
                {{ status()?.autoscalingEnabled ? 'Manage autoscaling' : 'Configure autoscaling' }}
              </button>
            }
            @if (showAddWorker()) {
              <button flButton size="sm" type="button" (click)="addWorker.emit()">
                <fl-icon name="lucidePlus" [size]="14" />
                Add a node
              </button>
            }
          </ng-container>
        }
      </fl-alert>
    }
  `,
})
export class AutoscaleWarningBannerComponent {
  status = input<AutoscaleStatus | null>(null);
  showActions = input<boolean>(true);

  configure = output<void>();
  addWorker = output<void>();

  readonly visible = computed(() => {
    const s = this.status();
    return !!s && s.warning !== 'NONE';
  });

  readonly title = computed(() => {
    const s = this.status();
    if (!s) return '';
    if (s.warning === 'DANGER_NEEDS_SCALE') {
      return s.actuation === 'automatic'
        ? 'Critical pressure: a node should be on its way'
        : 'Critical pressure: add a worker or raise the ceiling now';
    }
    if (s.warning === 'WARN_NEEDS_AUTOSCALE') {
      return 'Cluster under sustained pressure: it will not grow on its own';
    }
    return '';
  });

  readonly tone = computed<AlertTone>(() =>
    this.status()?.warning === 'DANGER_NEEDS_SCALE' ? 'error' : 'warning',
  );

  readonly showConfigure = computed(() => true);
  readonly showAddWorker = computed(() => this.status()?.warning === 'DANGER_NEEDS_SCALE');
}
