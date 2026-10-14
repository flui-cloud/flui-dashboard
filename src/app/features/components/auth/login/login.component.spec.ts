import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../../core/services/auth.service';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { ThemeService } from '../../../../core/services/theme.service';

describe('LoginComponent with an identity provider', () => {
  const setUp = (query: Record<string, string>) => {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: AppConfigService, useValue: { authMode: 'oidc' } },
        { provide: ThemeService, useValue: { isDarkMode: () => true } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParams: query, queryParamMap: convertToParamMap(query) },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return { fixture, auth, el: fixture.nativeElement as HTMLElement };
  };

  it('goes straight to the identity provider', () => {
    const { auth, el } = setUp({});
    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[data-testid="signed-out"]')).toBeNull();
  });

  it('after signing out, waits for the person instead of hanging on a redirect', () => {
    const { auth, el, fixture } = setUp({ loggedOut: 'true' });
    expect(auth.login).not.toHaveBeenCalled();
    expect(el.textContent).not.toContain('Redirecting to authentication provider');
    const button = el.querySelector<HTMLButtonElement>('[data-testid="signed-out"] button');
    expect(button).not.toBeNull();
    button!.click();
    fixture.detectChanges();
    expect(auth.login).toHaveBeenCalledTimes(1);
  });
});
