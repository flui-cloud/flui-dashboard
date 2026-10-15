import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AccountOverview, AccountService } from '../../service/account.service';
import { AccountSecurityComponent, requirementMet } from './account-security.component';

const base = (over: Partial<AccountOverview['security']> = {}, limits = { guest: false, canUnlink: true }): AccountOverview => ({
  profile: {
    userName: 'ada',
    email: 'ada@example.com',
    emailVerified: true,
    firstName: 'Ada',
    lastName: 'L',
    displayName: null,
  },
  security: {
    password: true,
    totp: false,
    passkeys: [],
    securityKeys: [],
    links: [],
    ...over,
  },
  limits,
});

describe('AccountSecurityComponent', () => {
  let api: Record<string, jasmine.Spy>;

  const build = (overview: AccountOverview) => {
    api = {
      passwordPolicy: jasmine.createSpy('passwordPolicy').and.returnValue(
        of({
          minLength: 8,
          requirements: [
            { rule: 'min-length', label: 'At least 8 characters' },
            { rule: 'number', label: 'A number' },
          ],
        }),
      ),
      changePassword: jasmine.createSpy('changePassword').and.returnValue(of({ success: true })),
      startTotp: jasmine.createSpy('startTotp').and.returnValue(of({ uri: 'otpauth://x', secret: 'SECRET' })),
      verifyTotp: jasmine.createSpy('verifyTotp').and.returnValue(of({ success: true })),
      removePasskey: jasmine.createSpy('removePasskey').and.returnValue(of({ success: true })),
      unlink: jasmine.createSpy('unlink').and.returnValue(of({ success: true })),
    };
    TestBed.configureTestingModule({
      imports: [AccountSecurityComponent],
      providers: [{ provide: AccountService, useValue: api }],
    });
    const fixture = TestBed.createComponent(AccountSecurityComponent);
    fixture.componentRef.setInput('overview', overview);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, cmp: fixture.componentInstance };
  };

  it('ticks off the password rules as they are met', () => {
    expect(requirementMet('min-length', 'abc', 8)).toBeFalse();
    expect(requirementMet('number', 'abc1', 8)).toBeTrue();
    expect(requirementMet('symbol', 'abc', 0)).toBeFalse();
    expect(requirementMet('unknown-rule', '', 0)).toBeTrue();
  });

  it('shows the policy, and no sessions until the identity provider can list them', () => {
    const { el } = build(base());
    expect(el.querySelector('[data-testid="requirements"]')?.textContent).toContain('At least 8 characters');
    expect(el.querySelector('[data-testid="sessions-card"]')).toBeNull();
  });

  it('sends the current and new password, and only when the rules are met', () => {
    const { cmp } = build(base());
    const c = cmp as unknown as { current: string; next: string; again: string; changePassword(): void };
    c.current = 'old';
    c.next = 'short';
    c.again = 'short';
    c.changePassword();
    expect(api['changePassword']).not.toHaveBeenCalled();
    c.next = 'longer-one-9';
    c.again = 'longer-one-9';
    c.changePassword();
    expect(api['changePassword']).toHaveBeenCalledWith('old', 'longer-one-9');
  });

  it('asks for the current password, shows the secret, then confirms the app with a code', () => {
    const { fixture, el, cmp } = build(base());
    (el.querySelector('[data-testid="totp-start"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="totp-password-form"]')).not.toBeNull();
    cmp.startTotp();
    expect(api['startTotp']).not.toHaveBeenCalled();
    (cmp as unknown as { totpPassword: string }).totpPassword = 'pw';
    cmp.startTotp();
    expect(api['startTotp']).toHaveBeenCalledWith('pw');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="totp-password-form"]')).toBeNull();
    expect(el.querySelector('[data-testid="totp-secret"]')?.textContent).toContain('SECRET');
    (cmp as unknown as { code: string }).code = '123456';
    cmp.verifyTotp();
    expect(api['verifyTotp']).toHaveBeenCalledWith('123456');
  });

  it('draws the QR code in the page from the registration link', async () => {
    const { fixture, el } = build(base({ password: false }));
    (el.querySelector('[data-testid="totp-start"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    for (let i = 0; i < 20 && !el.querySelector('[data-testid="totp-qr"]'); i++) {
      await new Promise((r) => setTimeout(r, 25));
      fixture.detectChanges();
    }
    const img = el.querySelector<HTMLImageElement>('[data-testid="totp-qr"]');
    expect(img?.src.startsWith('data:image/png;base64,')).toBeTrue();
  });

  it('sets up the app without a password on an account that has none', () => {
    const { fixture, el } = build(base({ password: false }));
    (el.querySelector('[data-testid="totp-start"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api['startTotp']).toHaveBeenCalledWith(undefined);
    expect(el.querySelector('[data-testid="totp-secret"]')?.textContent).toContain('SECRET');
  });

  it('removes a passkey only with the password typed in', () => {
    const { cmp } = build(base({ passkeys: [{ id: 'pk-1', name: 'Mac', ready: true }] }));
    cmp.ask({ kind: 'passkey', id: 'pk-1', label: 'Mac' });
    cmp.confirmPending();
    expect(api['removePasskey']).not.toHaveBeenCalled();
    (cmp as unknown as { confirmPassword: string }).confirmPassword = 'pw';
    cmp.confirmPending();
    expect(api['removePasskey']).toHaveBeenCalledWith('pk-1', 'pw');
  });

  it('offers no unlink to a guest, and says the sign-in stays', () => {
    const link = { idpId: 'gh', provider: 'GitHub', externalUserId: '1', externalUserName: 'ada' };
    const { el } = build(base({ links: [link], password: false }, { guest: true, canUnlink: false }));
    expect(el.querySelector('[data-testid="links-card"]')?.textContent).toContain('GitHub');
    expect(el.querySelector('[data-testid="unlink"]')).toBeNull();
    expect(el.querySelector('[data-testid="guest-link-note"]')).not.toBeNull();
    expect(api['passwordPolicy']).not.toHaveBeenCalled();
  });

  it('shows the API’s refusal in its own words', () => {
    const { fixture, el, cmp } = build(base());
    api['changePassword'].and.returnValue(
      throwError(() => ({ error: { code: 'CURRENT_PASSWORD_INVALID', message: 'Your current password is not correct.' } })),
    );
    const c = cmp as unknown as { current: string; next: string; again: string };
    c.current = 'bad';
    c.next = 'longer-one-9';
    c.again = 'longer-one-9';
    cmp.changePassword();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="error"]')?.textContent).toContain('not correct');
  });
});
