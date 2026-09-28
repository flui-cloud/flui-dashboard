import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { FleetMetrics, FleetReadState, FleetService } from '../../service/fleet.service';
import { ClusterService } from '../../service/cluster.service';
import { ApplicationService } from '../../service/application.service';
import { ProvidersService } from '../../service/providers.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ClusterInfo, ClusterStatus, ClusterType } from '../../model/cluster.models';
import { AppGroupView } from '../../model/application.models';
import { DashboardClustersTableComponent } from './dashboard-clusters-table.component';

const now = new Date().toISOString();
const point = { timestamp: now, cpuPercent: 13.5, memoryPercent: 52.1, diskPercent: 10, networkInBytesPerSecond: 1, networkOutBytesPerSecond: 1, nodes: 1 };

const CLUSTERS: ClusterInfo[] = [
  { id: 'c-1', name: 'control-cluster', status: ClusterStatus.ACTIVE, clusterType: ClusterType.CONTROL, provider: 'hetzner' as ClusterInfo['provider'], nodeCount: 1 },
  { id: 'c-2', name: 'wc-new', status: ClusterStatus.CREATING, clusterType: ClusterType.WORKLOAD, provider: 'ovh' as ClusterInfo['provider'] },
];

const METRICS: FleetMetrics = {
  window: '3h',
  step: '1m',
  rangeStart: now,
  rangeEnd: now,
  queriedAt: now,
  fleet: { clustersTotal: 2, clustersReporting: 1, nodesReporting: 1, current: point, series: [point] },
  clusters: [
    { clusterId: 'c-1', name: 'control-cluster', provider: 'hetzner', clusterType: 'control', status: 'active', metrics: 'reporting', nodesReporting: 1, lastSampleAt: now, current: point, series: [point, point] },
  ],
};

describe('DashboardClustersTableComponent', () => {
  let fixture: ComponentFixture<DashboardClustersTableComponent>;
  const state = signal<FleetReadState>('ready');

  const q = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  const build = async (fresh = false) => {
    await TestBed.configureTestingModule({
      imports: [DashboardClustersTableComponent],
      providers: [
        provideRouter([]),
        { provide: FleetService, useValue: { metrics: signal(METRICS), metricsState: state, window: signal('3h') } },
        { provide: ClusterService, useValue: { clusters: signal(CLUSTERS), progress: signal(40) } },
        {
          provide: ApplicationService,
          useValue: {
            applicationGroups: signal<Partial<AppGroupView>[]>([
              { clusterId: 'c-1', category: 'system' as AppGroupView['category'] },
              { clusterId: 'c-1', category: 'system' as AppGroupView['category'] },
            ]),
          },
        },
        { provide: ProvidersService, useValue: { getProviderById: (id: string) => ({ displayName: id === 'ovh' ? 'OVH' : 'Hetzner' }) } },
        { provide: ClusterAutoscaleService, useValue: { fetchStatusFor: () => Promise.resolve({ warning: 'NONE' }) } },
        { provide: PermissionService, useValue: { hasSection: () => false } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardClustersTableComponent);
    fixture.componentRef.setInput('fresh', fresh);
    fixture.detectChanges();
  };

  beforeEach(() => state.set('ready'));

  it('shows each cluster with its provider, status, readings and apps', async () => {
    await build();
    const control = q('cluster-row-c-1')!;
    expect(control.textContent).toContain('control-cluster');
    expect(control.textContent).toContain('Hetzner · control · 1 node');
    expect(control.textContent).toContain('Active');
    expect(control.textContent).toContain('13.5%');
    expect(control.textContent).toContain('52.1%');
    expect(control.textContent).toContain('2 system');
    const creating = q('cluster-row-c-2')!;
    expect(creating.textContent).toContain('Creating');
    expect(creating.textContent).toContain('Provisioning cluster');
    expect(creating.querySelector('[style*="width: 40%"]')).not.toBeNull();
  });

  it('drops the metric columns for someone the fleet metrics refuse', async () => {
    state.set('forbidden');
    await build();
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('CPU ·');
    expect(text).not.toContain('13.5%');
    expect(q('cluster-row-c-1')!.textContent).toContain('Active');
  });

  it('points a fresh install at creating a workload cluster', async () => {
    await build(true);
    expect(q('clusters-create-workload')).not.toBeNull();
    expect(q('clusters-fresh-hint')!.textContent).toContain('Your apps run on workload clusters');
    expect(fixture.nativeElement.textContent).not.toContain('13.5%');
  });
});
