import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { Observable, from, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppConfigService } from './app-config.service';

/** Which client started the flow, so the callback, refresh and logout use the same one. */
export const OIDC_CLIENT_KEY = 'flui:oidc-client';

const MEMBER_SCOPE = 'openid profile email';
const VISITOR_SCOPE = 'openid profile email offline_access';

function rememberedVisitorClient(): string | null {
  try {
    const raw = sessionStorage.getItem(OIDC_CLIENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as { visitorClientId?: unknown }) : null;
    return typeof parsed?.visitorClientId === 'string' ? parsed.visitorClientId : null;
  } catch {
    return null;
  }
}

function rememberVisitorClient(clientId: string | null): void {
  try {
    if (clientId) sessionStorage.setItem(OIDC_CLIENT_KEY, JSON.stringify({ visitorClientId: clientId }));
    else sessionStorage.removeItem(OIDC_CLIENT_KEY);
  } catch {
    // Without storage the callback falls back to the normal client.
  }
}

@Injectable({
  providedIn: 'root',
})
export class OidcAuthService {
  private readonly oauthService = inject(OAuthService);
  private readonly cfg = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  configure(): void {
    const config = this.cfg.get();
    const visitorClientId = rememberedVisitorClient();
    const authConfig: AuthConfig = {
      issuer: config.oidcIssuer,
      clientId: visitorClientId ?? config.oidcClientId,
      redirectUri: globalThis.window.location.origin + '/auth/callback',
      postLogoutRedirectUri: globalThis.window.location.origin + '/login?loggedOut=true',
      responseType: 'code',
      scope: visitorClientId ? VISITOR_SCOPE : MEMBER_SCOPE,
      useSilentRefresh: false,
    };
    this.oauthService.configure(authConfig);
  }

  async init(): Promise<void> {
    this.configure();
    await this.oauthService.loadDiscoveryDocumentAndTryLogin();
  }

  isVisitorSession(): boolean {
    return rememberedVisitorClient() !== null;
  }

  /** Always signs in with the normal client, dropping a visitor's session first. */
  async login(): Promise<void> {
    if (this.isVisitorSession()) {
      this.oauthService.logOut(true);
    }
    await this.startFlow(null);
  }

  async loginAsVisitor(visitorClientId: string, nonce: string): Promise<void> {
    await this.startFlow(visitorClientId, { login_hint: nonce });
  }

  private async startFlow(visitorClientId: string | null, params?: Record<string, string>): Promise<void> {
    const switching = visitorClientId !== rememberedVisitorClient();
    rememberVisitorClient(visitorClientId);
    if (switching) {
      // configure() clears the endpoints the discovery document filled in.
      this.configure();
      await this.oauthService.loadDiscoveryDocument();
    }
    this.oauthService.initCodeFlow(undefined, params);
  }

  /** Forgets an ended visit here, so neither its tokens nor its cookie are sent again. */
  async dropVisit(): Promise<void> {
    rememberVisitorClient(null);
    this.oauthService.logOut(true);
    this.http.post('/api/v1/auth/oidc-logout', {}).subscribe({ error: () => undefined });
    this.configure();
    await this.oauthService.loadDiscoveryDocument();
  }

  logout(): void {
    rememberVisitorClient(null);
    this.http.post('/api/v1/auth/oidc-logout', {}).subscribe({
      complete: () => this.oauthService.logOut(),
      error: () => this.oauthService.logOut(),
    });
  }

  getToken(): string | null {
    return this.oauthService.getAccessToken() || null;
  }

  isAuthenticated(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  hasRefreshToken(): boolean {
    return !!this.oauthService.getRefreshToken();
  }

  renewToken(): Observable<string> {
    if (!this.hasRefreshToken()) {
      return throwError(() => new Error('No refresh token available'));
    }
    return from(this.oauthService.refreshToken()).pipe(
      map(() => this.oauthService.getAccessToken()),
    );
  }

  redirectToLogin(): void {
    void this.login();
  }
}
