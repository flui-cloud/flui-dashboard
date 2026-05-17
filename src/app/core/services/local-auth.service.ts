import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { AuthService as ApiAuthService } from '../api/api/auth.service';

@Injectable({
  providedIn: 'root',
})
export class LocalAuthService {
  private readonly TOKEN_KEY = 'flui_access_token';
  private readonly REFRESH_TOKEN_KEY = 'flui_refresh_token';

  private readonly apiAuth = inject(ApiAuthService);

  login(email: string, password: string): Observable<void> {
    return this.apiAuth
      .authControllerLogin({ email, password })
      .pipe(
        tap((r) => {
          localStorage.setItem(this.TOKEN_KEY, r.access_token);
          const resp = r as { access_token: string; refresh_token?: string };
          if (resp.refresh_token) {
            localStorage.setItem(this.REFRESH_TOKEN_KEY, resp.refresh_token);
          }
        }),
        map(() => void 0),
      );
  }

  refresh(): Observable<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }
    return this.apiAuth.authControllerRefresh({ refresh_token: refreshToken }).pipe(
      tap((r) => localStorage.setItem(this.TOKEN_KEY, r.access_token)),
      map((r) => r.access_token),
    );
  }

  logoutApi(): Observable<void> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearTokens();
      return of(void 0);
    }
    return this.apiAuth.authControllerLogout({ refresh_token: refreshToken }).pipe(
      map(() => void 0),
      catchError(() => of(void 0)),
      tap(() => this.clearTokens()),
    );
  }

  logout(): void {
    this.clearTokens();
  }

  private clearTokens(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
}
