import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiPath, sandboxFenceInterceptor } from './sandbox-fence.interceptor';
import { AppConfigService } from '../services/app-config.service';
import { SandboxService } from '../services/sandbox.service';
import { ToastService } from '../../shared/services/toast.service';
import { InstallPromptService } from '../services/install-prompt.service';

describe('sandboxFenceInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let allowed: boolean;
  let signInNeeded: boolean;
  let notices: Array<{ title?: string; message: string; action?: { label: string; onClick: () => void } }>;
  let visitInstallPage: jasmine.Spy;

  beforeEach(() => {
    allowed = false;
    signInNeeded = false;
    notices = [];
    visitInstallPage = jasmine.createSpy('visitInstallPage');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sandboxFenceInterceptor])),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: 'https://api.example.test' } },
        {
          provide: SandboxService,
          useValue: { allows: () => allowed, needsSignIn: () => signInNeeded },
        },
        { provide: InstallPromptService, useValue: { visitInstallPage } },
        { provide: ToastService, useValue: { showInfo: (n: { title?: string; message: string; action?: { label: string; onClick: () => void } }) => notices.push(n) } },
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

  it('keeps a visitor’s write at home and answers it with the read-only notice', () => {
    allowed = true;
    signInNeeded = true;
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(0));
    let status = 0;
    let code = '';
    http.post('https://api.example.test/api/v1/catalog/install', {}).subscribe({
      error: (e) => {
        status = e.status;
        code = e.error.code;
      },
    });
    jasmine.clock().uninstall();
    backend.expectNone('https://api.example.test/api/v1/catalog/install');
    expect(status).toBe(401);
    expect(code).toBe('SANDBOX_SIGN_IN_REQUIRED');
  });

  it('sends what the fence admits', () => {
    allowed = true;
    let body: unknown;
    http.get('https://api.example.test/api/v1/showcase').subscribe((b) => (body = b));
    backend.expectOne('https://api.example.test/api/v1/showcase').flush([]);
    expect(body).toEqual([]);
  });

  it('asks a visitor to sign in once, and passes the refusal on untouched', () => {
    allowed = true;
    const codes: string[] = [];
    for (let i = 0; i < 2; i++) {
      http.post('https://api.example.test/api/v1/sandbox/keep', {}).subscribe({
        error: (e) => codes.push(e.error.code),
      });
      backend
        .expectOne('https://api.example.test/api/v1/sandbox/keep')
        .flush(
          { statusCode: 401, code: 'SANDBOX_SIGN_IN_REQUIRED', message: 'Sign in' },
          { status: 401, statusText: 'Unauthorized' },
        );
    }
    expect(codes).toEqual(['SANDBOX_SIGN_IN_REQUIRED', 'SANDBOX_SIGN_IN_REQUIRED']);
    expect(notices).toHaveSize(1);
    expect(notices[0].title).toBe('This demo is read-only');
    expect(notices[0].action?.label).toBe('Install Flui');
    notices[0].action?.onClick();
    expect(visitInstallPage).toHaveBeenCalled();
  });

  it('says nothing about the read-only demo for any other refusal', () => {
    allowed = true;
    http.post('https://api.example.test/api/v1/applications/a/deploy', {}).subscribe({ error: () => undefined });
    backend
      .expectOne('https://api.example.test/api/v1/applications/a/deploy')
      .flush({ statusCode: 401, message: 'jwt expired' }, { status: 401, statusText: 'Unauthorized' });
    expect(notices).toEqual([]);
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
