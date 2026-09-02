import { HttpErrorResponse } from '@angular/common/http';
import { Resource, Signal, computed } from '@angular/core';

export interface Loaded<T> {
  data: T | null;
  loading: boolean;
  failed: string | null;
  absent: boolean;
}

export function loadedOf<T>(
  resource: Resource<T | undefined>,
  what: string,
): Signal<Loaded<T>> {
  return computed(() => {
    const error = resource.error();
    const absent = error instanceof HttpErrorResponse && error.status === 404;
    const idle = resource.status() === 'idle';

    return {
      data: resource.value() ?? null,
      loading: resource.isLoading() || idle,
      failed: error && !absent ? `${what} — ${reasonOf(error)}` : null,
      absent,
    };
  });
}

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
