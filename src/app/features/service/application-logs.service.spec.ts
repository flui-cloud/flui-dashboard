import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AppConfigService } from '../../core/services/app-config.service';
import { ApplicationLogsService } from './application-logs.service';

describe('ApplicationLogsService', () => {
  let service: ApplicationLogsService;
  let http: HttpTestingController;
  const config = { apiBaseUrl: '' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApplicationLogsService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: config },
      ],
    });
    service = TestBed.inject(ApplicationLogsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the runtime base URL and sends only app-scoped log filters', () => {
    config.apiBaseUrl = 'https://runtime.example';
    service.init({ appId: 'app/one' });

    const volume = http.expectOne(
      (req) =>
        req.url ===
        'https://runtime.example/api/v1/observability/applications/app%2Fone/logs/volume',
    );
    expect(volume.request.params.has('namespace')).toBeFalse();
    expect(volume.request.params.has('container')).toBeFalse();
    volume.flush({ series: [] });

    const logs = http.expectOne(
      (req) =>
        req.url ===
        'https://runtime.example/api/v1/observability/applications/app%2Fone/logs',
    );
    expect(logs.request.params.has('namespace')).toBeFalse();
    expect(logs.request.params.has('app')).toBeFalse();
    expect(logs.request.params.has('container')).toBeFalse();
    logs.flush({ logs: [], queried_at: null });
  });
});
