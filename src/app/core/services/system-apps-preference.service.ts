import { Injectable, signal } from '@angular/core';
import { SHOW_SYSTEM_APPS_KEY } from '../../layout/components/sidebar/sidebar-nav.config';

/**
 * Whether the apps Flui itself runs are shown. One setting for the sidebar and
 * every page that lists or draws apps, kept in this browser only.
 */
@Injectable({ providedIn: 'root' })
export class SystemAppsPreference {
  private readonly _shown = signal<boolean>(read());
  readonly shown = this._shown.asReadonly();

  set(value: boolean): void {
    this._shown.set(value);
    try {
      localStorage.setItem(SHOW_SYSTEM_APPS_KEY, String(value));
    } catch {
      // Storage refused (private window): the choice lasts this visit.
    }
  }

  toggle(): void {
    this.set(!this._shown());
  }
}

function read(): boolean {
  try {
    return localStorage.getItem(SHOW_SYSTEM_APPS_KEY) === 'true';
  } catch {
    return false;
  }
}
