import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiPath, sandboxFenceInterceptor } from './sandbox-fence.interceptor';
import { AppConfigService } from '../services/app-config.service';
import { SandboxService } from '../services/sandbox.service';

describe('sandboxFenceInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let allowed: boolean;

  beforeEach(() => {
    allowed = false;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sandboxFenceInterceptor])),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: 'https://api.example.test' } },
        { provide: SandboxService, useValue: { allows: () => allowed } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('answers a fenced call itself, with the API’s refusal, and sends nothing', () => {
    let status = 0;
    let code = '';
    http.get('https://api.example.test/api/v1/platform/updates').subscribe({
      error: (e) => {
        status = e.status;
        code = e.error.code;
      },
    });
    backend.expectNone('https://api.example.test/api/v1/platform/updates');
    expect(status).toBe(403);
    expect(code).toBe('SANDBOX_ROUTE_FORBIDDEN');
  });

  it('sends what the fence admits', () => {
    allowed = true;
    let body: unknown;
    http.get('https://api.example.test/api/v1/showcase').subscribe((b) => (body = b));
    backend.expectOne('https://api.example.test/api/v1/showcase').flush([]);
    expect(body).toEqual([]);
  });

  it('leaves other hosts alone', () => {
    let body: unknown;
    http.get('https://auth.example.test/.well-known/openid-configuration').subscribe((b) => (body = b));
    backend.expectOne('https://auth.example.test/.well-known/openid-configuration').flush({ issuer: 'x' });
    expect(body).toEqual({ issuer: 'x' });
  });

  it('reads the API path out of the full address', () => {
    expect(apiPath('https://api.example.test/api/v1/applications/a?x=1', 'https://api.example.test/')).toBe(
      '/applications/a?x=1',
    );
    expect(apiPath('https://elsewhere.test/api/v1/a', 'https://api.example.test')).toBeNull();
  });
});
