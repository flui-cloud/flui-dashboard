import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ClusterMonitoringService } from './cluster-monitoring.service';
import { ClusterService } from './cluster.service';
import { ClusterMetricsLogsService } from '../../core/api/api/clusterMetricsLogs.service';
import { ClusterHealthService } from '../../core/api/api/clusterHealth.service';

describe('ClusterMonitoringService without metrics', () => {
  it('shows "no metrics yet" and keeps refreshing on a 404, instead of reporting a failure', async () => {
    const notFound = throwError(() => ({ status: 404 }));
    TestBed.configureTestingModule({
      providers: [
        ClusterMonitoringService,
        { provide: ClusterService, useValue: { cluster: signal({ id: 'c1' }) } },
        { provide: ClusterMetricsLogsService, useValue: { serverMetricsControllerGetClusterMetrics: () => notFound } },
        { provide: ClusterHealthService, useValue: { clusterHealthControllerGetClusterHealth: () => of({}) } },
      ],
    });
    const service = TestBed.inject(ClusterMonitoringService);
    for (let i = 0; i < 5; i++) {
      await (service as any).loadMetrics();
    }
    expect(service.error()).toBeNull();
    expect((service as any).isPollingPaused()).toBe(false);
  });
});
