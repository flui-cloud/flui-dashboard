import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, map, catchError, switchMap } from 'rxjs/operators';
import { AppConfigService } from './app-config.service';
import { LocalAuthService } from './local-auth.service';
import { OidcAuthService } from './oidc-auth.service';
import { AuthService as ApiAuthService } from '../api/api/auth.service';

interface AuthMeResponse {
  userId?: string;
  sub?: string;
  email?: string;
  displayName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  roles?: Record<string, unknown>;
}

export interface UserProfile {
  userId: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  isAdmin: boolean;
  roles: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly cfg = inject(AppConfigService);
  private readonly local = inject(LocalAuthService);
  private readonly oidc = inject(OidcAuthService);
  private readonly apiAuth = inject(ApiAuthService);

  private readonly _isAuthenticated = signal<boolean>(false);
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  private readonly _currentUser = signal<UserProfile | null>(null);
  readonly currentUser = this._currentUser.asReadonly();

  private get isOidc(): boolean {
    return this.cfg.authMode === 'oidc';
  }

  /**
   * Refresh the reactive signal from the underlying auth provider.
   * Call this after login/logout or on app init.
   */
  refreshAuthState(): void {
    this._isAuthenticated.set(this.isUserAuthenticated());
  }

  /**
   * Update the user's display name (local mode only).
   * Reloads the user profile afterward so signals update.
   */
  updateProfile(name: string): Observable<void> {
    return this.apiAuth.authControllerUpdateMe({ name }).pipe(
      map(() => void 0),
      switchMap(() => this.loadCurrentUser()),
    );
  }

  /**
   * Load the current user profile from GET /api/v1/auth/me.
   * Silently clears user on error.
   */
  loadCurrentUser(): Observable<void> {
    return this.apiAuth.authControllerMe().pipe(
      tap((profile: AuthMeResponse) => {
        this._currentUser.set({
          userId: profile.userId ?? profile.sub ?? '',
          email: profile.email ?? '',
          name: profile.displayName ?? profile.name ?? profile.email ?? '',
          firstName: profile.firstName ?? undefined,
          lastName: profile.lastName ?? undefined,
          displayName: profile.displayName ?? undefined,
          isAdmin: profile.isAdmin ?? false,
          roles: profile.roles ?? {},
        });
      }),
      map(() => void 0),
      catchError(() => {
        this._currentUser.set(null);
        return of(void 0);
      }),
    );
  }

  login(email?: string, password?: string): void | Observable<void> {
    if (this.isOidc) {
      this.oidc.login();
      return;
    }
    return this.local.login(email!, password!).pipe(
      tap(() => this._isAuthenticated.set(true)),
    );
  }

  logout(): Observable<void> {
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    if (this.isOidc) {
      this.oidc.logout();
      return of(void 0);
    }
    return this.local.logoutApi();
  }

  getToken(): string | null {
    return this.isOidc ? this.oidc.getToken() : this.local.getToken();
  }

  isUserAuthenticated(): boolean {
    return this.isOidc ? this.oidc.isAuthenticated() : this.local.isAuthenticated();
  }
}
