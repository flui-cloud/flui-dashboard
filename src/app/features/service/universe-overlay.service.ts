import { Injectable, signal } from '@angular/core';

/**
 * Global state for the Universe Map fullscreen overlay.
 * The overlay is mounted once in ShellLayoutComponent and shown/hidden via this signal.
 */
@Injectable({ providedIn: 'root' })
export class UniverseOverlayService {
  private readonly _isOpen = signal<boolean>(false);
  readonly isOpen = this._isOpen.asReadonly();

  open(): void {
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
  }

  toggle(): void {
    this._isOpen.update((v) => !v);
  }
}
