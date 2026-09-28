import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '../../core/services/app-config.service';
import { FleetMetrics, FleetService } from './fleet.service';

const METRICS = (window: '1h' | '3h' | '24h'): FleetMetrics => ({
  window,
  step: '1m',
  rangeStart: '2026-09-27T09:00:00.000Z',
  rangeEnd: '2026-09-27T12:00:00.000Z',
  queriedAt: '2026-09-27T12:00:00.000Z',
  fleet: { clustersTotal: 1, clustersReporting: 1, nodesReporting: 1, current: null, series: [] },
  clusters: [],
});

describe('FleetService', () => {
  let service: FleetService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FleetService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: '' } },
      ],
    });
    service = TestBed.inject(FleetService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the fleet metrics for the chosen window', async () => {
    const done = service.setWindow('24h');
    const req = http.expectOne((r) => r.url === '/api/v1/fleet/metrics');
    expect(req.request.params.get('window')).toBe('24h');
    req.flush(METRICS('24h'));
    await done;
    expect(service.metricsState()).toBe('ready');
    expect(service.metrics()?.window).toBe('24h');
  });

  it('treats a refusal as forbidden and stops asking', async () => {
    const first = service.loadMetrics();
    http.expectOne((r) => r.url === '/api/v1/fleet/metrics').flush({}, { status: 403, statusText: 'Forbidden' });
    await first;
    expect(service.metricsState()).toBe('forbidden');

    await service.loadMetrics();
    http.expectNone((r) => r.url === '/api/v1/fleet/metrics');
  });

  it('keeps a failure distinct from a refusal', async () => {
    const done = service.loadCoverage();
    http.expectOne('/api/v1/fleet/backup-protection').flush({}, { status: 500, statusText: 'Server Error' });
    await done;
    expect(service.coverageState()).toBe('error');
    expect(service.coverage()).toBeNull();
  });

  it('marks backup coverage forbidden for a guest', async () => {
    const done = service.loadCoverage();
    http.expectOne('/api/v1/fleet/backup-protection').flush({}, { status: 403, statusText: 'Forbidden' });
    await done;
    expect(service.coverageState()).toBe('forbidden');
  });

  it('reads what needs the person', async () => {
    const done = service.loadNeedsYou();
    expect(service.needsYouState()).toBe('loading');
    http.expectOne('/api/v1/fleet/needs-you').flush({ generatedAt: 'x', count: 0, items: [] });
    await done;
    expect(service.needsYouState()).toBe('ready');
    expect(service.needsYou()?.items).toEqual([]);
  });
});
