import { WritableSignal, effect, signal } from '@angular/core';

const PREFIX = 'flui:';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function storedSignal<T>(key: string, fallback: T): WritableSignal<T> {
  const state = signal<T>(read(key, fallback));
  effect(() => {
    const value = state();
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      return;
    }
  });
  return state;
}
