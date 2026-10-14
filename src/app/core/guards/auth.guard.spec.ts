import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthService } from '../services/auth.service';
import { LocalAuthService } from '../services/local-auth.service';
import { OidcAuthService } from '../services/oidc-auth.service';
import { AppConfigService } from '../services/app-config.service';
import { SandboxService } from '../services/sandbox.service';
import { AuthService as ApiAuthService } from '../api/api/auth.service';

const API = 'https://api.example.test';

describe('a page reload after the visit ended', () => {
  let backend: HttpTestingController;
  let signedIn: boolean;
  let oidc: jasmine.SpyObj<OidcAuthService>;
  let sandbox: jasmine.SpyObj<SandboxService>;

  beforeEach(() => {
    signedIn = true;
    oidc = jasmine.createSpyObj<OidcAuthService>('OidcAuthService', [
      'isAuthenticated',
      'getToken',
      'hasRefreshToken',
      'renewToken',
      'redirectToLogin',
      'dropVisit',
      'login',
    ]);
    oidc.isAuthenticated.and.callFake(() => signedIn);
    oidc.getToken.and.callFake(() => (signedIn ? 'visitor-token' : null));
    oidc.dropVisit.and.callFake(async () => {
      signedIn = false;
    });
    oidc.login.and.resolveTo();
    sandbox = jasmine.createSpyObj<SandboxService>('SandboxService', ['forget']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { authMode: 'oidc', apiBaseUrl: API } },
        { provide: LocalAuthService, useValue: {} },
        { provide: OidcAuthService, useValue: oidc },
        { provide: SandboxService, useValue: sandbox },
        {
          provide: ApiAuthService,
          useFactory: (http: HttpClient) => ({ authControllerMe: () => http.get(`${API}/api/v1/auth/me`) }),
          deps: [HttpClient],
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** What the app initializer does on a reload, then the guard of the page being reloaded. */
  const reload = (code: string): string => {
    const auth = TestBed.inject(AuthService);
    auth.loadCurrentUser().subscribe();
    backend
      .expectOne(`${API}/api/v1/auth/me`)
      .flush({ statusCode: 401, code, message: 'over' }, { status: 401, statusText: 'Unauthorized' });
    flushMicrotasks();
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot),
    );
    expect(result).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  };

  it('opens a new visit instead of the normal sign-in, and forgets the old one', fakeAsync(() => {
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    expect(reload('VISITOR_GONE')).toBe('/try?ended=1');
    expect(oidc.dropVisit).toHaveBeenCalledTimes(1);
    expect(sandbox.forget).toHaveBeenCalledTimes(1);
    expect(oidc.renewToken).not.toHaveBeenCalled();
    expect(oidc.login).not.toHaveBeenCalled();
  }));

  it('signs in normally when the visit became an account', fakeAsync(() => {
    expect(reload('VISITOR_MERGED')).toBe('/login?redirect=%2Fdashboard');
    expect(oidc.login).toHaveBeenCalledTimes(1);
  }));

  it('still sends anybody else to the sign-in page', () => {
    signedIn = false;
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot),
    );
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login?redirect=%2Fdashboard');
  });
});
