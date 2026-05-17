import { Injectable, signal } from '@angular/core';

/**
 * Simple service to coordinate refresh between the DNS shell header button
 * and the active tab component (zones or custom domains).
 * Shell calls triggerRefresh(); tabs subscribe via effect().
 */
@Injectable({ providedIn: 'root' })
export class DnsRefreshService {
  private readonly _trigger = signal(0);
  readonly trigger = this._trigger.asReadonly();

  triggerRefresh(): void {
    this._trigger.update(n => n + 1);
  }
}
