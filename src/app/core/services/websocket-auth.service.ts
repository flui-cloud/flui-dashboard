import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Socket } from 'socket.io-client';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { LocalAuthService } from './local-auth.service';
import { OidcAuthService } from './oidc-auth.service';
import { AppConfigService } from './app-config.service';

const AUTH_ERROR_MARKERS = [
  'missing authentication token',
  'invalid local jwt',
  'invalid oidc jwt',
  'invalid or revoked api key',
  'user not provisioned',
  'unauth',
  'jwt expired',
];

const NOT_PROVISIONED_MARKER = 'user not provisioned';

@Injectable({ providedIn: 'root' })
export class WebSocketAuthService {
  private readonly auth = inject(AuthService);
  private readonly local = inject(LocalAuthService);
  private readonly oidc = inject(OidcAuthService);
  private readonly cfg = inject(AppConfigService);
  private readonly router = inject(Router);

  private refreshInFlight: Promise<string | null> | null = null;

  getToken(): string | null {
    return this.auth.getToken();
  }

  /**
   * Build socket.io options carrying the current JWT in `auth.token`.
   * Returns the same shape so callers can spread additional options.
   */
  authOptions(): { auth: { token: string } } {
    return { auth: { token: this.getToken() ?? '' } };
  }

  /**
   * Wire `connect_error` handling on a socket: refresh the token on auth
   * failures and reconnect, or redirect to login when refresh is impossible.
   * Returns a teardown function for tests; not strictly required at runtime.
   */
  attach(socket: Socket): () => void {
    const handler = async (err: Error) => {
      const message = (err?.message ?? '').toLowerCase();
      if (!AUTH_ERROR_MARKERS.some((m) => message.includes(m))) return;

      if (message.includes(NOT_PROVISIONED_MARKER)) {
        this.redirectToLogin();
        return;
      }

      const newToken = await this.refreshToken();
      if (!newToken) {
        this.redirectToLogin();
        return;
      }
      socket.auth = { token: newToken };
      if (!socket.connected) socket.connect();
    };

    socket.on('connect_error', handler);
    return () => socket.off('connect_error', handler);
  }

  private async refreshToken(): Promise<string | null> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.doRefresh().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async doRefresh(): Promise<string | null> {
    try {
      if (this.cfg.authMode === 'oidc') {
        if (!this.oidc.hasRefreshToken()) return null;
        return await firstValueFrom(this.oidc.renewToken());
      }
      if (!this.local.getRefreshToken()) return null;
      return await firstValueFrom(this.local.refresh());
    } catch {
      return null;
    }
  }

  private redirectToLogin(): void {
    if (this.cfg.authMode === 'oidc') {
      this.oidc.redirectToLogin();
      return;
    }
    this.auth.logout().subscribe();
    this.router.navigate(['/login']);
  }
}
