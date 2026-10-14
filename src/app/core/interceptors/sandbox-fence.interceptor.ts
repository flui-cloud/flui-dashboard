import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AppConfigService } from '../services/app-config.service';
import { SandboxService } from '../services/sandbox.service';
import { ToastService } from '../../shared/services/toast.service';
import { VisitorSignInService } from '../services/visitor-sign-in.service';
import {
  SANDBOX_NOT_IN_TRIAL,
  SANDBOX_ROUTE_FORBIDDEN,
  SANDBOX_SIGN_IN_REQUIRED,
  isSignInRequired,
} from '../services/sandbox-fence';

const SIGN_IN_NOTICE_GAP_MS = 5000;
let lastSignInNoticeAt = 0;

/**
 * A guest never sends what the API's fence would refuse: the call is answered
 * here with the same 403 the API gives, so no screen waits on it and the
 * instance is not asked dozens of times a page for something it will say no to.
 */
export const sandboxFenceInterceptor: HttpInterceptorFn = (req, next) => {
  const path = apiPath(req.url, inject(AppConfigService).apiBaseUrl);
  if (path === null) return next(req);
  const sandbox = inject(SandboxService);
  const toast = inject(ToastService);
  const gate = inject(VisitorSignInService);
  if (sandbox.allows(req.method, path)) {
    if (sandbox.needsSignIn(req.method, path)) {
      noticeSignIn(toast, gate);
      return throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            statusText: 'Unauthorized',
            url: req.url,
            error: { statusCode: 401, code: SANDBOX_SIGN_IN_REQUIRED },
          }),
      );
    }
    return next(req).pipe(
      catchError((error: unknown) => {
        if (isSignInRequired(error)) noticeSignIn(toast, gate);
        return throwError(() => error);
      }),
    );
  }
  return throwError(
    () =>
      new HttpErrorResponse({
        status: 403,
        statusText: 'Forbidden',
        url: req.url,
        error: { statusCode: 403, code: SANDBOX_ROUTE_FORBIDDEN, message: SANDBOX_NOT_IN_TRIAL },
      }),
  );
};

function noticeSignIn(toast: ToastService, gate: VisitorSignInService): void {
  const now = Date.now();
  if (now - lastSignInNoticeAt < SIGN_IN_NOTICE_GAP_MS) return;
  lastSignInNoticeAt = now;
  toast.showInfo({
    title: 'Sign in to continue',
    message: 'Sign in with GitHub, Google or email to do this. You can keep looking around.',
    action: { label: 'Sign in', onClick: () => gate.signIn() },
  });
}

export function apiPath(url: string, apiBaseUrl = ''): string | null {
  let base = apiBaseUrl;
  while (base.endsWith('/')) base = base.slice(0, -1);
  const prefix = `${base}/api/v1/`;
  if (!base || !url.startsWith(prefix)) return null;
  return `/${url.slice(prefix.length)}`;
}
