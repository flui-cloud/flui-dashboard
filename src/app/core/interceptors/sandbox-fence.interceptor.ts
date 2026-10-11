import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { AppConfigService } from '../services/app-config.service';
import { SandboxService } from '../services/sandbox.service';
import { SANDBOX_NOT_IN_TRIAL, SANDBOX_ROUTE_FORBIDDEN } from '../services/sandbox-fence';

/**
 * A guest never sends what the API's fence would refuse: the call is answered
 * here with the same 403 the API gives, so no screen waits on it and the
 * instance is not asked dozens of times a page for something it will say no to.
 */
export const sandboxFenceInterceptor: HttpInterceptorFn = (req, next) => {
  const path = apiPath(req.url, inject(AppConfigService).apiBaseUrl);
  if (path === null) return next(req);
  const sandbox = inject(SandboxService);
  if (sandbox.allows(req.method, path)) return next(req);
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

export function apiPath(url: string, apiBaseUrl = ''): string | null {
  let base = apiBaseUrl;
  while (base.endsWith('/')) base = base.slice(0, -1);
  const prefix = `${base}/api/v1/`;
  if (!base || !url.startsWith(prefix)) return null;
  return `/${url.slice(prefix.length)}`;
}
