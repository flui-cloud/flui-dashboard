import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { INSTALL_FLUI_URL } from '../utils/install-flui';
import { SandboxService } from './sandbox.service';

/** Opens the install page in a new tab; a token so tests stay on theirs. */
export const INSTALL_PAGE_OPENER = new InjectionToken<() => void>('INSTALL_PAGE_OPENER', {
  providedIn: 'root',
  factory: () => () => void globalThis.window.open(INSTALL_FLUI_URL, '_blank', 'noopener'),
});

/** The demo is read-only: a write from someone without a space of their own points to installing Flui. */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly sandbox = inject(SandboxService);
  private readonly openPage = inject(INSTALL_PAGE_OPENER);

  private readonly _open = signal(false);
  readonly dialogOpen = this._open.asReadonly();
  readonly readOnly = computed(
    () => this.sandbox.visitor() || (this.sandbox.inSandbox() && !this.sandbox.hasArea()),
  );

  /** True when the demo is read-only for the caller and the install dialog has been opened instead. */
  requireInstall(): boolean {
    if (!this.readOnly()) return false;
    this.offer();
    return true;
  }

  offer(): void {
    this._open.set(true);
  }

  close(): void {
    this._open.set(false);
  }

  visitInstallPage(): void {
    this.openPage();
  }
}
