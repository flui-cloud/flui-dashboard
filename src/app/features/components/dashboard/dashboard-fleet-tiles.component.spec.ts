import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FleetMetrics, FleetReadState, FleetService } from '../../service/fleet.service';
import { DashboardFleetTilesComponent } from './dashboard-fleet-tiles.component';

const now = new Date().toISOString();
const point = { timestamp: now, cpuPercent: 13.7, memoryPercent: 45, diskPercent: 12.2, networkInBytesPerSecond: 7168, networkOutBytesPerSecond: 60416, nodes: 2 };

const METRICS: FleetMetrics = {
  window: '3h',
  step: '1m',
  rangeStart: now,
  rangeEnd: now,
  queriedAt: now,
  fleet: { clustersTotal: 2, clustersReporting: 2, nodesReporting: 2, current: point, series: [point, point] },
  clusters: [],
};

describe('DashboardFleetTilesComponent', () => {
  let fixture: ComponentFixture<DashboardFleetTilesComponent>;
  const state = signal<FleetReadState>('ready');
  const metrics = signal<FleetMetrics | null>(METRICS);
  const loadMetrics = jasmine.createSpy('loadMetrics');

  const q = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  beforeEach(async () => {
    state.set('ready');
    metrics.set(METRICS);
    await TestBed.configureTestingModule({
      imports: [DashboardFleetTilesComponent],
      providers: [{ provide: FleetService, useValue: { metrics, metricsState: state, loadMetrics } }],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardFleetTilesComponent);
    fixture.detectChanges();
  });

  it('shows the four fleet readings', () => {
    const tiles = q('fleet-tiles')!.querySelectorAll('app-stat-tile');
    expect(tiles).toHaveSize(4);
    const text = q('fleet-tiles')!.textContent!;
    expect(text).toContain('13.7');
    expect(text).toContain('2 clusters reporting');
    expect(text).toContain('↓ 7 KB/s · ↑ 59 KB/s');
  });

  it('shows nothing to a guest the metrics refuse', () => {
    state.set('forbidden');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('offers a retry when the metrics could not be read', () => {
    metrics.set(null);
    state.set('error');
    fixture.detectChanges();
    (q('fleet-tiles-error')!.querySelector('button') as HTMLButtonElement).click();
    expect(loadMetrics).toHaveBeenCalled();
  });
});
