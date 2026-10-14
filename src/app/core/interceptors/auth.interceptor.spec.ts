import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { LocalAuthService } from '../services/local-auth.service';
import { OidcAuthService } from '../services/oidc-auth.service';
import { AppConfigService } from '../services/app-config.service';
import { SandboxService } from '../services/sandbox.service';

describe('authInterceptor and a visitor asked to sign in', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let renewed: number;
  let sentToLogin: number;

  beforeEach(() => {
    renewed = 0;
    sentToLogin = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { authMode: 'oidc', apiBaseUrl: 'https://api.example.test' } },
        { provide: AuthService, useValue: { getToken: () => 'token' } },
        { provide: LocalAuthService, useValue: {} },
        {
          provide: OidcAuthService,
          useValue: {
            hasRefreshToken: () => true,
            renewToken: () => {
              renewed++;
              return of('fresh');
            },
            redirectToLogin: () => sentToLogin++,
          },
        },
        { provide: Router, useValue: { navigate: () => undefined } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('keeps the session and hands the refusal back as it came', () => {
    let code = '';
    http.post('https://api.example.test/api/v1/sandbox/keep', {}).subscribe({
      error: (e) => (code = e.error.code),
    });
    backend
      .expectOne('https://api.example.test/api/v1/sandbox/keep')
      .flush(
        { statusCode: 401, code: 'SANDBOX_SIGN_IN_REQUIRED', message: 'Sign in' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(code).toBe('SANDBOX_SIGN_IN_REQUIRED');
    expect(renewed).toBe(0);
    expect(sentToLogin).toBe(0);
  });

  it('still renews the token on any other 401', () => {
    http.get('https://api.example.test/api/v1/auth/me').subscribe({ error: () => undefined });
    backend
      .expectOne('https://api.example.test/api/v1/auth/me')
      .flush({ statusCode: 401, message: 'jwt expired' }, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('https://api.example.test/api/v1/auth/me').flush({ ok: true });

    expect(renewed).toBe(1);
  });
});

describe('authInterceptor when a visit is over', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let oidc: jasmine.SpyObj<OidcAuthService>;
  let router: jasmine.SpyObj<Router>;
  let sandbox: jasmine.SpyObj<SandboxService>;

  beforeEach(() => {
    oidc = jasmine.createSpyObj<OidcAuthService>('OidcAuthService', [
      'hasRefreshToken',
      'renewToken',
      'redirectToLogin',
      'dropVisit',
      'login',
    ]);
    oidc.hasRefreshToken.and.returnValue(true);
    oidc.renewToken.and.returnValue(of('fresh'));
    oidc.dropVisit.and.resolveTo();
    oidc.login.and.resolveTo();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    sandbox = jasmine.createSpyObj<SandboxService>('SandboxService', ['forget']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { authMode: 'oidc', apiBaseUrl: 'https://api.example.test' } },
        { provide: AuthService, useValue: { getToken: () => 'token' } },
        { provide: LocalAuthService, useValue: {} },
        { provide: OidcAuthService, useValue: oidc },
        { provide: Router, useValue: router },
        { provide: SandboxService, useValue: sandbox },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const refuse = (code: string) => {
    let seen = '';
    http.get('https://api.example.test/api/v1/applications').subscribe({ error: (e) => (seen = e.error.code) });
    backend
      .expectOne('https://api.example.test/api/v1/applications')
      .flush({ statusCode: 401, code, message: 'over' }, { status: 401, statusText: 'Unauthorized' });
    return seen;
  };

  it('starts a new visit when the old one ended, without renewing or the normal sign-in', fakeAsync(() => {
    expect(refuse('VISITOR_GONE')).toBe('VISITOR_GONE');
    flushMicrotasks();
    expect(oidc.dropVisit).toHaveBeenCalledTimes(1);
    expect(sandbox.forget).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/try'], { queryParams: { ended: '1' }, replaceUrl: true });
    expect(oidc.renewToken).not.toHaveBeenCalled();
    expect(oidc.redirectToLogin).not.toHaveBeenCalled();
    expect(oidc.login).not.toHaveBeenCalled();
  }));

  it('signs in normally when the visit became an account', fakeAsync(() => {
    expect(refuse('VISITOR_MERGED')).toBe('VISITOR_MERGED');
    flushMicrotasks();
    expect(oidc.dropVisit).toHaveBeenCalledTimes(1);
    expect(sandbox.forget).toHaveBeenCalledTimes(1);
    expect(oidc.login).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(oidc.renewToken).not.toHaveBeenCalled();
  }));

  it('ends the visit once even when several calls are refused together', fakeAsync(() => {
    refuse('VISITOR_GONE');
    refuse('VISITOR_GONE');
    flushMicrotasks();
    expect(oidc.dropVisit).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledTimes(1);
  }));
});
