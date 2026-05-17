import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { AuthService as ApiAuthService } from '../../../../core/api/api/auth.service';
import { OidcAuthService } from '../../../../core/services/oidc-auth.service';
import { consumeLoginRedirect } from '../../../../core/utils/safe-redirect';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-background">
      @if (apiError()) {
        <div class="text-center space-y-3 px-4">
          <p class="text-sm text-destructive">Authentication service unavailable. Please try again later.</p>
          <a href="/" class="text-xs underline text-muted-foreground">← Back to dashboard</a>
        </div>
      } @else {
        <p class="text-sm text-muted-foreground">Autenticazione in corso...</p>
      }
    </div>
  `,
})
export class CallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly oidc = inject(OidcAuthService);
  private readonly apiAuth = inject(ApiAuthService);
  private readonly router = inject(Router);

  apiError = signal(false);

  ngOnInit(): void {
    this.auth.refreshAuthState();

    const token = this.oidc.getToken();
    if (token) {
      this.apiAuth.authControllerOidcSession().subscribe({
        next: () => this.navigateAfterLogin(),
        error: () => {
          const redirect = sessionStorage.getItem('flui_login_redirect');
          const key = redirect ? `flui_auth_loop:${redirect}` : null;
          const raw = key ? sessionStorage.getItem(key) : null;
          const attempts = raw ? (JSON.parse(raw) as { count: number }).count : 0;

          if (attempts >= 2) {
            this.apiError.set(true);
            sessionStorage.removeItem('flui_login_redirect');
            if (key) sessionStorage.removeItem(key);
          } else {
            if (key) sessionStorage.setItem(key, JSON.stringify({ count: attempts + 1, firstAttemptAt: Date.now() }));
            this.navigateAfterLogin();
          }
        },
      });
    } else {
      this.navigateAfterLogin();
    }
  }

  private navigateAfterLogin(): void {
    const redirect = consumeLoginRedirect();
    if (redirect) {
      sessionStorage.removeItem(`flui_auth_loop:${redirect}`);
      globalThis.window.location.href = redirect;
    } else {
      this.router.navigate(['/']);
    }
  }
}
