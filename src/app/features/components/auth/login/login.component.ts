import {
  Component,
  HostBinding,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';

import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import {
  REDIRECT_KEY,
  consumeLoginRedirect,
  bumpLoopGuard,
  clearLoopGuard,
  LOOP_GUARD_MAX_ATTEMPTS,
} from '../../../../core/utils/safe-redirect';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { visitorRefusalLine } from '../try/visitor-refusal';
import { INSTALL_FLUI_URL } from '../../../../core/utils/install-flui';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlField } from '../../../../ui/patterns/field';
import { FlButton } from '../../../../ui/primitives/button';
import { FlSpinner } from '../../../../ui/primitives/spinner';
import { AuthCard } from '../auth-card';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AuthCard, FlAlert, FlField, FlButton, FlSpinner],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (loopDetected()) {
      <app-auth-card title="Sign-in failed">
        <fl-alert tone="error" [title]="'We could not sign you in to ' + loopHost()">
          Try again in a few moments. If the problem continues, contact support.
        </fl-alert>
        <a flButton="primary" [block]="true" href="/">Back to the dashboard</a>
      </app-auth-card>
    } @else if (visitorRefused(); as line) {
      <app-auth-card title="Flui demo">
        <div class="flex flex-col gap-4" data-testid="visitor-refused">
          <p class="m-0 text-center text-fl-body-sm">{{ line }}</p>
          <div class="flex justify-center gap-2">
            <a flButton="primary" routerLink="/try">Try again</a>
            <a
              flButton
              [href]="installUrl"
              target="_blank"
              rel="noopener"
              data-testid="install-flui"
              >Install Flui</a
            >
          </div>
        </div>
      </app-auth-card>
    } @else if (signedOut()) {
      <app-auth-card title="Signed out">
        <div class="flex flex-col gap-4" data-testid="signed-out">
          <p class="m-0 text-center text-fl-body-sm text-fl-ink-muted">You are signed out.</p>
          <button flButton="primary" [block]="true" type="button" (click)="signIn()">
            Sign in again
          </button>
        </div>
      </app-auth-card>
    } @else if (authMode() === 'oidc') {
      <app-auth-card title="Sign in to Flui">
        <div class="flex items-center justify-center gap-2 text-fl-body-sm text-fl-ink-muted">
          <fl-spinner label="Redirecting" />
          Redirecting to the sign-in provider…
        </div>
      </app-auth-card>
    } @else {
      <app-auth-card title="Sign in to Flui">
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4" novalidate>
          <fl-field label="Email" for="email" [error]="emailError()">
            <div class="fl-input fl-input--lg">
              <input
                id="email"
                type="email"
                formControlName="email"
                autocomplete="email"
                placeholder="admin@flui.cloud"
                [attr.aria-invalid]="isInvalid('email')"
              />
            </div>
          </fl-field>

          <fl-field label="Password" for="password" [error]="passwordError()">
            <div class="fl-input fl-input--lg">
              <input
                id="password"
                type="password"
                formControlName="password"
                autocomplete="current-password"
                [attr.aria-invalid]="isInvalid('password')"
              />
            </div>
          </fl-field>

          @if (errorMessage()) {
            <fl-alert tone="error" title="Sign-in failed">{{ errorMessage() }}</fl-alert>
          }

          <button flButton="primary" [block]="true" type="submit" [disabled]="loading()">
            @if (loading()) {
              <fl-spinner label="Signing in" />
              Signing in…
            } @else {
              Sign in
            }
          </button>
        </form>
        <p authFooter class="m-0 text-center text-fl-caption text-fl-ink-muted">
          flui.cloud &copy; {{ year }}
        </p>
      </app-auth-card>
    }
  `,
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cfg = inject(AppConfigService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly themeService = inject(ThemeService);
  protected readonly installUrl = INSTALL_FLUI_URL;

  @HostBinding('class.dark') get darkMode() {
    return this.themeService.isDarkMode();
  }

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  authMode = signal<'local' | 'oidc'>('local');
  loopDetected = signal(false);
  loopHost = signal<string>('');
  visitorRefused = signal<string | null>(null);
  signedOut = signal(false);
  readonly year = new Date().getFullYear();

  ngOnInit(): void {
    this.authMode.set(this.cfg.authMode);

    const redirect = this.route.snapshot.queryParams['redirect'];
    if (redirect) {
      sessionStorage.setItem(REDIRECT_KEY, redirect);

      const state = bumpLoopGuard(redirect);
      if (state.count > LOOP_GUARD_MAX_ATTEMPTS) {
        try {
          this.loopHost.set(new URL(redirect).host);
        } catch {
          this.loopHost.set(redirect);
        }
        this.loopDetected.set(true);
        sessionStorage.removeItem(REDIRECT_KEY);
        clearLoopGuard(redirect);
        return;
      }
    }

    const query = this.route.snapshot.queryParamMap;
    if (query.get('visitor') === 'refused') {
      this.visitorRefused.set(visitorRefusalLine(query.get('reason')));
      return;
    }

    if (this.cfg.authMode === 'oidc') {
      if (query.get('loggedOut') === 'true') {
        this.signedOut.set(true);
      } else {
        this.auth.login();
      }
    }
  }

  signIn(): void {
    this.visitorRefused.set(null);
    this.signedOut.set(false);
    if (this.cfg.authMode === 'oidc') this.auth.login();
  }

  emailError(): string | null {
    if (!this.isInvalid('email')) return null;
    const ctrl = this.form.controls.email;
    if (ctrl.hasError('required')) return 'Email is required.';
    if (ctrl.hasError('email')) return 'Enter a valid email address.';
    return null;
  }

  passwordError(): string | null {
    if (!this.isInvalid('password')) return null;
    const ctrl = this.form.controls.password;
    if (ctrl.hasError('required')) return 'Password is required.';
    if (ctrl.hasError('minlength')) return 'Password must be at least 6 characters.';
    return null;
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.errorMessage.set(null);
    this.loading.set(true);

    const { email, password } = this.form.getRawValue();
    const result = this.auth.login(email, password);
    if (result) {
      result.subscribe({
        next: () => {
          this.auth.loadCurrentUser().subscribe(() => {
            this.loading.set(false);
            const redirect = consumeLoginRedirect();
            if (redirect) {
              globalThis.window.location.href = redirect;
            } else {
              this.router.navigate(['/']);
            }
          });
        },
        error: (err) => {
          this.loading.set(false);
          if (err?.status === 401) {
            this.errorMessage.set('Invalid email or password.');
          } else {
            this.errorMessage.set('Login failed. Please try again.');
          }
        },
      });
    }
  }
}
