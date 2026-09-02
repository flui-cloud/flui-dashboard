import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'flui-mask-mode';

/**
 * Mask mode's dashboard-side toggle. Defaults off (opt-in before a
 * screen-share) and persists per-browser rather than per-account: it tracks
 * "am I about to show this screen", not who is logged in, so it must not
 * follow the account to another machine.
 *
 * Owns only the signal and the header stamp — turning it on does not remove
 * real values already fetched, which is why consumers refetch on change.
 */
@Injectable({
  providedIn: 'root',
})
export class MaskModeService {
  private readonly _enabled = signal<boolean>(this.loadFromStorage());

  readonly enabled = this._enabled.asReadonly();

  setEnabled(on: boolean): void {
    this._enabled.set(on);
    this.persist(on);
  }

  toggle(): void {
    this.setEnabled(!this._enabled());
  }

  private persist(on: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      // Storage unavailable (private mode, disabled cookies) — the signal
      // remains the source of truth for this page load.
    }
  }

  private loadFromStorage(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'on';
    } catch {
      return false;
    }
  }
}
