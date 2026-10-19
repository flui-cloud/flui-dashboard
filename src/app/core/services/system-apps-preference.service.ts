import { Injectable, computed, signal } from '@angular/core';
import { SHOW_SYSTEM_APPS_KEY } from '../../layout/components/sidebar/sidebar-nav.config';

/**
 * Whether the apps Flui itself runs are shown. One setting for the sidebar and
 * every page that lists or draws apps, kept in this browser only. Until someone
 * chooses, lists leave them out and Topology draws them, so the map starts
 * whole; the first choice, made anywhere, holds everywhere.
 */
@Injectable({ providedIn: 'root' })
export class SystemAppsPreference {
  private readonly _chosen = signal<boolean | null>(read());
  readonly shown = computed(() => this._chosen() ?? false);
  readonly shownOnMap = computed(() => this._chosen() ?? true);

  set(value: boolean): void {
    this._chosen.set(value);
    try {
      localStorage.setItem(SHOW_SYSTEM_APPS_KEY, String(value));
    } catch {
      // Storage refused (private window): the choice lasts this visit.
    }
  }

  toggle(): void {
    this.set(!this.shown());
  }

  toggleOnMap(): void {
    this.set(!this.shownOnMap());
  }
}

function read(): boolean | null {
  try {
    const stored = localStorage.getItem(SHOW_SYSTEM_APPS_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return null;
  } catch {
    return null;
  }
}
