import { HttpErrorResponse } from '@angular/common/http';

export function reasonOf(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return error instanceof Error ? error.message : 'the request did not complete';
  }
  if (error.status === 0) return 'the API did not answer';
  if (error.status === 401 || error.status === 403) {
    return 'this account may not read it';
  }

  const body: unknown = error.error;
  const message =
    typeof body === 'object' && body !== null && 'message' in body
      ? (body as { message?: unknown }).message
      : null;

  if (typeof message === 'string' && message) return `${error.status} · ${message}`;
  return `${error.status} error`;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}
