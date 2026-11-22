import { HttpErrorResponse } from '@angular/common/http';
import { Resource, Signal, computed } from '@angular/core';
import { reasonOf } from '../../../core/state/http-error';

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

    // value() throws while the resource is in error; read it only through hasValue().
    const data = resource.hasValue() ? (resource.value() ?? null) : null;
    return {
      data,
      loading: (resource.isLoading() && data === null) || idle,
      failed: error && !absent ? `${what} — ${reasonOf(error)}` : null,
      absent,
    };
  });
}

export { reasonOf };
