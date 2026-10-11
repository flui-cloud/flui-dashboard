import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { loadedOf } from './section-reading';

describe('loadedOf', () => {
  const resource = (state: { status: string; value?: unknown; error?: unknown }) =>
    ({
      status: signal(state.status),
      error: signal(state.error),
      isLoading: signal(state.status === 'loading'),
      hasValue: () => state.status === 'resolved',
      value: () => {
        if (state.status === 'error') throw new Error('value read in error state');
        return state.value;
      },
    }) as never;

  it('turns a refusal into a failure instead of loading forever', () => {
    const read = loadedOf(
      resource({ status: 'error', error: new HttpErrorResponse({ status: 403 }) }),
      'The clusters',
    )();
    expect(read.loading).toBeFalse();
    expect(read.failed).toContain('The clusters');
    expect(read.data).toBeNull();
  });

  it('keeps showing what it has while it reads again', () => {
    const read = loadedOf(resource({ status: 'resolved', value: [1] }), 'x')();
    expect(read.loading).toBeFalse();
    expect(read.data).toEqual([1]);
  });
});
