import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthConfig, OAuthService } from 'angular-oauth2-oidc';
import { OIDC_CLIENT_KEY, OidcAuthService } from './oidc-auth.service';
import { AppConfigService } from './app-config.service';

describe('OidcAuthService and its two clients', () => {
  let oauth: jasmine.SpyObj<OAuthService>;
  let service: OidcAuthService;

  const lastConfig = (): AuthConfig => oauth.configure.calls.mostRecent().args[0];

  beforeEach(() => {
    sessionStorage.removeItem(OIDC_CLIENT_KEY);
    oauth = jasmine.createSpyObj<OAuthService>('OAuthService', [
      'configure',
      'loadDiscoveryDocument',
      'loadDiscoveryDocumentAndTryLogin',
      'initCodeFlow',
      'logOut',
    ]);
    oauth.loadDiscoveryDocument.and.resolveTo({} as never);
    oauth.loadDiscoveryDocumentAndTryLogin.and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OAuthService, useValue: oauth },
        {
          provide: AppConfigService,
          useValue: { get: () => ({ oidcIssuer: 'https://id.test', oidcClientId: 'web' }) },
        },
      ],
    });
    service = TestBed.inject(OidcAuthService);
  });

  afterEach(() => sessionStorage.removeItem(OIDC_CLIENT_KEY));

  it('starts a visitor flow with the visitor client and the admission nonce', async () => {
    await service.loginAsVisitor('try-web', 'nonce-1');

    expect(lastConfig().clientId).toBe('try-web');
    expect(lastConfig().scope).toContain('offline_access');
    expect(oauth.loadDiscoveryDocument).toHaveBeenCalled();
    expect(oauth.initCodeFlow).toHaveBeenCalledWith(undefined, { login_hint: 'nonce-1' });
    expect(service.isVisitorSession()).toBeTrue();
  });

  it('remembers the visitor client for the callback after the redirect', async () => {
    await service.loginAsVisitor('try-web', 'nonce-1');
    oauth.configure.calls.reset();

    await TestBed.runInInjectionContext(() => new OidcAuthService()).init();

    expect(lastConfig().clientId).toBe('try-web');
    expect(oauth.loadDiscoveryDocumentAndTryLogin).toHaveBeenCalled();
  });

  it('drops the visitor session and goes back to the normal client on sign-in', async () => {
    await service.loginAsVisitor('try-web', 'nonce-1');
    oauth.initCodeFlow.calls.reset();

    await service.login();

    expect(oauth.logOut.calls.mostRecent().args[0] as unknown).toBe(true);
    expect(lastConfig().clientId).toBe('web');
    expect(lastConfig().scope).not.toContain('offline_access');
    expect(oauth.initCodeFlow).toHaveBeenCalledWith(undefined, undefined);
    expect(service.isVisitorSession()).toBeFalse();
  });

  it('signs a member in without reloading what is already configured', async () => {
    service.configure();
    oauth.configure.calls.reset();

    await service.login();

    expect(oauth.logOut).not.toHaveBeenCalled();
    expect(oauth.configure).not.toHaveBeenCalled();
    expect(oauth.initCodeFlow).toHaveBeenCalled();
  });

  it('forgets an ended visit, its cookie included, and is ready for the normal client', async () => {
    await service.loginAsVisitor('try-web', 'nonce-1');
    oauth.loadDiscoveryDocument.calls.reset();

    await service.dropVisit();

    expect(oauth.logOut.calls.mostRecent().args[0] as unknown).toBe(true);
    TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/oidc-logout').flush({ success: true });
    expect(service.isVisitorSession()).toBeFalse();
    expect(lastConfig().clientId).toBe('web');
    expect(oauth.loadDiscoveryDocument).toHaveBeenCalled();

    oauth.initCodeFlow.calls.reset();
    await service.login();
    expect(oauth.initCodeFlow).toHaveBeenCalledWith(undefined, undefined);
  });
});
