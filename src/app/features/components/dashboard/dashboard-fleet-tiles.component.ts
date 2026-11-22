import { Component, computed, inject, input } from '@angular/core';
import { StatTileData } from '../../../shared/components/charts';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLineChart } from '../../../ui/patterns/chart';
import { FlErrorState, FlLoadingState } from '../../../ui/patterns/states';
import { FleetService } from '../../service/fleet.service';
import { fleetTiles } from './home-state';

@Component({
  selector: 'app-dashboard-fleet-tiles',
  imports: [FlPanel, FlLineChart, FlLoadingState, FlErrorState],
  host: { class: 'block' },
  template: `
    @if (tiles().length > 0) {
      <fl-panel title="Resource utilization" data-testid="fleet-tiles">
        <span panelActions class="fl-toolbar__info">{{ scope() }}</span>
        <div class="fl-util-grid">
          @for (tile of tiles(); track tile.label) {
            <figure class="fl-util" data-testid="fleet-tile">
              <figcaption class="fl-util__head">
                <span class="fl-util__label">{{ tile.label }}</span>
                <span class="fl-util__value">{{ tile.value }}{{ tile.unit }}</span>
              </figcaption>
              @if (tile.spark && tile.spark.length > 1) {
                <fl-line-chart
                  [compact]="true"
                  [series]="[{ label: tile.label, points: tile.spark }]"
                  [max]="scaleOf(tile)"
                  [xLabels]="['−' + window(), 'Now']"
                  [reading]="tile.label + ' ' + tile.value + (tile.unit ?? '') + ' now'"
                />
              }
              <span class="fl-util__caption" [title]="tile.deltaHint ?? ''">
                {{ tile.footnote }}{{ tile.delta ? ' · ' + tile.delta : '' }}
              </span>
            </figure>
          }
        </div>
      </fl-panel>
    } @else if (loading()) {
      <fl-panel title="Resource utilization" data-testid="fleet-tiles-loading">
        <fl-loading-state [rows]="3" />
      </fl-panel>
    } @else if (failed()) {
      <fl-panel title="Resource utilization" data-testid="fleet-tiles-error">
        <fl-error-state
          [compact]="true"
          title="Cluster metrics could not be read"
          (retry)="retry()"
        />
      </fl-panel>
    }
  `,
})
export class DashboardFleetTilesComponent {
  readonly fresh = input(false);

  private readonly fleet = inject(FleetService);

  readonly loading = computed(() => {
    const state = this.fleet.metricsState();
    return state === 'idle' || state === 'loading';
  });

  readonly failed = computed(() => this.fleet.metricsState() === 'error');

  protected retry(): void {
    void this.fleet.loadMetrics();
  }

  protected readonly window = computed(() => this.fleet.metrics()?.window ?? '');

  protected readonly scope = computed(() => {
    const nodes = this.fleet.metrics()?.fleet.nodesReporting ?? 0;
    return `${nodes} node${nodes === 1 ? '' : 's'} · ${this.window()}`;
  });

  protected scaleOf(tile: StatTileData): number {
    if (tile.unit === '%') return 100;
    const peak = Math.max(...(tile.spark ?? [0]));
    return peak > 0 ? peak * 1.2 : 1;
  }

  readonly tiles = computed<StatTileData[]>(() => {
    const metrics = this.fleet.metrics();
    const state = this.fleet.metricsState();
    if (!metrics || state === 'forbidden') return [];
    return fleetTiles(metrics, this.fresh());
  });
}
