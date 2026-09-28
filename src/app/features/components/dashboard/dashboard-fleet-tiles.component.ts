import { Component, computed, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { StatTileComponent, StatTileData } from '../../../shared/components/charts';
import { FleetService } from '../../service/fleet.service';
import { fleetTiles } from './home-state';

@Component({
  selector: 'app-dashboard-fleet-tiles',
  standalone: true,
  imports: [StatTileComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (tiles().length > 0) {
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-4" data-testid="fleet-tiles">
        @for (tile of tiles(); track tile.label) {
          <app-stat-tile [data]="tile" [sparkWidth]="140" />
        }
      </div>
    } @else if (loading()) {
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-4" data-testid="fleet-tiles-loading">
        @for (_ of [1, 2, 3, 4]; track _) {
          <div class="card-surface p-4 h-[112px] flex flex-col gap-3">
            <div class="h-2.5 w-16 skeleton"></div>
            <div class="h-6 w-20 skeleton"></div>
            <div class="h-6 w-full skeleton"></div>
          </div>
        }
      </div>
    } @else if (failed()) {
      <div class="card-surface px-4 py-3 flex items-center justify-between gap-3" data-testid="fleet-tiles-error">
        <span class="text-sm text-muted-foreground">Cluster metrics could not be read</span>
        <button type="button" class="text-xs font-medium text-primary hover:underline" (click)="retry()">Retry</button>
      </div>
    }
  `,
  styles: [`:host { display: block; }`],
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

  readonly tiles = computed<StatTileData[]>(() => {
    const metrics = this.fleet.metrics();
    const state = this.fleet.metricsState();
    if (!metrics || state === 'forbidden') return [];
    return fleetTiles(metrics, this.fresh());
  });
}
