import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { LocalAuthService } from '../services/local-auth.service';
import { AppConfigService } from '../services/app-config.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const local = inject(LocalAuthService);
  const cfg = inject(AppConfigService);
  const router = inject(Router);

  // If already authenticated, allow through immediately
  if (auth.isUserAuthenticated()) {
    return true;
  }

  // OIDC: no silent refresh here — redirect to login
  if (cfg.authMode === 'oidc') {
    return router.createUrlTree(['/login']);
  }

  // Local mode: try to refresh the access token silently
  const refreshToken = local.getRefreshToken();
  if (!refreshToken) {
    return router.createUrlTree(['/login']);
  }

  return local.refresh().pipe(
    map(() => {
      auth.refreshAuthState();
      return true as const;
    }),
    catchError((err) => {
      // Only logout if the refresh token is explicitly rejected (401/403).
      // Network errors or 5xx should redirect to login without clearing session.
      const isAuthError =
        err instanceof HttpErrorResponse &&
        (err.status === 401 || err.status === 403);
      if (isAuthError) {
        auth.logout().subscribe();
      }
      return of(router.createUrlTree(['/login']));
    }),
  );
};
