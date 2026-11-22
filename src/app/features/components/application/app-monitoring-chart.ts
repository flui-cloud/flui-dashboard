import { Dialog } from '@angular/cdk/dialog';
import { Component, TemplateRef, inject, input, viewChild } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideMaximize2 } from '@ng-icons/lucide';
import {
  TimeSeriesChartConfig,
  TimeSeriesChartData,
  TimeSeriesLineComponent,
} from '../../../shared/components/charts';
import { FlDialog } from '../../../ui/overlays/dialog-frame';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-monitoring-chart',
  imports: [FlPanel, FlButton, FlIcon, FlDialog, TimeSeriesLineComponent],
  providers: [provideIcons({ lucideMaximize2 })],
  host: { class: 'block' },
  template: `
    <fl-panel [title]="title()">
      <div panelActions class="fl-row">
        @if (caption()) {
          <span class="fl-toolbar__info">{{ caption() }}</span>
        }
        @if (value()) {
          <span class="fl-num text-fl-body-sm">{{ value() }}</span>
        }
        @if (expandedConfig()) {
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [iconOnly]="true"
            [attr.aria-label]="'Expand chart ' + title()"
            (click)="expand()"
          >
            <fl-icon name="lucideMaximize2" [size]="14" />
          </button>
        }
      </div>
      <app-time-series-line [data]="data()" [config]="config()" />
    </fl-panel>

    <ng-template #expanded>
      <fl-dialog [title]="title()" [wide]="true">
        @if (caption() || value()) {
          <p class="m-0 fl-muted">
            {{ caption() }}{{ caption() && value() ? ' · ' : '' }}{{ value() }}
          </p>
        }
        <app-time-series-line [data]="data()" [config]="expandedConfig() ?? config()" />
      </fl-dialog>
    </ng-template>
  `,
})
export class AppMonitoringChart {
  private readonly dialog = inject(Dialog);
  private readonly expandedView = viewChild.required<TemplateRef<unknown>>('expanded');

  readonly title = input.required<string>();
  readonly caption = input('');
  readonly value = input('');
  readonly data = input.required<TimeSeriesChartData>();
  readonly config = input.required<TimeSeriesChartConfig>();
  readonly expandedConfig = input<TimeSeriesChartConfig | null>(null);

  protected expand(): void {
    this.dialog.open(this.expandedView(), {
      backdropClass: 'fl-backdrop',
      ariaModal: true,
      ariaLabel: this.title(),
    });
  }
}
