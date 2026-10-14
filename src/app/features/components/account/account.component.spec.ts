import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';
import { AuthService } from '../../../core/services/auth.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { AccountOverview, AccountService } from '../../service/account.service';
import { AccountComponent } from './account.component';

const OVERVIEW: AccountOverview = {
  profile: {
    userName: 'ada',
    email: 'ada@example.com',
    emailVerified: true,
    firstName: 'Ada',
    lastName: 'Lovelace',
    displayName: 'Ada L',
  },
  security: { password: true, totp: false, passkeys: [], securityKeys: [], links: [] },
  limits: { guest: false, canUnlink: true },
};

describe('AccountComponent', () => {
  const build = (opts: { visitor?: boolean; authMode?: string; overview?: jasmine.Spy } = {}) => {
    const overview = opts.overview ?? jasmine.createSpy('overview').and.returnValue(of(OVERVIEW));
    TestBed.overrideComponent(AccountComponent, {
      set: {
        imports: [],
        template: `
          @if (visitor()) { <p data-testid="visitor-note"></p> }
          @else if (error()) { <p data-testid="account-error">{{ error() }}</p> }
          @else if (overview()) { <p data-testid="loaded">{{ overview()!.profile.userName }}</p> }
        `,
      },
    });
    TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [
        { provide: AccountService, useValue: { overview } },
        { provide: AuthService, useValue: { loadCurrentUser: () => of(void 0) } },
        { provide: AppConfigService, useValue: { authMode: opts.authMode ?? 'oidc' } },
        { provide: SandboxService, useValue: { visitor: signal(opts.visitor ?? false) } },
      ],
    });
    const fixture = TestBed.createComponent(AccountComponent);
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, overview, fixture };
  };

  it('loads the caller’s own account', () => {
    const { el, overview } = build();
    expect(overview).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[data-testid="loaded"]')?.textContent).toContain('ada');
  });

  it('asks nothing for a visitor, and says why there is no account', () => {
    const { el, overview } = build({ visitor: true });
    expect(overview).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="visitor-note"]')).not.toBeNull();
  });

  it('keeps the local-mode screens on a local installation', () => {
    const { overview } = build({ authMode: 'local' });
    expect(overview).not.toHaveBeenCalled();
  });

  it('shows the API’s own sentence when the account cannot be read', () => {
    const { el } = build({
      overview: jasmine
        .createSpy('overview')
        .and.returnValue(throwError(() => ({ error: { message: 'Provider down.' } }))),
    });
    expect(el.querySelector('[data-testid="account-error"]')?.textContent).toContain('Provider down.');
  });
});
