import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppConfigService } from '../../core/services/app-config.service';
import { InstallationNowService, NOW_REFUSED_MESSAGE } from './installation-now.service';

describe('InstallationNowService', () => {
  let service: InstallationNowService;
  let http: HttpTestingController;
  const url = 'http://api/api/v1/observability/now';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InstallationNowService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: 'http://api' } },
      ],
    });
    service = TestBed.inject(InstallationNowService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the installation now', async () => {
    const pending = service.load();
    expect(service.loading()).toBe(true);
    http.expectOne(url).flush({ measuredAt: 't', nodes: [], edges: [], platform: [], registry: null, sandbox: null, alerts: { firing: 0, critical: 0, names: [] }, thresholds: {} });
    await pending;
    expect(service.loading()).toBe(false);
    expect(service.now()?.measuredAt).toBe('t');
  });

  it('does not start a second read while one is running', async () => {
    const first = service.load();
    void service.load();
    http.expectOne(url).flush({ measuredAt: 't' });
    await first;
    expect(service.now()?.measuredAt).toBe('t');
  });

  it('treats a 403 as a calm refusal', async () => {
    const pending = service.load();
    http.expectOne(url).flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await pending;
    expect(service.refused()).toBe(true);
    expect(service.refusalMessage()).toBe(NOW_REFUSED_MESSAGE);
    expect(service.error()).toBeNull();
  });

  it('keeps the last reading when a refresh fails', async () => {
    const first = service.load();
    http.expectOne(url).flush({ measuredAt: 't1' });
    await first;
    const second = service.load();
    http.expectOne(url).flush({ message: 'Prometheus is down' }, { status: 500, statusText: 'Error' });
    await second;
    expect(service.error()).toBe('Prometheus is down');
    expect(service.now()?.measuredAt).toBe('t1');
  });
});
