import { Component, HostBinding, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { REDIRECT_KEY, consumeLoginRedirect, bumpLoopGuard, clearLoopGuard, LOOP_GUARD_MAX_ATTEMPTS } from '../../../../core/utils/safe-redirect';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { ThemeService } from '../../../../core/services/theme.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  styles: [`
    .login-bg {
      background: hsl(224, 50%, 6%);
      position: relative;
      overflow: hidden;
    }

    /* ── Particles ── */
    .particles {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .p {
      position: absolute;
      border-radius: 9999px;
      background: hsl(217, 91%, 70%);
      animation: float linear infinite;
    }
    /* 20 particles with varying sizes, positions and durations */
    .p:nth-child(1)  { width:2px;  height:2px;  left:5%;   top:80%; opacity:.55; animation-duration:22s; animation-delay:-3s;  }
    .p:nth-child(2)  { width:3px;  height:3px;  left:12%;  top:60%; opacity:.35; animation-duration:28s; animation-delay:-8s;  }
    .p:nth-child(3)  { width:1.5px;height:1.5px;left:20%;  top:90%; opacity:.6;  animation-duration:19s; animation-delay:-1s;  }
    .p:nth-child(4)  { width:2.5px;height:2.5px;left:30%;  top:70%; opacity:.4;  animation-duration:25s; animation-delay:-12s; }
    .p:nth-child(5)  { width:2px;  height:2px;  left:40%;  top:85%; opacity:.5;  animation-duration:21s; animation-delay:-5s;  }
    .p:nth-child(6)  { width:3px;  height:3px;  left:50%;  top:75%; opacity:.3;  animation-duration:30s; animation-delay:-9s;  }
    .p:nth-child(7)  { width:1px;  height:1px;  left:60%;  top:95%; opacity:.65; animation-duration:17s; animation-delay:-2s;  }
    .p:nth-child(8)  { width:2.5px;height:2.5px;left:70%;  top:65%; opacity:.45; animation-duration:24s; animation-delay:-14s; }
    .p:nth-child(9)  { width:2px;  height:2px;  left:80%;  top:88%; opacity:.55; animation-duration:20s; animation-delay:-6s;  }
    .p:nth-child(10) { width:3px;  height:3px;  left:90%;  top:72%; opacity:.3;  animation-duration:27s; animation-delay:-11s; }
    .p:nth-child(11) { width:1.5px;height:1.5px;left:8%;   top:50%; opacity:.5;  animation-duration:23s; animation-delay:-4s;  }
    .p:nth-child(12) { width:2px;  height:2px;  left:18%;  top:40%; opacity:.4;  animation-duration:29s; animation-delay:-16s; }
    .p:nth-child(13) { width:2.5px;height:2.5px;left:28%;  top:55%; opacity:.6;  animation-duration:18s; animation-delay:-7s;  }
    .p:nth-child(14) { width:1px;  height:1px;  left:45%;  top:45%; opacity:.5;  animation-duration:26s; animation-delay:-10s; }
    .p:nth-child(15) { width:3px;  height:3px;  left:55%;  top:30%; opacity:.25; animation-duration:32s; animation-delay:-13s; }
    .p:nth-child(16) { width:2px;  height:2px;  left:65%;  top:48%; opacity:.45; animation-duration:22s; animation-delay:-3s;  }
    .p:nth-child(17) { width:1.5px;height:1.5px;left:75%;  top:35%; opacity:.55; animation-duration:20s; animation-delay:-18s; }
    .p:nth-child(18) { width:2.5px;height:2.5px;left:85%;  top:55%; opacity:.35; animation-duration:25s; animation-delay:-8s;  }
    .p:nth-child(19) { width:2px;  height:2px;  left:22%;  top:20%; opacity:.4;  animation-duration:28s; animation-delay:-15s; }
    .p:nth-child(20) { width:1px;  height:1px;  left:92%;  top:25%; opacity:.6;  animation-duration:16s; animation-delay:-2s;  }
    @keyframes float {
      0%   { transform: translateY(0) translateX(0); }
      25%  { transform: translateY(-30vh) translateX(15px); }
      50%  { transform: translateY(-55vh) translateX(-10px); }
      75%  { transform: translateY(-75vh) translateX(20px); }
      100% { transform: translateY(-105vh) translateX(0); opacity: 0; }
    }

    /* Central glow */
    .topo-glow {
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 50% 40% at 50% 48%, hsla(217,91%,50%,0.08) 0%, transparent 70%);
      pointer-events: none;
    }

    /* Dark vignette edges */
    .vignette {
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 88% 85% at 50% 50%, transparent 35%, hsla(224, 50%, 4%, 0.9) 100%);
      pointer-events: none;
    }

    .glass-card {
      background: hsla(222, 40%, 12%, 0.72);
      border: 1px solid hsla(210, 60%, 70%, 0.12);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      box-shadow:
        0 0 0 1px hsla(210, 40%, 60%, 0.05),
        0 32px 64px -16px hsla(222, 47%, 3%, 0.8),
        0 0 80px -20px hsla(217, 91%, 50%, 0.18);
    }
    .logo-glow {
      filter: drop-shadow(0 0 18px hsla(217, 91%, 58%, 0.65))
              drop-shadow(0 0 40px hsla(217, 91%, 55%, 0.3));
      animation: logo-pulse 4s ease-in-out infinite alternate;
    }
    @keyframes logo-pulse {
      0%   { filter: drop-shadow(0 0 18px hsla(217,91%,58%,0.65)) drop-shadow(0 0 40px hsla(217,91%,55%,0.3)); }
      100% { filter: drop-shadow(0 0 28px hsla(217,91%,62%,0.85)) drop-shadow(0 0 60px hsla(217,91%,55%,0.45)); }
    }
    .input-field {
      width: 100%;
      border-radius: 0.5rem;
      border: 1px solid hsla(210, 40%, 50%, 0.2);
      background: hsla(224, 50%, 7%, 0.6);
      color: hsl(210, 40%, 96%);
      padding: 0.625rem 0.875rem;
      font-size: 0.875rem;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .input-field::placeholder { color: hsl(215, 20%, 40%); }
    .input-field:focus {
      border-color: hsla(217, 91%, 62%, 0.55);
      background: hsla(224, 50%, 9%, 0.8);
      box-shadow: 0 0 0 3px hsla(217, 91%, 55%, 0.1);
    }
    .input-field.invalid {
      border-color: hsla(0, 80%, 60%, 0.5);
      box-shadow: 0 0 0 3px hsla(0, 80%, 50%, 0.1);
    }
    .field-error {
      font-size: 0.75rem;
      margin-top: 0.25rem;
      color: hsl(0, 80%, 70%);
    }
    .btn-primary {
      width: 100%;
      border-radius: 0.5rem;
      background: linear-gradient(135deg, hsl(217, 91%, 52%) 0%, hsl(225, 85%, 46%) 100%);
      padding: 0.65rem 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #fff;
      border: none;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.12s, box-shadow 0.15s;
      box-shadow: 0 4px 20px hsla(217, 91%, 50%, 0.35);
      letter-spacing: 0.02em;
    }
    .btn-primary:hover:not(:disabled) {
      opacity: 0.9;
      box-shadow: 0 6px 28px hsla(217, 91%, 50%, 0.5);
      transform: translateY(-1px);
    }
    .btn-primary:active:not(:disabled) { transform: translateY(0); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  `],
  template: `
    <div class="login-bg min-h-screen flex items-center justify-center">
      <!-- Floating particles -->
      <div class="particles">
        <div class="p"></div><div class="p"></div><div class="p"></div><div class="p"></div>
        <div class="p"></div><div class="p"></div><div class="p"></div><div class="p"></div>
        <div class="p"></div><div class="p"></div><div class="p"></div><div class="p"></div>
        <div class="p"></div><div class="p"></div><div class="p"></div><div class="p"></div>
        <div class="p"></div><div class="p"></div><div class="p"></div><div class="p"></div>
      </div>
      <!-- Glow and vignette -->
      <div class="topo-glow"></div>
      <div class="vignette"></div>

      <div class="relative z-10 w-full max-w-sm px-4">

        <!-- Logo + brand -->
        <div class="flex flex-col items-center mb-8">
          <img src="/icons/logo.png" alt="flui.cloud" class="logo-glow h-16 w-16 object-contain mb-5" />
          <h1 class="text-3xl font-bold tracking-tight text-white">flui.cloud</h1>
          <p class="text-sm mt-1.5" style="color: hsl(215, 25%, 58%)">
            Cloud infrastructure, simplified.
          </p>
        </div>

        @if (loopDetected()) {
          <div class="glass-card rounded-xl p-6 text-center space-y-3">
            <p class="text-sm" style="color: hsl(0,80%,75%)">
              We couldn't sign you in to {{ loopHost() }}.
            </p>
            <p class="text-xs" style="color: hsl(215,25%,65%)">
              Please try again in a few moments. If the problem continues, contact support.
            </p>
            <a href="/" class="text-xs underline" style="color: hsl(217,91%,70%)">← Back to dashboard</a>
          </div>
        } @else if (authMode() === 'oidc') {
          <div class="glass-card rounded-xl p-6 text-center text-sm" style="color: hsl(210,40%,80%)">
            Redirecting to authentication provider...
          </div>
        } @else {
          <div class="glass-card rounded-xl p-7">
            <h2 class="text-base font-semibold text-white mb-5">Sign in to your account</h2>

            <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>
              <!-- Email -->
              <div class="space-y-1">
                <label for="email" class="block text-xs font-medium uppercase tracking-wider" style="color: hsl(215,25%,58%)">Email</label>
                <input
                  id="email"
                  type="email"
                  formControlName="email"
                  autocomplete="email"
                  placeholder="admin@flui.cloud"
                  [class.invalid]="isInvalid('email')"
                  class="input-field"
                />
                @if (isInvalid('email')) {
                  <p class="field-error">
                    @if (form.get('email')?.hasError('required')) { Email is required. }
                    @else if (form.get('email')?.hasError('email')) { Enter a valid email address. }
                  </p>
                }
              </div>

              <!-- Password -->
              <div class="space-y-1">
                <label for="password" class="block text-xs font-medium uppercase tracking-wider" style="color: hsl(215,25%,58%)">Password</label>
                <input
                  id="password"
                  type="password"
                  formControlName="password"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  [class.invalid]="isInvalid('password')"
                  class="input-field"
                />
                @if (isInvalid('password')) {
                  <p class="field-error">
                    @if (form.get('password')?.hasError('required')) { Password is required. }
                    @else if (form.get('password')?.hasError('minlength')) { Password must be at least 6 characters. }
                  </p>
                }
              </div>

              @if (errorMessage()) {
                <p class="text-xs px-3 py-2 rounded-md" style="color: hsl(0,80%,70%); background: hsla(0,80%,50%,0.1); border: 1px solid hsla(0,80%,50%,0.2)">
                  {{ errorMessage() }}
                </p>
              }

              <div class="pt-1">
                <button type="submit" [disabled]="loading()" class="btn-primary">
                  {{ loading() ? 'Signing in...' : 'Sign in' }}
                </button>
              </div>
            </form>
          </div>

          <p class="text-center text-xs mt-5" style="color: hsl(215,20%,38%)">
            flui.cloud &copy; {{ year }}
          </p>
        }
      </div>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cfg = inject(AppConfigService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly themeService = inject(ThemeService);

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
  readonly year = new Date().getFullYear();

  ngOnInit(): void {
    this.authMode.set(this.cfg.authMode);

    const redirect = this.route.snapshot.queryParams['redirect'];
    if (redirect) {
      sessionStorage.setItem(REDIRECT_KEY, redirect);

      // Each visit to /login?redirect=X within a short window counts as a loop attempt:
      // when the session cookie isn't shared with the target host, the user keeps
      // bouncing back here and OIDC succeeds every time, so a per-entry guard is needed.
      const state = bumpLoopGuard(redirect);
      if (state.count > LOOP_GUARD_MAX_ATTEMPTS) {
        try { this.loopHost.set(new URL(redirect).host); } catch { this.loopHost.set(redirect); }
        this.loopDetected.set(true);
        sessionStorage.removeItem(REDIRECT_KEY);
        clearLoopGuard(redirect);
        return;
      }
    }

    if (this.cfg.authMode === 'oidc') {
      const loggedOut = this.route.snapshot.queryParamMap.get('loggedOut') === 'true';
      if (!loggedOut) {
        this.auth.login();
      }
    }
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
