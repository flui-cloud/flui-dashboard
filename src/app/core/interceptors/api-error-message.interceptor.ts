import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AppConfigService } from '../services/app-config.service';
import { apiPath } from './sandbox-fence.interceptor';

/**
 * Angular words every failed call as "Http failure response for <url>: 403 OK",
 * and many screens print `error.message` as it comes. The API almost always
 * says why in its body; that sentence becomes the message, and an address or a
 * status code is never what a person reads.
 */
export const apiErrorMessageInterceptor: HttpInterceptorFn = (req, next) => {
  if (apiPath(req.url, inject(AppConfigService).apiBaseUrl) === null) return next(req);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        Object.defineProperty(error, 'message', { value: readableMessage(error), configurable: true });
      }
      return throwError(() => error);
    }),
  );
};

export function readableMessage(error: HttpErrorResponse): string {
  const body = error.error as { message?: unknown } | string | null;
  const said = typeof body === 'string' ? body : body?.message;
  if (typeof said === 'string' && said.trim() && !said.trim().startsWith('<')) return said.trim();
  if (Array.isArray(said) && said.length) return said.map(String).join('; ');
  if (error.status === 0) return 'Flui could not be reached. Check the connection and try again.';
  if (error.status === 401) return 'Your session has ended. Sign in again.';
  if (error.status === 403) return 'You do not have access to this.';
  if (error.status === 404) return 'This could not be found. It may have been removed.';
  if (error.status >= 500) return 'Something went wrong on the server. Try again in a moment.';
  return 'The request could not be completed.';
}
