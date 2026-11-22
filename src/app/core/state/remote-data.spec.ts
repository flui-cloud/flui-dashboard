import { HttpErrorResponse } from '@angular/common/http';
import { ResourceStatus } from '@angular/core';
import { ResourceLike, readRemote } from './remote-data';

function fake<T>(state: {
  status?: ResourceStatus;
  value?: T;
  error?: unknown;
  loading?: boolean;
}): ResourceLike<T | undefined> {
  const has = state.value !== undefined && !state.error;
  return {
    status: () => state.status ?? (has ? 'resolved' : 'loading'),
    error: () => (state.error as Error | undefined) ?? undefined,
    hasValue: (() => has) as ResourceLike<T | undefined>['hasValue'],
    value: () => state.value,
    isLoading: () => state.loading ?? false,
  } as ResourceLike<T | undefined>;
}

describe('readRemote', () => {
  it('is loading before the first value', () => {
    expect(readRemote(fake<string[]>({ loading: true })).status).toBe('loading');
  });

  it('is loading while the resource is idle', () => {
    expect(readRemote(fake<string[]>({ status: 'idle' })).status).toBe('loading');
  });

  it('is empty for an empty list', () => {
    expect(readRemote(fake<string[]>({ value: [] })).status).toBe('empty');
  });

  it('is ready with data', () => {
    const read = readRemote(fake<string[]>({ value: ['a'] }));
    expect(read.status).toBe('ready');
    expect(read.data).toEqual(['a']);
  });

  it('marks a reload of existing data as refreshing, not loading', () => {
    const read = readRemote(fake<string[]>({ value: ['a'], loading: true }));
    expect(read.status).toBe('ready');
    expect(read.refreshing).toBeTrue();
  });

  it('says why a request failed', () => {
    const error = new HttpErrorResponse({ status: 0 });
    const read = readRemote(fake<string[]>({ error, status: 'error' }));
    expect(read.status).toBe('error');
    expect(read.error).toBe('the API did not answer');
  });

  it('treats a 404 as empty only when asked to', () => {
    const error = new HttpErrorResponse({ status: 404 });
    expect(readRemote(fake<string[]>({ error, status: 'error' })).status).toBe('error');
    expect(
      readRemote(fake<string[]>({ error, status: 'error' }), { notFoundIsEmpty: true }).status,
    ).toBe('empty');
  });

  it('uses a custom emptiness test', () => {
    const read = readRemote(fake<{ items: number[] }>({ value: { items: [] } }), {
      isEmpty: (v) => v.items.length === 0,
    });
    expect(read.status).toBe('empty');
  });
});
