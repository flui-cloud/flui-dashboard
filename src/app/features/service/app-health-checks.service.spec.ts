import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppConfigService } from '../../core/services/app-config.service';
import { AppHealthChecksService, HEALTH_CHECKS_REFRESH_MS } from './app-health-checks.service';

describe('AppHealthChecksService', () => {
  let service: AppHealthChecksService;
  let http: HttpTestingController;
  const url = 'http://api/api/v1/observability/applications/app-1/health-checks';
  const body = { app_id: 'app-1', readiness: 2, liveness: 0, startup: 0, restarts_by_liveness: 0, last_failure_at: null, read: true };

  beforeEach(() => {
    jasmine.clock().install();
    TestBed.configureTestingModule({
      providers: [
        AppHealthChecksService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: 'http://api' } },
      ],
    });
    service = TestBed.inject(AppHealthChecksService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stop();
    jasmine.clock().uninstall();
    http.verify();
  });

  it('reads on start and again every 30 seconds, not every 5', async () => {
    spyOnProperty(document, 'hidden').and.returnValue(false);
    service.start('app-1');
    http.expectOne(url).flush(body);
    await Promise.resolve();
    expect(service.checks()?.readiness).toBe(2);

    jasmine.clock().tick(5_000);
    http.expectNone(url);
    jasmine.clock().tick(HEALTH_CHECKS_REFRESH_MS - 5_000);
    http.expectOne(url).flush(body);
  });

  it('stops asking once stopped', () => {
    service.start('app-1');
    http.expectOne(url).flush(body);
    service.stop();
    jasmine.clock().tick(HEALTH_CHECKS_REFRESH_MS * 2);
    expect(() => http.expectNone(url)).not.toThrow();
  });

  it('forgets the reading when the endpoint fails, so nothing shows a stale zero', async () => {
    service.start('app-1');
    http.expectOne(url).flush(body);
    await Promise.resolve();
    const pending = service.load();
    http.expectOne(url).flush({}, { status: 500, statusText: 'Error' });
    await pending;
    expect(service.checks()).toBeNull();
  });
});
