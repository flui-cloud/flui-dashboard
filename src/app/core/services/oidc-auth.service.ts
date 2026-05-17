import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { Observable, from, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppConfigService } from './app-config.service';

@Injectable({
  providedIn: 'root',
})
export class OidcAuthService {
  private readonly oauthService = inject(OAuthService);
  private readonly cfg = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  configure(): void {
    const config = this.cfg.get();
    const authConfig: AuthConfig = {
      issuer: config.oidcIssuer,
      clientId: config.oidcClientId,
      redirectUri: globalThis.window.location.origin + '/auth/callback',
      postLogoutRedirectUri: globalThis.window.location.origin + '/login?loggedOut=true',
      responseType: 'code',
      scope: 'openid profile email',
      useSilentRefresh: false,
    };
    this.oauthService.configure(authConfig);
  }

  async init(): Promise<void> {
    this.configure();
    await this.oauthService.loadDiscoveryDocumentAndTryLogin();
  }

  login(): void {
    this.oauthService.initCodeFlow();
  }

  logout(): void {
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
    this.oauthService.initCodeFlow();
  }
}
