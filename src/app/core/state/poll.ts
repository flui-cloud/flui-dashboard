import { DestroyRef, inject } from '@angular/core';

export interface PollOptions {
  readonly immediate?: boolean;
  readonly destroyRef?: DestroyRef;
}

export function poll(tick: () => void, intervalMs: number, options: PollOptions = {}): () => void {
  const destroyRef = options.destroyRef ?? inject(DestroyRef);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const schedule = () => {
    if (stopped || document.hidden) return;
    timer = setTimeout(() => {
      timer = null;
      tick();
      schedule();
    }, intervalMs);
  };

  const onVisibility = () => {
    if (document.hidden) {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      return;
    }
    if (timer === null && !stopped) {
      tick();
      schedule();
    }
  };

  const stop = () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisibility);
  };

  document.addEventListener('visibilitychange', onVisibility);
  destroyRef.onDestroy(stop);
  if (options.immediate) tick();
  schedule();
  return stop;
}
