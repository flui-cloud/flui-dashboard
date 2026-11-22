import { Resource, Signal, computed } from '@angular/core';
import { isNotFound, reasonOf } from './http-error';

export type RemoteStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface RemoteData<T> {
  readonly status: RemoteStatus;
  readonly data: T | null;
  readonly error: string | null;
  readonly refreshing: boolean;
}

export type ResourceLike<T> = Pick<
  Resource<T>,
  'status' | 'error' | 'hasValue' | 'value' | 'isLoading'
>;

export interface RemoteDataOptions<T> {
  readonly isEmpty?: (value: T) => boolean;
  readonly notFoundIsEmpty?: boolean;
}

export function defaultIsEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function readRemote<T>(
  resource: ResourceLike<T | undefined>,
  options: RemoteDataOptions<T> = {},
): RemoteData<T> {
  const isEmpty = options.isEmpty ?? defaultIsEmpty;
  const error = resource.error();
  const data = resource.hasValue() ? (resource.value() ?? null) : null;
  const refreshing = resource.isLoading() && data !== null;

  if (error) {
    if (options.notFoundIsEmpty && isNotFound(error)) {
      return { status: 'empty', data: null, error: null, refreshing: false };
    }
    return { status: 'error', data, error: reasonOf(error), refreshing: false };
  }
  if (data === null) {
    const waiting = resource.isLoading() || resource.status() === 'idle';
    return { status: waiting ? 'loading' : 'empty', data: null, error: null, refreshing: false };
  }
  return { status: isEmpty(data) ? 'empty' : 'ready', data, error: null, refreshing };
}

export function remoteData<T>(
  resource: ResourceLike<T | undefined>,
  options: RemoteDataOptions<T> = {},
): Signal<RemoteData<T>> {
  return computed(() => readRemote(resource, options));
}
