import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { Observable } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCircle } from '@ng-icons/lucide';
import { HlmCardContentDirective, HlmCardDirective } from '@spartan-ng/ui-card-helm';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
import { HlmLabelDirective } from '@spartan-ng/ui-label-helm';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import {
  AccountOverview,
  AccountService,
  PasswordPolicy,
  TotpRegistration,
  accountErrorMessage,
} from '../../service/account.service';

type Pending =
  | { kind: 'totp'; id: 'totp'; label: string }
  | { kind: 'passkey' | 'security-key'; id: string; label: string }
  | { kind: 'link'; id: string; label: string; idpId: string; externalUserId: string };

const RULES: Record<string, (pw: string, min: number) => boolean> = {
  'min-length': (pw, min) => [...pw].length >= min,
  uppercase: (pw) => /\p{Lu}/u.test(pw),
  lowercase: (pw) => /\p{Ll}/u.test(pw),
  number: (pw) => /\p{Nd}/u.test(pw),
  symbol: (pw) => /[^\p{L}\p{Nd}]/u.test(pw),
};

export function requirementMet(rule: string, password: string, minLength: number): boolean {
  return RULES[rule]?.(password, minLength) ?? true;
}

@Component({
  selector: 'app-account-security',
  host: { class: 'block space-y-4' },
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmInputDirective,
    HlmLabelDirective,
    HlmButtonDirective,
    HlmBadgeDirective,
  ],
  providers: [provideIcons({ lucideCheck, lucideCircle })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #confirm>
      <form
        class="mt-2 flex flex-wrap items-center gap-2"
        (ngSubmit)="confirmPending()"
        data-testid="confirm-form"
      >
        <input
          hlmInput
          type="password"
          name="confirmPassword"
          class="w-56"
          placeholder="Current password"
          autocomplete="current-password"
          [(ngModel)]="confirmPassword"
        />
        <button hlmBtn size="sm" variant="destructive" type="submit" [disabled]="busy() || !confirmPassword">
          Remove
        </button>
        <button hlmBtn size="sm" variant="ghost" type="button" (click)="cancelPending()">Cancel</button>
      </form>
    </ng-template>

    @if (notice()) {
      <p class="text-sm text-green-600 dark:text-green-400" data-testid="notice">{{ notice() }}</p>
    }
    @if (error()) {
      <p class="text-sm text-destructive" data-testid="error">{{ error() }}</p>
    }

    <div hlmCard data-testid="password-card">
      <div hlmCardContent class="pt-6 space-y-4">
        <h4 class="text-sm font-medium">Password</h4>
        @if (overview().security.password) {
          <form class="space-y-3 max-w-md" (ngSubmit)="changePassword()" data-testid="password-form">
            <div class="space-y-1.5">
              <label hlmLabel for="current">Current password</label>
              <input hlmInput id="current" name="current" type="password" class="w-full"
                autocomplete="current-password" [(ngModel)]="current" />
            </div>
            <div class="space-y-1.5">
              <label hlmLabel for="next">New password</label>
              <input hlmInput id="next" name="next" type="password" class="w-full"
                autocomplete="new-password" [(ngModel)]="next" (ngModelChange)="typed.set($event)" />
            </div>
            @if (policy(); as p) {
              <ul class="space-y-0.5 text-xs" data-testid="requirements">
                @for (r of p.requirements; track r.rule) {
                  <li class="flex items-center gap-1.5"
                    [class.text-green-600]="met(r.rule)" [class.text-muted-foreground]="!met(r.rule)">
                    <ng-icon [name]="met(r.rule) ? 'lucideCheck' : 'lucideCircle'" class="h-3 w-3" />
                    {{ r.label }}
                  </li>
                }
              </ul>
            }
            <div class="space-y-1.5">
              <label hlmLabel for="again">New password again</label>
              <input hlmInput id="again" name="again" type="password" class="w-full"
                autocomplete="new-password" [(ngModel)]="again" />
              @if (again && next !== again) {
                <p class="text-xs text-destructive">The two passwords differ.</p>
              }
            </div>
            <button hlmBtn type="submit" [disabled]="busy() || !canChangePassword()">Change password</button>
          </form>
        } @else {
          <p class="text-sm text-muted-foreground">You sign in with a linked account, without a password.</p>
        }
      </div>
    </div>

    <div hlmCard data-testid="totp-card">
      <div hlmCardContent class="pt-6 space-y-3">
        <div class="flex items-center gap-2">
          <h4 class="text-sm font-medium">Authenticator app</h4>
          <span hlmBadge [variant]="overview().security.totp ? 'default' : 'secondary'" class="text-xs">
            {{ overview().security.totp ? 'On' : 'Off' }}
          </span>
        </div>
        @if (overview().security.totp) {
          @if (pending()?.kind === 'totp') {
            <ng-container [ngTemplateOutlet]="confirm" />
          } @else {
            <button hlmBtn size="sm" variant="outline" (click)="ask({ kind: 'totp', id: 'totp', label: 'authenticator app' })">
              Remove
            </button>
          }
        } @else if (totp(); as reg) {
          <div class="space-y-2 max-w-md" data-testid="totp-setup">
            <p class="text-sm">Scan the code with your authenticator app, or add the secret by hand, then type the code it shows.</p>
            @if (totpQr(); as qr) {
              <img [src]="qr" alt="Authenticator app QR code" width="176" height="176"
                class="rounded-md border border-border bg-white p-2" data-testid="totp-qr" />
            }
            <code class="block break-all rounded-md bg-muted px-3 py-2 text-sm" data-testid="totp-secret">{{ reg.secret }}</code>
            <a class="text-xs text-primary underline-offset-4 hover:underline" [href]="reg.uri">Open in an authenticator app on this device</a>
            <form class="flex items-center gap-2" (ngSubmit)="verifyTotp()">
              <input hlmInput name="code" class="w-32" inputmode="numeric" autocomplete="one-time-code"
                placeholder="123456" [(ngModel)]="code" />
              <button hlmBtn size="sm" type="submit" [disabled]="busy() || !code.trim()">Confirm</button>
              <button hlmBtn size="sm" variant="ghost" type="button" (click)="totp.set(null)">Cancel</button>
            </form>
          </div>
        } @else if (askingTotpPassword()) {
          <form class="flex flex-wrap items-center gap-2" (ngSubmit)="startTotp()" data-testid="totp-password-form">
            <input hlmInput type="password" name="totpPassword" class="w-56" placeholder="Current password"
              autocomplete="current-password" [(ngModel)]="totpPassword" />
            <button hlmBtn size="sm" type="submit" [disabled]="busy() || !totpPassword">Continue</button>
            <button hlmBtn size="sm" variant="ghost" type="button" (click)="cancelTotp()">Cancel</button>
          </form>
        } @else {
          <button hlmBtn size="sm" variant="outline" [disabled]="busy()" (click)="beginTotp()" data-testid="totp-start">
            Set up
          </button>
        }
      </div>
    </div>

    @if (keys().length) {
      <div hlmCard data-testid="keys-card">
        <div hlmCardContent class="pt-6 space-y-2">
          <h4 class="text-sm font-medium">Passkeys and security keys</h4>
          @for (k of keys(); track k.id) {
            <div class="rounded-md border border-border px-3 py-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm">{{ k.name || 'Unnamed' }}
                  <span class="text-xs text-muted-foreground">{{ k.kind === 'passkey' ? 'Passkey' : 'Security key' }}</span>
                </span>
                @if (pending()?.id !== k.id) {
                  <button hlmBtn size="sm" variant="ghost" (click)="ask({ kind: k.kind, id: k.id, label: k.name || 'key' })">Remove</button>
                }
              </div>
              @if (pending()?.id === k.id) {
                <ng-container [ngTemplateOutlet]="confirm" />
              }
            </div>
          }
        </div>
      </div>
    }

    @if (overview().security.links.length) {
      <div hlmCard data-testid="links-card">
        <div hlmCardContent class="pt-6 space-y-2">
          <h4 class="text-sm font-medium">Linked accounts</h4>
          @for (l of overview().security.links; track l.idpId + l.externalUserId) {
            <div class="rounded-md border border-border px-3 py-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm">{{ l.provider }}
                  <span class="text-xs text-muted-foreground">{{ l.externalUserName || l.externalUserId }}</span>
                </span>
                @if (overview().limits.canUnlink && pending()?.id !== l.idpId + ':' + l.externalUserId) {
                  <button hlmBtn size="sm" variant="ghost" data-testid="unlink"
                    (click)="ask({ kind: 'link', id: l.idpId + ':' + l.externalUserId, label: l.provider, idpId: l.idpId, externalUserId: l.externalUserId })">
                    Unlink
                  </button>
                }
              </div>
              @if (pending()?.id === l.idpId + ':' + l.externalUserId) {
                <ng-container [ngTemplateOutlet]="confirm" />
              }
            </div>
          }
          @if (overview().limits.guest) {
            <p class="text-xs text-muted-foreground" data-testid="guest-link-note">Stays linked during the trial.</p>
          }
        </div>
      </div>
    }
  `,
})
export class AccountSecurityComponent implements OnInit {
  private readonly account = inject(AccountService);
  private readonly destroyRef = inject(DestroyRef);

  readonly overview = input.required<AccountOverview>();
  readonly changed = output<void>();

  protected readonly policy = signal<PasswordPolicy | null>(null);
  protected readonly totp = signal<TotpRegistration | null>(null);
  protected readonly totpQr = signal<string | null>(null);
  protected readonly askingTotpPassword = signal(false);
  protected readonly pending = signal<Pending | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly typed = signal('');

  protected current = '';
  protected next = '';
  protected again = '';
  protected code = '';
  protected confirmPassword = '';
  protected totpPassword = '';

  protected readonly keys = computed(() => [
    ...this.overview().security.passkeys.map((k) => ({ ...k, kind: 'passkey' as const })),
    ...this.overview().security.securityKeys.map((k) => ({ ...k, kind: 'security-key' as const })),
  ]);

  ngOnInit(): void {
    if (this.overview().security.password) {
      this.account
        .passwordPolicy()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (p) => this.policy.set(p), error: () => this.policy.set(null) });
    }
  }

  protected met(rule: string): boolean {
    return requirementMet(rule, this.typed(), this.policy()?.minLength ?? 0);
  }

  protected canChangePassword(): boolean {
    const p = this.policy();
    const rulesMet = !p || p.requirements.every((r) => requirementMet(r.rule, this.next, p.minLength));
    return !!this.current && !!this.next && this.next === this.again && rulesMet;
  }

  changePassword(): void {
    if (!this.canChangePassword()) return;
    this.run(this.account.changePassword(this.current, this.next), 'Password changed.', () => {
      this.current = '';
      this.next = '';
      this.again = '';
      this.typed.set('');
    });
  }

  beginTotp(): void {
    this.error.set(null);
    if (this.overview().security.password) this.askingTotpPassword.set(true);
    else this.startTotp();
  }

  cancelTotp(): void {
    this.askingTotpPassword.set(false);
    this.totpPassword = '';
  }

  private drawQr(uri: string): void {
    this.totpQr.set(null);
    // Drawn here, never by a remote service: the image carries the secret.
    import('qrcode')
      .then(({ toDataURL }) =>
        toDataURL(uri, { margin: 1, width: 176, errorCorrectionLevel: 'M' }),
      )
      .then((url) => this.totpQr.set(url))
      .catch(() => this.totpQr.set(null));
  }

  startTotp(): void {
    const password = this.overview().security.password ? this.totpPassword : undefined;
    if (password === '') return;
    this.busy.set(true);
    this.error.set(null);
    this.account
      .startTotp(password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reg) => {
          this.busy.set(false);
          this.cancelTotp();
          this.totp.set(reg);
          this.drawQr(reg.uri);
        },
        error: (err) => {
          this.busy.set(false);
          this.error.set(accountErrorMessage(err, 'The authenticator app could not be set up.'));
        },
      });
  }

  verifyTotp(): void {
    this.run(this.account.verifyTotp(this.code.trim()), 'Authenticator app set up.', () => {
      this.totp.set(null);
      this.code = '';
      this.changed.emit();
    });
  }

  ask(item: Pending): void {
    this.confirmPassword = '';
    this.error.set(null);
    this.pending.set(item);
  }

  cancelPending(): void {
    this.pending.set(null);
    this.confirmPassword = '';
  }

  confirmPending(): void {
    const item = this.pending();
    if (!item || !this.confirmPassword) return;
    const pw = this.confirmPassword;
    let call: Observable<unknown>;
    switch (item.kind) {
      case 'totp':
        call = this.account.removeTotp(pw);
        break;
      case 'passkey':
        call = this.account.removePasskey(item.id, pw);
        break;
      case 'security-key':
        call = this.account.removeSecurityKey(item.id, pw);
        break;
      case 'link':
        call = this.account.unlink(
          { idpId: item.idpId, externalUserId: item.externalUserId, provider: item.label, externalUserName: '' },
          pw,
        );
        break;
    }
    this.run(call, `Removed ${item.label}.`, () => {
      this.pending.set(null);
      this.confirmPassword = '';
      this.changed.emit();
    });
  }

  private run(call: Observable<unknown>, done: string, after: () => void): void {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(done);
        after();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(accountErrorMessage(err, 'That did not work. Try again.'));
      },
    });
  }
}
