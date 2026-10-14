import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TryComponent } from './try.component';
import { AppConfigService, VisitorEntry } from '../../../../core/services/app-config.service';
import { AuthService } from '../../../../core/services/auth.service';
import { OidcAuthService } from '../../../../core/services/oidc-auth.service';
import { TurnstileService } from './turnstile.service';

const ADMISSION = 'http://api/api/v1/sandbox/visitor/admission';

describe('TryComponent', () => {
  let oidc: jasmine.SpyObj<OidcAuthService>;
  let turnstile: jasmine.SpyObj<TurnstileService>;
  let http: HttpTestingController;
  let router: Router;

  const build = (entry: VisitorEntry, signedIn = false, ended = false) => {
    oidc = jasmine.createSpyObj<OidcAuthService>('OidcAuthService', ['loginAsVisitor', 'login']);
    oidc.loginAsVisitor.and.resolveTo();
    oidc.login.and.resolveTo();
    turnstile = jasmine.createSpyObj<TurnstileService>('TurnstileService', ['token']);
    turnstile.token.and.resolveTo('cf-token');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OidcAuthService, useValue: oidc },
        { provide: TurnstileService, useValue: turnstile },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(ended ? { ended: '1' } : {}) } },
        },
        { provide: AuthService, useValue: { isUserAuthenticated: () => signedIn } },
        {
          provide: AppConfigService,
          useValue: { apiBaseUrl: 'http://api', visitorEntry: () => of(entry) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const fixture = TestBed.createComponent(TryComponent);
    fixture.detectChanges();
    flushMicrotasks();
    return fixture;
  };

  afterEach(() => http.verify());

  it('admits the visitor and signs them in with the nonce', fakeAsync(() => {
    build({ clientId: 'try-web', turnstileSiteKey: null });
    const req = http.expectOne(ADMISSION);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ nonce: 'n-1', expiresInSeconds: 60 });
    flushMicrotasks();
    expect(oidc.loginAsVisitor).toHaveBeenCalledWith('try-web', 'n-1');
  }));

  it('says in one line that the last visit ended while opening a new one', fakeAsync(() => {
    const fixture = build({ clientId: 'try-web', turnstileSiteKey: null }, false, true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Your visit ended. Here is a new one.');
    http.expectOne(ADMISSION).flush({ nonce: 'n-3', expiresInSeconds: 60 });
    flushMicrotasks();
    expect(oidc.loginAsVisitor).toHaveBeenCalledWith('try-web', 'n-3');
  }));

  it('says nothing about an ended visit on a first one', fakeAsync(() => {
    const fixture = build({ clientId: 'try-web', turnstileSiteKey: null });
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Your visit ended');
    http.expectOne(ADMISSION).flush({ nonce: 'n-4', expiresInSeconds: 60 });
    flushMicrotasks();
  }));

  it('passes the challenge token when a site key is set', fakeAsync(() => {
    build({ clientId: 'try-web', turnstileSiteKey: 'site' });
    expect(turnstile.token).toHaveBeenCalledWith('site', jasmine.any(HTMLElement));
    const req = http.expectOne(ADMISSION);
    expect(req.request.body).toEqual({ turnstileToken: 'cf-token' });
    req.flush({ nonce: 'n-2', expiresInSeconds: 60 });
    flushMicrotasks();
    expect(oidc.loginAsVisitor).toHaveBeenCalledWith('try-web', 'n-2');
  }));

  it('falls back to the normal sign-in when visitors are off', fakeAsync(() => {
    build({ clientId: null, turnstileSiteKey: null });
    http.expectNone(ADMISSION);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
    expect(oidc.loginAsVisitor).not.toHaveBeenCalled();
  }));

  it('takes somebody already signed in straight home', fakeAsync(() => {
    build({ clientId: 'try-web', turnstileSiteKey: null }, true);
    http.expectNone(ADMISSION);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/', { replaceUrl: true });
  }));

  it('sends a refused visitor to the sign-in page with the reason', fakeAsync(() => {
    build({ clientId: 'try-web', turnstileSiteKey: null });
    http
      .expectOne(ADMISSION)
      .flush({ code: 'SANDBOX_VISITORS_LIMIT' }, { status: 429, statusText: 'Too Many Requests' });
    flushMicrotasks();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { visitor: 'refused', reason: 'limit' },
      replaceUrl: true,
    });
    expect(oidc.loginAsVisitor).not.toHaveBeenCalled();
  }));

  it('reports an unexpected failure as an error', fakeAsync(() => {
    build({ clientId: 'try-web', turnstileSiteKey: null });
    http.expectOne(ADMISSION).flush({}, { status: 500, statusText: 'Server Error' });
    flushMicrotasks();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { visitor: 'refused', reason: 'error' },
      replaceUrl: true,
    });
  }));
});
