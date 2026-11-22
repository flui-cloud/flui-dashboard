import {
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
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
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
  host: { class: 'fl-stack' },
  imports: [FormsModule, NgTemplateOutlet, FlAlert, FlField, FlPanel, FlTable, FlButton, FlStatus],
  templateUrl: './account-security.component.html',
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
    const rulesMet =
      !p || p.requirements.every((r) => requirementMet(r.rule, this.next, p.minLength));
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
    import('qrcode')
      .then((lib) => {
        const qr = (lib as unknown as { default?: typeof lib }).default ?? lib;
        return qr.toDataURL(uri, { margin: 1, width: 176, errorCorrectionLevel: 'M' });
      })
      .then((url) => this.totpQr.set(url))
      .catch((error: unknown) => {
        console.warn('The QR code could not be drawn', error);
        this.totpQr.set(null);
      });
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
          {
            idpId: item.idpId,
            externalUserId: item.externalUserId,
            provider: item.label,
            externalUserName: '',
          },
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
