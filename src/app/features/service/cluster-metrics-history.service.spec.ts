import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ClusterMetricsHistoryService } from './cluster-metrics-history.service';
import { formatDelta, formatRate } from '../../shared/utils/metric-format';

/**
 * Shaped after a real response from GET /observability/clusters/:id/metrics/history
 * on a one-node cluster: byte rates in the tens of thousands per second, never
 * null, never zero. Kept small enough to read; the medians are what matter.
 */
function history(points: { in: number | null; out: number | null }[]) {
  return {
    cluster_id: 'c1',
    range_start: '2026-09-22T05:00:00.000Z',
    range_end: '2026-09-22T06:00:00.000Z',
    step: '30s',
    queried_at: '2026-09-22T06:00:00.000Z',
    servers: [
      {
        instance: 'node-1',
        server_id: 'node-1',
        data_points: points.map((p, i) => ({
          timestamp: 1_758_000_000 + i * 30,
          datetime: new Date(Date.now() - (points.length - i) * 30_000).toISOString(),
          cpu_percent: 8 + i,
          memory_percent: 49,
          disk_percent: 45,
          network_in: p.in ?? undefined,
          network_out: p.out ?? undefined,
        })),
      },
    ],
  };
}

describe('ClusterMetricsHistoryService', () => {
  let service: ClusterMetricsHistoryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(ClusterMetricsHistoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function load(body: ReturnType<typeof history>) {
    const done = service.load('c1');
    http.expectOne((req) => req.url.includes('/metrics/history')).flush(body);
    return done;
  }

  it('totals inbound and outbound per sample, so the window describes real traffic', async () => {
    await load(
      history([
        { in: 9_360, out: 28_661 },
        { in: 17_265, out: 50_667 },
        { in: 21_880, out: 64_522 },
        { in: 50_894, out: 160_806 },
      ])
    );

    expect(service.averages().network).toEqual([38_021, 67_932, 86_402, 211_700]);
  });

  it('reads a busy reading against a busy window as no real change', async () => {
    await load(
      history([
        { in: 9_360, out: 28_661 },
        { in: 17_265, out: 50_667 },
        { in: 21_880, out: 64_522 },
        { in: 50_894, out: 160_806 },
      ])
    );

    // The live poll says 57 KB/s while the window typically ran at 77 KB/s: that
    // is a fall, not the "+57 KB/s" a zeroed reference used to report.
    const delta = formatDelta(57_344, service.averages().network, formatRate);
    expect(delta.tone).toBe('down');
    expect(delta.text).toBe('−19 KB/s');
  });

  it('leaves a sample with no network reading out of the window instead of calling it zero', async () => {
    await load(
      history([
        { in: null, out: null },
        { in: null, out: null },
        { in: 21_880, out: 64_522 },
        { in: 21_000, out: 64_000 },
        { in: 22_000, out: 65_000 },
      ])
    );

    expect(service.averages().network).toEqual([86_402, 85_000, 87_000]);
    expect(formatDelta(87_000, service.averages().network, formatRate).text).toBe('±0');
  });

  it('names every node while the palette can, and summarises once it cannot', async () => {
    const body = history([{ in: 1, out: 1 }, { in: 2, out: 2 }, { in: 3, out: 3 }]);
    body.servers = Array.from({ length: 5 }, (_, i) => ({
      ...body.servers[0],
      instance: `node-${i}`,
      server_id: `node-${i}`,
    }));
    await load(body);

    expect(service.isSummarised()).toBeTrue();
    expect(service.seriesSubtitle()).toBe('average and busiest of 5 nodes');
    expect(service.cpu()?.series.map((s) => s.name)).toEqual(['Cluster average', 'Busiest node']);
  });

  it('drops another cluster\'s window before asking for this one', async () => {
    await load(history([{ in: 10, out: 10 }, { in: 20, out: 20 }, { in: 30, out: 30 }]));
    expect(service.hasData()).toBeTrue();

    const done = service.load('c2');
    expect(service.hasData()).toBeFalse();
    http.expectOne((req) => req.url.includes('/metrics/history')).flush(history([]));
    await done;
  });
});
