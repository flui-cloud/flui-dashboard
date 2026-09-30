import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { DashboardService } from '../../service/dashboard.service';
import { FleetService } from '../../service/fleet.service';
import { ClusterService } from '../../service/cluster.service';
import { PermissionService } from '../../../core/services/permission.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { ClusterInfo, ClusterStatus, ClusterType } from '../../model/cluster.models';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  const clusters = signal<ClusterInfo[]>([]);
  const userApps = signal(0);
  let fleet: { loadAll: jasmine.Spy; loadMetrics: jasmine.Spy; loadNeedsYou: jasmine.Spy };

  const q = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  const order = (): string[] =>
    Array.from((q('home-fresh') ?? q('home-control-room'))!.querySelectorAll('*'))
      .map((e) => e.tagName.toLowerCase())
      .filter((t) => t.startsWith('app-dashboard-'));

  const build = async () => {
    fleet = {
      loadAll: jasmine.createSpy('loadAll').and.returnValue(Promise.resolve()),
      loadMetrics: jasmine.createSpy('loadMetrics'),
      loadNeedsYou: jasmine.createSpy('loadNeedsYou'),
    };
    const zero = signal(0);
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            initialize: () => Promise.resolve(),
            refresh: () => Promise.resolve(),
            backendHealth: signal('online'),
            clustersInOperation: signal([]),
            activeProvidersCount: zero,
            totalClusters: zero,
            activeClusters: zero,
            unhealthyClusters: zero,
            totalNodes: zero,
            userTotalApps: userApps,
            runningApps: zero,
            failedApps: zero,
            databasesApps: zero,
            applicationsApps: zero,
            toolsApps: zero,
          },
        },
        { provide: FleetService, useValue: fleet },
        { provide: ClusterService, useValue: { clusters } },
        { provide: PermissionService, useValue: { loadSections: () => undefined } },
        { provide: CurrentSurfaceService, useValue: { set: () => undefined } },
      ],
    });
    TestBed.overrideComponent(DashboardComponent, {
      set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };

  afterEach(() => fixture.destroy());

  it('shows the just-installed board with DNS first when only the control cluster exists', async () => {
    clusters.set([{ id: 'c-1', status: ClusterStatus.ACTIVE, clusterType: ClusterType.CONTROL }]);
    userApps.set(0);
    await build();
    expect(q('home-fresh')).not.toBeNull();
    expect(order()[0]).toBe('app-dashboard-certs');
    expect(order()).not.toContain('app-dashboard-workloads');
    expect(fleet.loadAll).toHaveBeenCalled();
  });

  it('shows the control room once a workload cluster exists', async () => {
    clusters.set([
      { id: 'c-1', status: ClusterStatus.ACTIVE, clusterType: ClusterType.CONTROL },
      { id: 'c-2', status: ClusterStatus.CREATING, clusterType: ClusterType.WORKLOAD },
    ]);
    userApps.set(0);
    await build();
    expect(q('home-control-room')).not.toBeNull();
    const [left, right] = Array.from(q('home-columns')!.children).map((column) =>
      Array.from(column.children).map((card) => card.tagName.toLowerCase()),
    );
    expect(left).toEqual(['app-dashboard-clusters-table', 'app-dashboard-certs', 'app-dashboard-activity']);
    expect(right).toEqual([
      'app-dashboard-needs-you',
      'app-dashboard-agent-status',
      'app-dashboard-backups',
      'app-dashboard-workloads',
    ]);
    const cards = Array.from(q('home-columns')!.querySelectorAll('[class*="order-"]'));
    const readingOrder = cards
      .map((card) => ({ tag: card.tagName.toLowerCase(), order: Number(/order-(\d+)/.exec(card.className)![1]) }))
      .sort((a, b) => a.order - b.order)
      .map((card) => card.tag);
    expect(readingOrder).toEqual([
      'app-dashboard-clusters-table',
      'app-dashboard-needs-you',
      'app-dashboard-agent-status',
      'app-dashboard-certs',
      'app-dashboard-backups',
      'app-dashboard-activity',
      'app-dashboard-workloads',
    ]);
  });

  it('shows the control room once the user has an app, even on the control cluster alone', async () => {
    clusters.set([{ id: 'c-1', status: ClusterStatus.ACTIVE, clusterType: ClusterType.CONTROL }]);
    userApps.set(2);
    await build();
    expect(q('home-control-room')).not.toBeNull();
  });
});
