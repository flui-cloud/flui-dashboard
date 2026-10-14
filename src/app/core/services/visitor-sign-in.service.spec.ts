import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import {
  LINK_FAILED,
  LINK_KEY,
  PAGE_NAVIGATOR,
  RESUME_KEY,
  SIGN_IN_FAILED,
  VisitorSignInService,
} from './visitor-sign-in.service';
import { OidcAuthService } from './oidc-auth.service';
import { SandboxService } from './sandbox.service';
import { AuthService } from './auth.service';
import { AppConfigService } from './app-config.service';
import { ToastService } from '../../shared/services/toast.service';

const API = 'http://api/api/v1/sandbox/visitor';

describe('VisitorSignInService', () => {
  let http: HttpTestingController;
  let router: Router;
  let navigateByUrl: jasmine.Spy;
  let leave: jasmine.Spy;
  let oidc: jasmine.SpyObj<OidcAuthService>;
  let auth: jasmine.SpyObj<AuthService>;
  let toast: jasmine.SpyObj<ToastService>;
  let forget: jasmine.Spy;
  let probe: jasmine.Spy;

  const build = (opts: { visitor?: boolean; url?: string; visitorSession?: boolean; signedIn?: boolean } = {}) => {
    leave = jasmine.createSpy('leave');
    oidc = jasmine.createSpyObj<OidcAuthService>('OidcAuthService', ['login', 'renewToken', 'isVisitorSession']);
    oidc.login.and.resolveTo();
    oidc.renewToken.and.returnValue(of('t'));
    oidc.isVisitorSession.and.returnValue(opts.visitorSession ?? false);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['refreshAuthState', 'loadCurrentUser', 'isUserAuthenticated']);
    auth.loadCurrentUser.and.returnValue(of(void 0));
    auth.isUserAuthenticated.and.returnValue(opts.signedIn ?? true);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['showError', 'showSuccess']);
    forget = jasmine.createSpy('forget');
    probe = jasmine.createSpy('probe').and.returnValue(of(true));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PAGE_NAVIGATOR, useValue: leave },
        { provide: OidcAuthService, useValue: oidc },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        { provide: AppConfigService, useValue: { apiBaseUrl: 'http://api' } },
        { provide: SandboxService, useValue: { visitor: signal(opts.visitor ?? true), forget, probe } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue(opts.url ?? '/applications');
    navigateByUrl = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    return TestBed.inject(VisitorSignInService);
  };

  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  const navigatedTo = () => navigateByUrl.calls.allArgs().map(([u]) => router.serializeUrl(typeof u === 'string' ? router.parseUrl(u) : u));

  it('opens the dialog for a visitor and remembers where they were going', fakeAsync(() => {
    const gate = build();
    expect(gate.requireSignIn('/apps/deploy/new')).toBeTrue();
    expect(gate.dialogOpen()).toBeTrue();
    expect(oidc.login).not.toHaveBeenCalled();

    void gate.withProvider('github');
    const req = http.expectOne(`${API}/upgrade/idp`);
    expect(req.request.body).toEqual({ provider: 'github', returnTo: '/apps/deploy/new' });
    req.flush({ authUrl: 'https://github.example/authorize' });
    flushMicrotasks();

    expect(leave).toHaveBeenCalledWith('https://github.example/authorize');
    expect(sessionStorage.getItem(RESUME_KEY)).toBe('/apps/deploy/new');
  }));

  it('lets anybody else carry on', () => {
    const gate = build({ visitor: false });
    expect(gate.requireSignIn()).toBeFalse();
    expect(gate.dialogOpen()).toBeFalse();
  });

  it('defaults the way back to the current page', fakeAsync(() => {
    const gate = build({ url: '/catalog/x' });
    gate.signIn();
    void gate.withProvider('google');
    const req = http.expectOne(`${API}/upgrade/idp`);
    expect(req.request.body.returnTo).toBe('/catalog/x');
    req.flush({ authUrl: 'https://accounts.example' });
    flushMicrotasks();
  }));

  it('falls back to email when the providers cannot be listed', fakeAsync(() => {
    const gate = build();
    let answer: unknown;
    void gate.providers().then((a) => (answer = a));
    http.expectOne(`${API}/upgrade/providers`).flush('no', { status: 500, statusText: 'x' });
    flushMicrotasks();
    expect(answer).toEqual({ providers: [], email: true });
  }));

  it('finishes an upgrade in place and resumes', fakeAsync(() => {
    sessionStorage.setItem(RESUME_KEY, '/apps/deploy/new');
    const gate = build({ url: '/applications?visitor=finish&flow=f-1', visitorSession: true });
    void gate.handleReturn();
    flushMicrotasks();
    expect(navigatedTo()[0]).toBe('/applications');
    const req = http.expectOne(`${API}/upgrade/finish`);
    expect(req.request.body).toEqual({ flow: 'f-1' });
    req.flush({ outcome: 'upgraded', reason: null, returnTo: '/applications', linkNonce: null });
    flushMicrotasks();

    expect(oidc.renewToken).toHaveBeenCalled();
    expect(auth.refreshAuthState).toHaveBeenCalled();
    expect(probe).toHaveBeenCalled();
    expect(toast.showSuccess).toHaveBeenCalled();
    expect(navigatedTo()).toContain('/apps/deploy/new');
    expect(sessionStorage.getItem(RESUME_KEY)).toBeNull();
  }));

  it('still finishes when the token cannot be renewed', fakeAsync(() => {
    const gate = build({ url: '/?visitor=finish&flow=f-1', visitorSession: true });
    oidc.renewToken.and.returnValue(throwError(() => new Error('no')));
    void gate.handleReturn();
    flushMicrotasks();
    http.expectOne(`${API}/upgrade/finish`).flush({ outcome: 'upgraded', reason: null, returnTo: null, linkNonce: null });
    flushMicrotasks();
    expect(toast.showSuccess).toHaveBeenCalled();
  }));

  it('signs in as the existing account, keeping the link nonce', fakeAsync(() => {
    const gate = build({ url: '/?visitor=finish&flow=f-1', visitorSession: true });
    void gate.handleReturn();
    flushMicrotasks();
    http.expectOne(`${API}/upgrade/finish`).flush({
      outcome: 'signin-as-existing', reason: null, returnTo: '/apps/deploy/new', linkNonce: 'n-1',
    });
    flushMicrotasks();
    expect(JSON.parse(sessionStorage.getItem(LINK_KEY)!)).toEqual({ nonce: 'n-1' });
    expect(sessionStorage.getItem(RESUME_KEY)).toBe('/apps/deploy/new');
    expect(forget).toHaveBeenCalled();
    expect(oidc.login).toHaveBeenCalled();
  }));

  it('signs in as the existing account without a nonce', fakeAsync(() => {
    const gate = build({ url: '/?visitor=finish&flow=f-1', visitorSession: true });
    void gate.handleReturn();
    flushMicrotasks();
    http.expectOne(`${API}/upgrade/finish`).flush({ outcome: 'signin-as-existing', reason: null, returnTo: null, linkNonce: null });
    flushMicrotasks();
    expect(sessionStorage.getItem(LINK_KEY)).toBeNull();
    expect(oidc.login).toHaveBeenCalled();
  }));

  it('says so when the upgrade is refused', fakeAsync(() => {
    const gate = build({ url: '/?visitor=finish&flow=f-1', visitorSession: true });
    void gate.handleReturn();
    flushMicrotasks();
    http.expectOne(`${API}/upgrade/finish`).flush({ outcome: 'refused', reason: 'failed', returnTo: null, linkNonce: null });
    flushMicrotasks();
    expect(toast.showError).toHaveBeenCalledWith(SIGN_IN_FAILED);
    expect(oidc.login).not.toHaveBeenCalled();
  }));

  it('says so when the flow has expired or was used', fakeAsync(() => {
    const gate = build({ url: '/?visitor=finish&flow=f-1', visitorSession: true });
    void gate.handleReturn();
    flushMicrotasks();
    http.expectOne(`${API}/upgrade/finish`).flush({}, { status: 410, statusText: 'Gone' });
    flushMicrotasks();
    expect(toast.showError).toHaveBeenCalledWith(SIGN_IN_FAILED);
  }));

  it('reports a sign-in the provider did not finish', fakeAsync(() => {
    sessionStorage.setItem(RESUME_KEY, '/apps/deploy/new');
    const gate = build({ url: '/applications?visitor=upgrade-failed', visitorSession: true });
    void gate.handleReturn();
    flushMicrotasks();
    expect(navigatedTo()[0]).toBe('/applications');
    expect(toast.showError).toHaveBeenCalledWith(SIGN_IN_FAILED);
    expect(sessionStorage.getItem(RESUME_KEY)).toBeNull();
  }));

  it('starts the email path with a link nonce and the normal sign-in', fakeAsync(() => {
    const gate = build();
    gate.requireSignIn('/apps/deploy/new');
    void gate.withEmail();
    http.expectOne(`${API}/link-intent`).flush({ nonce: 'n-2', expiresAt: '2026-10-13T10:00:00Z' });
    flushMicrotasks();
    expect(JSON.parse(sessionStorage.getItem(LINK_KEY)!)).toEqual({ nonce: 'n-2' });
    expect(sessionStorage.getItem(RESUME_KEY)).toBe('/apps/deploy/new');
    expect(forget).toHaveBeenCalled();
    expect(oidc.login).toHaveBeenCalled();
  }));

  it('links the visit after sign-in and resumes', fakeAsync(() => {
    sessionStorage.setItem(LINK_KEY, JSON.stringify({ nonce: 'n-2' }));
    sessionStorage.setItem(RESUME_KEY, '/apps/deploy/new');
    const gate = build({ visitor: false });
    void gate.handleReturn();
    const req = http.expectOne(`${API}/link`);
    expect(req.request.body).toEqual({ nonce: 'n-2' });
    expect(sessionStorage.getItem(LINK_KEY)).toBeNull();
    req.flush({ outcome: 'linked', returnTo: null });
    flushMicrotasks();
    expect(toast.showSuccess).toHaveBeenCalledWith('Your visit is now part of your account.');
    expect(navigatedTo()).toEqual(['/apps/deploy/new']);
  }));

  it('clears the nonce when the link is refused', fakeAsync(() => {
    sessionStorage.setItem(LINK_KEY, JSON.stringify({ nonce: 'n-2' }));
    sessionStorage.setItem(RESUME_KEY, '/apps/deploy/new');
    const gate = build({ visitor: false });
    void gate.handleReturn();
    http.expectOne(`${API}/link`).flush({}, { status: 409, statusText: 'Conflict' });
    flushMicrotasks();
    expect(sessionStorage.getItem(LINK_KEY)).toBeNull();
    expect(sessionStorage.getItem(RESUME_KEY)).toBeNull();
    expect(toast.showError).toHaveBeenCalledWith(LINK_FAILED);
    expect(navigateByUrl).not.toHaveBeenCalled();
  }));

  it('handles the return only once per page load', fakeAsync(() => {
    sessionStorage.setItem(LINK_KEY, JSON.stringify({ nonce: 'n-2' }));
    const gate = build({ visitor: false });
    void gate.handleReturn();
    void gate.handleReturn();
    http.expectOne(`${API}/link`).flush({ outcome: 'linked', returnTo: null });
    flushMicrotasks();
    expect(toast.showSuccess).toHaveBeenCalledTimes(1);
  }));

  for (const unsafe of ['//evil.example/x', 'https://evil.example/x', '/\\evil.example']) {
    it(`never resumes to ${unsafe}`, fakeAsync(() => {
      sessionStorage.setItem(RESUME_KEY, unsafe);
      const gate = build({ visitor: false });
      void gate.resume();
      flushMicrotasks();
      expect(navigateByUrl).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(RESUME_KEY)).toBeNull();
    }));
  }
});
