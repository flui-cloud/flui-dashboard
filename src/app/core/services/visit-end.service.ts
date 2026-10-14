import { Injectable, inject, signal } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { OidcAuthService } from './oidc-auth.service';
import { SandboxService } from './sandbox.service';
import { VisitEnd } from './sandbox-fence';

/**
 * A visit the API says is over, on whichever path heard it first: a call in
 * the middle of the visit, or the profile asked for while the page loads.
 */
@Injectable({ providedIn: 'root' })
export class VisitEndService {
  private readonly oidc = inject(OidcAuthService);
  private readonly router = inject(Router);
  private readonly sandbox = inject(SandboxService);
  private readonly _ended = signal<VisitEnd | null>(null);
  readonly ended = this._ended.asReadonly();
  private ending = false;

  /**
   * A visit that ended starts a new one; one that became an account signs in
   * normally. Neither renews the visitor's token, which would only be refused again.
   */
  end(kind: VisitEnd): void {
    this._ended.set(kind);
    if (this.ending) return;
    this.ending = true;
    this.sandbox.forget();
    const next =
      kind === 'merged'
        ? this.oidc.dropVisit().then(() => this.oidc.login())
        : this.oidc.dropVisit().then(() => this.router.navigate(['/try'], { queryParams: { ended: '1' }, replaceUrl: true }));
    void next
      .catch(() => undefined)
      .finally(() => {
        this.ending = false;
      });
  }

  /** Where a page that needs a session goes instead of the sign-in page, once a visit ended. */
  landing(): UrlTree | null {
    return this._ended() === 'gone' ? this.router.createUrlTree(['/try'], { queryParams: { ended: '1' } }) : null;
  }
}
