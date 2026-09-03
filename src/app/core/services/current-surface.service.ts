import { Injectable, isDevMode, signal } from '@angular/core';
import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';

/**
 * Cross-page registry for the one Semantic Surface snapshot describing "what the
 * user is currently looking at" (spec §11.1). A page that has built a producer
 * writes its own snapshot here whenever it changes; everywhere else stays empty —
 * that is correct, not a gap: surface is optional everywhere, and most pages have
 * no producer yet.
 *
 * The writing page owns clearing its own entry on destroy, so a snapshot never
 * outlives the page it describes — see e.g. ApplicationDetailComponent's
 * ngOnDestroy. This service has no opinion on *which* page is "current"; it only
 * holds whatever the last write left behind — one slot, last-write-wins.
 *
 * That single slot is a deliberate YAGNI call, not an oversight: today no two
 * producer pages are ever mounted at once (Angular always destroys the outgoing
 * route's component, which clears its own entry, before the incoming one's
 * constructor runs — verified across every producer route in this app). Building
 * a scoped/multi-slot registry now would be plumbing for a UI shape (a
 * master-detail view, a modal over an already-producing page) that does not
 * exist yet, and the spec's own attention-arbitration rule between two
 * simultaneously-live snapshots isn't decided either (playbook §4, sixth case) —
 * a multi-slot registry would have nothing to do with the second slot until that
 * product decision is made. If that UI shape gets built, THIS is the trigger to
 * revisit this file, not a scope/id parameter added speculatively today.
 */
@Injectable({ providedIn: 'root' })
export class CurrentSurfaceService {
  private readonly _current = signal<SurfaceSnapshot | null>(null);
  readonly current = this._current.asReadonly();

  /**
   * Canary for the single-slot assumption above: a non-null snapshot silently
   * replacing a DIFFERENT non-null snapshot (no intervening `null` — i.e. no
   * page's `ngOnDestroy` ran in between) means two producers were live at once,
   * which this service was never designed to arbitrate between. Dev-mode only —
   * loud enough to catch in development, never a runtime risk for a real user.
   */
  set(snapshot: SurfaceSnapshot | null): void {
    if (isDevMode() && snapshot && this._current()) {
      const previous = this._current();
      if (previous && previous.surface.id !== snapshot.surface.id) {
        // eslint-disable-next-line no-console
        console.error(
          `[CurrentSurfaceService] "${snapshot.surface.id}" replaced "${previous.surface.id}" ` +
            'without an intervening clear — two producer pages appear to be mounted at once. ' +
            'This registry holds one slot and was never designed for that; see this file\'s own doc comment.',
        );
      }
    }
    this._current.set(snapshot);
  }
}
