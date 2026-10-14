import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, Injector, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../shared/services/toast.service';
import { AppConfigService } from './app-config.service';
import { AuthService } from './auth.service';
import { OidcAuthService } from './oidc-auth.service';
import { SandboxService } from './sandbox.service';

export type UpgradeProvider = 'github' | 'google';

export interface UpgradeProviders {
  providers: Array<{ provider: UpgradeProvider; name: string }>;
  email: boolean;
}

interface FinishAnswer {
  outcome: 'upgraded' | 'signin-as-existing' | 'refused';
  reason: string | null;
  returnTo: string | null;
  linkNonce: string | null;
}

/** Leaves the dashboard for a provider's page; a token so tests stay on theirs. */
export const PAGE_NAVIGATOR = new InjectionToken<(url: string) => void>('PAGE_NAVIGATOR', {
  providedIn: 'root',
  factory: () => (url: string) => globalThis.window.location.assign(url),
});

export const RESUME_KEY = 'flui:visitor-resume';
export const LINK_KEY = 'flui:visitor-link';

export const SIGN_IN_FAILED = 'Sign-in did not finish. Try again.';
export const LINK_FAILED = 'Your visit could not be added to this account.';
const REFUSED: Record<string, string> = {
  expired: 'Sign-in took too long. Try again.',
  blocked: 'This sign-in cannot be used here.',
};

export function isSamePagePath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/\\')
  );
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Without storage the visit still moves; only the way back is lost.
  }
}

function storedNonce(): string | null {
  try {
    const parsed = JSON.parse(read(LINK_KEY) ?? 'null') as { nonce?: unknown } | null;
    return typeof parsed?.nonce === 'string' ? parsed.nonce : null;
  } catch {
    return null;
  }
}

/** Turns a visitor into an account holder without losing what they were doing. */
@Injectable({ providedIn: 'root' })
export class VisitorSignInService {
  private readonly sandbox = inject(SandboxService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly cfg = inject(AppConfigService);
  private readonly toast = inject(ToastService);
  private readonly navigateAway = inject(PAGE_NAVIGATOR);
  // Resolved on use: screens that only show the gate need no sign-in machinery.
  private readonly injector = inject(Injector);

  private readonly _open = signal(false);
  readonly dialogOpen = this._open.asReadonly();
  private readonly _busy = signal(false);
  readonly busy = this._busy.asReadonly();
  private resumeTo: string | null = null;
  private returnHandled = false;

  private get base(): string {
    return `${this.cfg.apiBaseUrl}/api/v1/sandbox/visitor`;
  }

  /** True when the caller is a visitor and the sign-in dialog has been opened instead. */
  requireSignIn(resumeTo?: string): boolean {
    if (!this.sandbox.visitor()) return false;
    this.openDialog(resumeTo);
    return true;
  }

  signIn(resumeTo?: string): void {
    if (this.sandbox.visitor()) {
      this.openDialog(resumeTo);
      return;
    }
    void this.injector.get(OidcAuthService).login();
  }

  close(): void {
    this._open.set(false);
    this.resumeTo = null;
  }

  async providers(): Promise<UpgradeProviders> {
    try {
      const answer = await firstValueFrom(
        this.http.get<UpgradeProviders>(`${this.base}/upgrade/providers`),
      );
      return { providers: answer.providers ?? [], email: answer.email === true };
    } catch {
      return { providers: [], email: true };
    }
  }

  async withProvider(provider: UpgradeProvider): Promise<void> {
    const returnTo = this.resumeTo ?? this.router.url;
    this._busy.set(true);
    try {
      const { authUrl } = await firstValueFrom(
        this.http.post<{ authUrl: string }>(`${this.base}/upgrade/idp`, { provider, returnTo }),
      );
      write(RESUME_KEY, returnTo);
      this.navigateAway(authUrl);
    } catch {
      this._busy.set(false);
      this.toast.showError(SIGN_IN_FAILED);
    }
  }

  async withEmail(): Promise<void> {
    const returnTo = this.resumeTo ?? this.router.url;
    this._busy.set(true);
    try {
      const { nonce } = await firstValueFrom(
        this.http.post<{ nonce: string; expiresAt: string }>(`${this.base}/link-intent`, {}),
      );
      write(LINK_KEY, JSON.stringify({ nonce }));
      write(RESUME_KEY, returnTo);
      await this.normalLogin();
    } catch {
      this._busy.set(false);
      this.toast.showError(SIGN_IN_FAILED);
    }
  }

  /** Picks up where a provider or a normal sign-in sent the person back. Once per page load. */
  async handleReturn(): Promise<void> {
    if (this.returnHandled) return;
    this.returnHandled = true;
    const tree = this.router.parseUrl(this.router.url);
    const visitorParam = tree.queryParamMap.get('visitor');
    const flow = tree.queryParamMap.get('flow');
    if (visitorParam) {
      delete tree.queryParams['visitor'];
      delete tree.queryParams['flow'];
      await this.router.navigateByUrl(tree, { replaceUrl: true });
    }
    if (visitorParam === 'finish' && flow) return this.finish(flow);
    if (visitorParam) {
      write(RESUME_KEY, null);
      this.toast.showError(SIGN_IN_FAILED);
      return;
    }
    const oidc = this.injector.get(OidcAuthService);
    if (oidc.isVisitorSession()) {
      write(RESUME_KEY, null);
      return;
    }
    if (!this.injector.get(AuthService).isUserAuthenticated()) return;
    const nonce = storedNonce();
    if (nonce) return this.link(nonce);
    if (read(RESUME_KEY)) await this.resume();
  }

  /** Goes back to what the person was doing, only within the dashboard. */
  async resume(fallback?: string | null): Promise<void> {
    const path = read(RESUME_KEY) ?? fallback ?? null;
    write(RESUME_KEY, null);
    if (!isSamePagePath(path) || path === this.router.url) return;
    await this.router.navigateByUrl(path);
  }

  private openDialog(resumeTo?: string): void {
    this.resumeTo = isSamePagePath(resumeTo) ? resumeTo : this.router.url;
    this._busy.set(false);
    this._open.set(true);
  }

  private async normalLogin(): Promise<void> {
    this.sandbox.forget();
    await this.injector.get(OidcAuthService).login();
  }

  private async finish(flow: string): Promise<void> {
    let answer: FinishAnswer;
    try {
      answer = await firstValueFrom(
        this.http.post<FinishAnswer>(`${this.base}/upgrade/finish`, { flow }),
      );
    } catch {
      write(RESUME_KEY, null);
      this.toast.showError(SIGN_IN_FAILED);
      return;
    }
    if (answer.outcome === 'upgraded') return this.upgraded(answer.returnTo);
    if (answer.outcome === 'signin-as-existing') {
      if (answer.linkNonce) write(LINK_KEY, JSON.stringify({ nonce: answer.linkNonce }));
      if (!read(RESUME_KEY) && isSamePagePath(answer.returnTo)) write(RESUME_KEY, answer.returnTo);
      await this.normalLogin();
      return;
    }
    write(RESUME_KEY, null);
    this.toast.showError(REFUSED[answer.reason ?? ''] ?? SIGN_IN_FAILED);
  }

  private async upgraded(returnTo: string | null): Promise<void> {
    try {
      await firstValueFrom(this.injector.get(OidcAuthService).renewToken());
    } catch {
      // The current token still works; the next refresh carries the new claims.
    }
    const auth = this.injector.get(AuthService);
    auth.refreshAuthState();
    await firstValueFrom(auth.loadCurrentUser());
    await firstValueFrom(this.sandbox.probe());
    this.toast.showSuccess("You're signed in. Your visit came with you.");
    await this.resume(returnTo);
  }

  private async link(nonce: string): Promise<void> {
    write(LINK_KEY, null);
    try {
      const answer = await firstValueFrom(
        this.http.post<{ outcome: 'linked'; returnTo: string | null }>(`${this.base}/link`, { nonce }),
      );
      this.toast.showSuccess('Your visit is now part of your account.');
      await this.resume(answer.returnTo);
    } catch {
      write(RESUME_KEY, null);
      this.toast.showError(LINK_FAILED);
    }
  }
}
