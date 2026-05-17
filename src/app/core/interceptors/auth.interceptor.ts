import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, EMPTY, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { LocalAuthService } from '../services/local-auth.service';
import { OidcAuthService } from '../services/oidc-auth.service';
import { AppConfigService } from '../services/app-config.service';

// Module-level singletons: shared across all concurrent interceptor invocations
let isRefreshing = false;
const accessTokenRefreshed$ = new BehaviorSubject<string | null>(null);
let isOidcRenewing = false;
const oidcTokenRenewed$ = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const local = inject(LocalAuthService);
  const oidc = inject(OidcAuthService);
  const cfg = inject(AppConfigService);
  const router = inject(Router);

  if (cfg.authMode === 'oidc') {
    const token = auth.getToken();
    const outReq = token ? withBearer(req, token) : req;
    return next(outReq).pipe(
      catchError((err: unknown) => {
        if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
          return throwError(() => err);
        }
        return tryOidcRenew(req, next, oidc);
      }),
    );
  }

  const token = auth.getToken();
  const isRefreshCall = req.url.includes('/auth/refresh');
  const outReq = (token && !isRefreshCall) ? withBearer(req, token) : req;

  return next(outReq).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || isRefreshCall) {
        return throwError(() => err);
      }
      return tryRefresh(req, next, auth, local, router);
    }),
  );
};

function withBearer(
  req: HttpRequest<unknown>,
  token: string,
): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function tryRefresh(
  originalReq: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  local: LocalAuthService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  const refreshToken = local.getRefreshToken();

  if (!refreshToken) {
    doLogout(auth, router);
    return EMPTY;
  }

  if (isRefreshing) {
    // Queue behind the in-flight refresh; retry once it completes
    return accessTokenRefreshed$.pipe(
      filter((t): t is string => t !== null),
      take(1),
      switchMap((newToken) => next(withBearer(originalReq, newToken))),
    );
  }

  isRefreshing = true;
  accessTokenRefreshed$.next(null);

  return local.refresh().pipe(
    tap((newToken) => {
      isRefreshing = false;
      accessTokenRefreshed$.next(newToken);
    }),
    switchMap((newToken) => next(withBearer(originalReq, newToken))),
    catchError((refreshErr) => {
      isRefreshing = false;
      accessTokenRefreshed$.next(null);
      // Only logout if the refresh token itself is rejected (401/403).
      // Network errors or 5xx should not force logout.
      const isAuthError =
        refreshErr instanceof HttpErrorResponse &&
        (refreshErr.status === 401 || refreshErr.status === 403);
      if (isAuthError) {
        doLogout(auth, router);
      }
      return throwError(() => refreshErr);
    }),
  );
}

function doLogout(auth: AuthService, router: Router): void {
  auth.logout().subscribe();
  router.navigate(['/login']);
}

function tryOidcRenew(
  originalReq: HttpRequest<unknown>,
  next: HttpHandlerFn,
  oidc: OidcAuthService,
): Observable<HttpEvent<unknown>> {
  if (!oidc.hasRefreshToken()) {
    return throwError(
      () =>
        new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }),
    );
  }

  if (isOidcRenewing) {
    return oidcTokenRenewed$.pipe(
      filter((t): t is string => t !== null),
      take(1),
      switchMap((newToken) => next(withBearer(originalReq, newToken))),
    );
  }

  isOidcRenewing = true;
  oidcTokenRenewed$.next(null);

  return oidc.renewToken().pipe(
    tap((newToken) => {
      isOidcRenewing = false;
      oidcTokenRenewed$.next(newToken);
    }),
    switchMap((newToken) => next(withBearer(originalReq, newToken))),
    catchError((renewErr) => {
      isOidcRenewing = false;
      oidcTokenRenewed$.next(null);
      oidc.redirectToLogin();
      return throwError(() => renewErr);
    }),
  );
}
